import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../../config.js';
import { runGitCommand } from './gitRunner.js';
import { repoLock } from '../scheduler/lock.js';
import { getRepositoryById, getAccount, createSyncRun, updateLatestComparison } from '../storage/db.js';
import { decryptSecret } from '../security/crypto.js';
import { compareRepositoryBranches } from '../comparison/compareService.js';
import { getAuthenticatedOctokit } from '../github/client.js';
import { logger } from '../logging/logger.js';
import type { SyncRunRecord, LatestComparison } from '@gitforksync/shared';

export interface SyncExecutionResult {
  runId: string;
  status: 'success' | 'failed' | 'unverified';
  beforeSha: string | null;
  targetSha: string;
  afterSha: string | null;
  message: string;
}

async function safelyCleanupDir(dirPath: string, retries = 5, delayMs = 600): Promise<void> {
  if (!fs.existsSync(dirPath)) return;
  for (let i = 0; i < retries; i++) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return;
    } catch (e: any) {
      if (i === retries - 1) {
        logger.warn('Sync', `清理临时目录最终失败 (${dirPath}): ${e.message}`);
      } else {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
}

export async function executeRepositorySync(
  repoId: number,
  options?: {
    forceMode?: boolean;
    jobId?: string;
    onProgress?: (step: string) => void;
  }
): Promise<SyncExecutionResult> {
  const taskId = options?.jobId || crypto.randomUUID();
  const repo = await getRepositoryById(repoId);
  if (!repo) {
    throw new Error(`仓库不存在 (ID: ${repoId})`);
  }
  if (!repo.syncConfig) {
    throw new Error(`仓库 ${repo.fullName} 尚未配置同步信息`);
  }

  // 1. Acquire repo lock
  if (!repoLock.tryAcquire(repoId, taskId)) {
    throw new Error(`仓库 ${repo.fullName} 当前已有同步或检测任务正在运行，请稍候再试`);
  }

  let { upstreamRepo, upstreamBranch, targetBranch, syncMode } = repo.syncConfig;
  if (syncMode === 'mode_b' || !targetBranch || targetBranch === 'upstream-sync' || targetBranch === 'upstream-sync-custom') {
    targetBranch = repo.defaultBranch;
  }
  const startedAt = new Date().toISOString();
  let tempDir = path.join(config.tempGitDir, taskId);

  try {
    options?.onProgress?.('检查提交状态与分叉历史...');
    logger.info('Sync', `Starting sync for ${repo.fullName} <- ${upstreamRepo}`, { repoId, jobId: taskId });

    // 2. Perform fresh comparison check
    const comp = await compareRepositoryBranches(repoId);
    if (comp.status === 'up_to_date') {
      logger.info('Sync', `仓库 ${repo.fullName} 已是最新，无需执行推送`, { repoId, jobId: taskId });
      return {
        runId: taskId,
        status: 'success',
        beforeSha: comp.targetSha,
        targetSha: comp.upstreamSha || '',
        afterSha: comp.targetSha,
        message: '仓库已经是最新状态，无需同步',
      };
    }

    if (comp.status !== 'behind_safe') {
      const msg = `无法自动安全同步: 当前分支状态为 [${comp.status}] (${comp.summary})`;
      logger.warn('Sync', msg, { repoId, jobId: taskId });
      throw new Error(msg);
    }

    if (!comp.upstreamSha) {
      throw new Error('未获取到上游分支的最新 Commit SHA');
    }

    const expectedSha = comp.upstreamSha;
    const beforeSha = comp.targetSha;

    // Fast-path: If repo is an official GitHub fork and syncing default branch,
    // attempt GitHub's Cloud Direct Sync (merge-upstream) first.
    // This executes directly on GitHub's cloud in <500ms without consuming local bandwidth.
    const octokit = await getAuthenticatedOctokit();
    if (octokit && repo.isFork && targetBranch === repo.defaultBranch) {
      try {
        options?.onProgress?.('尝试通过 GitHub 官方云端接口直接同步...');
        const mergeRes = await octokit.rest.repos.mergeUpstream({
          owner: repo.owner,
          repo: repo.name,
          branch: targetBranch,
        });

        if (mergeRes.status === 200) {
          const branchCheck = await octokit.rest.repos.getBranch({
            owner: repo.owner,
            repo: repo.name,
            branch: targetBranch,
          });
          const afterSha = branchCheck.data.commit.sha;
          const finishedAt = new Date().toISOString();

          const syncRecord: SyncRunRecord = {
            id: taskId,
            repoId,
            syncMode,
            targetBranch,
            startedAt,
            finishedAt,
            beforeSha,
            targetSha: expectedSha,
            afterSha,
            status: 'success',
            gitError: null,
            verificationResult: true,
          };
          await createSyncRun(syncRecord);
          await updateLatestComparison(repoId, {
            status: 'up_to_date',
            upstreamSha: expectedSha,
            targetSha: afterSha,
            aheadBy: 0,
            behindBy: 0,
            commonAncestorSha: afterSha,
            checkedAt: finishedAt,
            errorMessage: null,
          });

          options?.onProgress?.('云端直接同步完成！');
          logger.info('Sync', `GitHub 云端直接同步成功: ${repo.fullName} 目标分支 ${targetBranch} -> ${afterSha}`, {
            repoId,
            jobId: taskId,
          });

          return {
            runId: taskId,
            status: 'success',
            beforeSha,
            targetSha: expectedSha,
            afterSha,
            message: '通过 GitHub 云端直接同步成功！',
          };
        }
      } catch (cloudErr: any) {
        logger.info(
          'Sync',
          `GitHub 云端直接同步未命中或需本地处理 (${cloudErr.message})，转入本地 Git 引擎...`,
          { repoId, jobId: taskId }
        );
      }
    }

    // 3. Retrieve token for git authentication
    const { encryptedToken } = await getAccount();
    if (!encryptedToken) {
      throw new Error('未找到 GitHub 访问令牌，请先连接账号');
    }
    const token = decryptSecret(encryptedToken);

    // 4. Create isolated temporary workspace
    options?.onProgress?.('创建临时 Git 工作目录...');
    await safelyCleanupDir(tempDir);
    fs.mkdirSync(tempDir, { recursive: true });

    // 5. Initialize Git repository
    options?.onProgress?.('初始化本地环境...');
    await runGitCommand(['init'], { cwd: tempDir, token });
    await runGitCommand(['config', 'user.name', 'GitForkSync'], { cwd: tempDir, token });
    await runGitCommand(['config', 'user.email', 'bot@gitforksync.local'], { cwd: tempDir, token });

    // 6. Configure remotes
    options?.onProgress?.('连接 GitHub 远程仓库...');
    const upstreamUrl = `https://github.com/${upstreamRepo}.git`;
    const originUrl = `https://github.com/${repo.fullName}.git`;

    await runGitCommand(['remote', 'add', 'upstream', upstreamUrl], { cwd: tempDir, token });
    await runGitCommand(['remote', 'add', 'origin', originUrl], { cwd: tempDir, token });

    // 7. Fetch upstream target branch
    // Adaptive depth: fetch necessary commits + small margin, avoid pulling unnecessary history for giant repos
    const neededDepth = (comp.aheadBy && comp.aheadBy > 0) ? comp.aheadBy + 5 : 20;
    const fetchDepth = Math.min(Math.max(neededDepth, 10), 100);

    options?.onProgress?.(`拉取上游 ${upstreamRepo}:${upstreamBranch} 提交 (深度: ${fetchDepth})...`);
    const fetchRes = await runGitCommand(
      ['fetch', 'upstream', upstreamBranch, `--depth=${fetchDepth}`, '--no-tags'],
      {
        cwd: tempDir,
        token,
        timeoutMs: 600000, // 10 minutes timeout for large repos
      }
    );

    if (fetchRes.exitCode !== 0) {
      throw new Error(`从上游拉取提交失败: ${fetchRes.stderr || 'Git 网络错误'}`);
    }

    // 8. Verify fetched commit SHA
    const revRes = await runGitCommand(['rev-parse', 'FETCH_HEAD'], { cwd: tempDir, token });
    const fetchedSha = revRes.stdout.trim();
    if (!fetchedSha.startsWith(expectedSha.slice(0, 7))) {
      logger.warn('Sync', `拉取到的 SHA (${fetchedSha}) 与检测到的预期 SHA (${expectedSha}) 存在微小变动，继续以最新为准`, {
        repoId,
        jobId: taskId,
      });
    }

    // 9. Push to origin target branch WITHOUT --force
    options?.onProgress?.(`安全推送至我的仓库 ${repo.fullName}:${targetBranch}...`);
    // Non-forced push using normal refspec: FETCH_HEAD:refs/heads/<targetBranch>
    const pushRes = await runGitCommand(
      ['push', 'origin', `FETCH_HEAD:refs/heads/${targetBranch}`],
      { cwd: tempDir, token, timeoutMs: 600000 }
    );

    if (pushRes.exitCode !== 0) {
      const err = pushRes.stderr || 'Git Push 被拒绝';
      logger.error('Sync', `Git Push 失败: ${err}`, { repoId, jobId: taskId });
      
      const record: SyncRunRecord = {
        id: taskId,
        repoId,
        syncMode,
        targetBranch,
        startedAt,
        finishedAt: new Date().toISOString(),
        beforeSha,
        targetSha: expectedSha,
        afterSha: null,
        status: 'failed',
        gitError: err,
        verificationResult: false,
      };
      await createSyncRun(record);
      throw new Error(`推送失败: ${err}`);
    }

    // 10. Re-verify target branch SHA via GitHub API (Strict validation)
    options?.onProgress?.('通过 GitHub API 验证推送结果...');
    const octokit = await getAuthenticatedOctokit();
    let afterSha: string | null = null;
    let verificationSuccess = false;

    if (octokit) {
      try {
        const branchCheck = await octokit.rest.repos.getBranch({
          owner: repo.owner,
          repo: repo.name,
          branch: targetBranch,
        });
        afterSha = branchCheck.data.commit.sha;
        // Verify against fetchedSha
        if (afterSha === fetchedSha || afterSha === expectedSha) {
          verificationSuccess = true;
        } else {
          logger.warn('Sync', `推送后远程分支 SHA 为 ${afterSha}，与预期 ${expectedSha} 不符`, { repoId, jobId: taskId });
        }
      } catch (err: any) {
        logger.error('Sync', `远程校验目标分支失败: ${err.message}`, { repoId, jobId: taskId });
      }
    }

    const finishedAt = new Date().toISOString();
    const finalStatus = verificationSuccess ? 'success' : 'unverified';

    const syncRecord: SyncRunRecord = {
      id: taskId,
      repoId,
      syncMode,
      targetBranch,
      startedAt,
      finishedAt,
      beforeSha,
      targetSha: expectedSha,
      afterSha,
      status: finalStatus,
      gitError: null,
      verificationResult: verificationSuccess,
    };
    await createSyncRun(syncRecord);

    if (verificationSuccess) {
      // Update latest comparison status to up_to_date
      const updatedComp: LatestComparison = {
        status: 'up_to_date',
        upstreamSha: expectedSha,
        targetSha: afterSha,
        aheadBy: 0,
        behindBy: 0,
        commonAncestorSha: afterSha,
        checkedAt: finishedAt,
        errorMessage: null,
      };
      await updateLatestComparison(repoId, updatedComp);
    }

    options?.onProgress?.('同步完成！');
    logger.info('Sync', `同步执行完成: ${repo.fullName} 目标分支 ${targetBranch} -> ${afterSha}`, { repoId, jobId: taskId });

    return {
      runId: taskId,
      status: finalStatus,
      beforeSha,
      targetSha: expectedSha,
      afterSha,
      message: verificationSuccess ? '同步成功并通过远程验证！' : '推送成功，但远程验证状态未完全确认',
    };
  } catch (err: any) {
    logger.error('Sync', `同步异常中断: ${err.message}`, { repoId, jobId: taskId });
    throw err;
  } finally {
    // 11. Cleanup temporary directory
    await safelyCleanupDir(tempDir);

    // 12. Release repo lock
    repoLock.release(repoId, taskId);
  }
}
