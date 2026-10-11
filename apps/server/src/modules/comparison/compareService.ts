import { getAuthenticatedOctokit } from '../github/client.js';
import { getRepositoryById, updateLatestComparison, createCheckRun } from '../storage/db.js';
import { logger } from '../logging/logger.js';
import crypto from 'crypto';
import type { ComparisonStatus, LatestComparison, CheckRunRecord } from '@gitforksync/shared';

export interface CompareResult {
  status: ComparisonStatus;
  upstreamSha: string | null;
  targetSha: string | null;
  aheadBy: number;
  behindBy: number;
  commonAncestorSha: string | null;
  summary: string;
  errorMessage?: string;
  commitPreview?: {
    latestCommitTitle?: string;
    latestCommitAuthor?: string;
    latestCommitDate?: string;
    compareUrl?: string;
    filesChanged?: number;
    filesAdded?: number;
    filesDeleted?: number;
  };
}

export function evaluateBranchComparison(params: {
  upstreamSha: string | null;
  targetSha: string | null;
  aheadBy: number;
  behindBy: number;
  hasCommonAncestor: boolean;
  isUpstreamRewritten?: boolean;
}): { status: ComparisonStatus; summary: string } {
  const { upstreamSha, targetSha, aheadBy, behindBy, hasCommonAncestor, isUpstreamRewritten } = params;

  if (isUpstreamRewritten) {
    return {
      status: 'unknown',
      summary: '上游提交历史出现强制重写迹象，暂停自动同步，需人工确认',
    };
  }

  if (upstreamSha && targetSha && upstreamSha === targetSha) {
    return {
      status: 'up_to_date',
      summary: '分支 SHA 完全一致，已是最新版本',
    };
  }

  if (!hasCommonAncestor && (aheadBy > 0 || behindBy > 0)) {
    return {
      status: 'incompatible',
      summary: '两个分支不存在共同祖先，历史不兼容',
    };
  }

  if (aheadBy === 0 && behindBy === 0) {
    return {
      status: 'up_to_date',
      summary: '分支已同步至最新提交',
    };
  }

  if (aheadBy > 0 && behindBy === 0) {
    return {
      status: 'behind_safe',
      summary: `上游有 ${aheadBy} 个新提交，我方无独立修改，可安全快进同步`,
    };
  }

  if (aheadBy === 0 && behindBy > 0) {
    return {
      status: 'ahead',
      summary: `我方领先上游 ${behindBy} 个独立提交，上游无更新`,
    };
  }

  if (aheadBy > 0 && behindBy > 0) {
    return {
      status: 'diverged',
      summary: `分支已分叉！上游有 ${aheadBy} 个提交，我方有 ${behindBy} 个独立提交，需人工处理`,
    };
  }

  return {
    status: 'unknown',
    summary: '分支状态未知',
  };
}

export async function compareRepositoryBranches(repoId: number): Promise<CompareResult> {
  const repo = await getRepositoryById(repoId);
  if (!repo) {
    throw new Error(`仓库不存在 (ID: ${repoId})`);
  }

  // Handle self-created / non-fork repositories without upstream
  if (!repo.isFork && (!repo.syncConfig || !repo.syncConfig.upstreamRepo)) {
    const summary = '自建项目（非 Fork），无需同步上游代码';
    logger.info('Compare', `${repo.fullName} 为自建项目，跳过上游代码比较`);
    const now = new Date().toISOString();
    await updateLatestComparison(repoId, {
      status: 'self_owned',
      upstreamSha: null,
      targetSha: null,
      aheadBy: 0,
      behindBy: 0,
      commonAncestorSha: null,
      checkedAt: now,
      errorMessage: null,
    });
    return {
      status: 'self_owned',
      upstreamSha: null,
      targetSha: null,
      aheadBy: 0,
      behindBy: 0,
      commonAncestorSha: null,
      summary,
    };
  }

  if (!repo.syncConfig || !repo.syncConfig.upstreamRepo) {
    throw new Error(`仓库 ${repo.fullName} 尚未配置上游同步信息`);
  }

  const { upstreamRepo, upstreamBranch, targetBranch, syncMode } = repo.syncConfig;
  const octokit = await getAuthenticatedOctokit();
  if (!octokit) {
    throw new Error('未连接 GitHub 账号');
  }

  const [upstreamOwner, upstreamRepoName] = upstreamRepo.split('/');
  if (!upstreamOwner || !upstreamRepoName) {
    throw new Error(`上游仓库格式不正确: ${upstreamRepo}，应为 owner/repo`);
  }

  const startedAt = new Date().toISOString();
  logger.info('Compare', `Checking updates for ${repo.fullName} (${targetBranch}) <- ${upstreamRepo} (${upstreamBranch})`);

  let upstreamSha: string | null = null;
  let targetSha: string | null = null;
  let targetBranchExists = true;

  // 1. Fetch upstream branch SHA
  try {
    const upstreamBranchRes = await octokit.rest.repos.getBranch({
      owner: upstreamOwner,
      repo: upstreamRepoName,
      branch: upstreamBranch,
    });
    upstreamSha = upstreamBranchRes.data.commit.sha;
  } catch (err: any) {
    const msg = `获取上游分支失败 (${upstreamRepo}:${upstreamBranch}): ${err.message}`;
    logger.error('Compare', msg);
    return recordComparisonFailure(repoId, startedAt, msg);
  }

  // 2. Fetch my target branch SHA
  try {
    const targetBranchRes = await octokit.rest.repos.getBranch({
      owner: repo.owner,
      repo: repo.name,
      branch: targetBranch,
    });
    targetSha = targetBranchRes.data.commit.sha;
  } catch (err: any) {
    if (err.status === 404) {
      targetBranchExists = false;
      targetSha = null;
    } else {
      const msg = `获取目标分支失败 (${repo.fullName}:${targetBranch}): ${err.message}`;
      logger.error('Compare', msg);
      return recordComparisonFailure(repoId, startedAt, msg);
    }
  }

  // 3. Handle missing target branch
  if (!targetBranchExists) {
    // If target is isolated sync branch (mode_a), we can safely create it later
    if (syncMode === 'mode_a') {
      const result: CompareResult = {
        status: 'behind_safe',
        upstreamSha,
        targetSha: null,
        aheadBy: 1, // represents new commits to be synced
        behindBy: 0,
        commonAncestorSha: null,
        summary: `目标分支 ${targetBranch} 尚不存在，同步时将作为独立分支首次创建并指向上游最新提交`,
      };
      await recordComparisonSuccess(repoId, startedAt, result);
      return result;
    } else {
      // For main or other modes, target branch must already exist!
      const msg = `目标分支 ${targetBranch} 不存在，模式 ${syncMode} 禁止自动创建`;
      return recordComparisonFailure(repoId, startedAt, msg);
    }
  }

  // 4. If targetSha and upstreamSha are already identical
  if (upstreamSha && targetSha && upstreamSha === targetSha) {
    const result: CompareResult = {
      status: 'up_to_date',
      upstreamSha,
      targetSha,
      aheadBy: 0,
      behindBy: 0,
      commonAncestorSha: targetSha,
      summary: '分支 SHA 完全一致，已是最新版本',
    };
    await recordComparisonSuccess(repoId, startedAt, result);
    return result;
  }

  // 5. Compare using GitHub Compare API
  // basehead: {base}...{head} -> BASE = my target branch, HEAD = upstream target branch
  // Format across forks: owner:repo / basehead: base...upstreamOwner:upstreamBranch
  const basehead = `${targetBranch}...${upstreamOwner}:${upstreamBranch}`;
  try {
    const compareRes = await octokit.rest.repos.compareCommitsWithBasehead({
      owner: repo.owner,
      repo: repo.name,
      basehead,
    });

    const data = compareRes.data;
    const aheadBy = data.ahead_by; // commits upstream has that we don't
    const behindBy = data.behind_by; // commits we have that upstream doesn't
    const commonAncestorSha = data.merge_base_commit?.sha || null;

    const { status, summary } = evaluateBranchComparison({
      upstreamSha,
      targetSha,
      aheadBy,
      behindBy,
      hasCommonAncestor: Boolean(commonAncestorSha),
    });

    const latestCommit = data.commits && data.commits.length > 0 ? data.commits[data.commits.length - 1] : null;
    const commitPreview = latestCommit
      ? {
          latestCommitTitle: latestCommit.commit.message?.split('\n')[0],
          latestCommitAuthor: latestCommit.commit.author?.name || latestCommit.author?.login,
          latestCommitDate: latestCommit.commit.author?.date,
          compareUrl: data.html_url,
          filesChanged: data.files?.length || 0,
          filesAdded: data.files?.filter((f) => f.status === 'added').length || 0,
          filesDeleted: data.files?.filter((f) => f.status === 'removed').length || 0,
        }
      : undefined;

    const result: CompareResult = {
      status,
      upstreamSha,
      targetSha,
      aheadBy,
      behindBy,
      commonAncestorSha,
      summary,
      commitPreview,
    };

    await recordComparisonSuccess(repoId, startedAt, result);
    return result;
  } catch (err: any) {
    const msg = `GitHub 比较提交历史失败: ${err.message}`;
    logger.error('Compare', msg);
    return recordComparisonFailure(repoId, startedAt, msg);
  }
}

async function recordComparisonSuccess(
  repoId: number,
  startedAt: string,
  result: CompareResult
): Promise<void> {
  const finishedAt = new Date().toISOString();
  const runId = crypto.randomUUID();

  const checkRecord: CheckRunRecord = {
    id: runId,
    repoId,
    startedAt,
    finishedAt,
    upstreamSha: result.upstreamSha,
    targetSha: result.targetSha,
    comparisonStatus: result.status,
    aheadBy: result.aheadBy,
    behindBy: result.behindBy,
    summary: result.summary,
    errorMessage: null,
  };

  await createCheckRun(checkRecord);

  const comp: LatestComparison = {
    status: result.status,
    upstreamSha: result.upstreamSha,
    targetSha: result.targetSha,
    aheadBy: result.aheadBy,
    behindBy: result.behindBy,
    commonAncestorSha: result.commonAncestorSha,
    checkedAt: finishedAt,
    errorMessage: null,
    commitPreview: result.commitPreview,
  };

  await updateLatestComparison(repoId, comp);
}

async function recordComparisonFailure(
  repoId: number,
  startedAt: string,
  errorMessage: string
): Promise<CompareResult> {
  const finishedAt = new Date().toISOString();
  const runId = crypto.randomUUID();

  const checkRecord: CheckRunRecord = {
    id: runId,
    repoId,
    startedAt,
    finishedAt,
    upstreamSha: null,
    targetSha: null,
    comparisonStatus: 'error',
    aheadBy: 0,
    behindBy: 0,
    summary: '检测失败',
    errorMessage,
  };

  await createCheckRun(checkRecord);

  const comp: LatestComparison = {
    status: 'error',
    upstreamSha: null,
    targetSha: null,
    aheadBy: 0,
    behindBy: 0,
    commonAncestorSha: null,
    checkedAt: finishedAt,
    errorMessage,
  };

  await updateLatestComparison(repoId, comp);

  return {
    status: 'error',
    upstreamSha: null,
    targetSha: null,
    aheadBy: 0,
    behindBy: 0,
    commonAncestorSha: null,
    summary: '检测失败',
    errorMessage,
  };
}
