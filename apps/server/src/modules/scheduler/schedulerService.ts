import { taskQueue } from './queue.js';
import { listRepositories, recoverInterruptedJobs, getRepositoryById } from '../storage/db.js';
import { compareRepositoryBranches } from '../comparison/compareService.js';
import { executeRepositorySync } from '../sync/syncService.js';
import { logger } from '../logging/logger.js';

let schedulerTimer: NodeJS.Timeout | null = null;
let nextScheduledCheckTime: Date | null = null;

export async function runScheduledCheckCycle(): Promise<void> {
  logger.info('Scheduler', 'Running scheduled check cycle for monitored repositories...');
  const repos = await listRepositories({ monitoredOnly: true });

  for (const repo of repos) {
    if (!repo.isFork && !repo.syncConfig?.upstreamRepo) continue;
    if (!repo.syncConfig?.autoCheckEnabled) continue;

    // Check if interval has elapsed
    const lastCheckedStr = repo.latestComparison?.checkedAt;
    const intervalMinutes = repo.syncConfig.checkIntervalMinutes || 360;
    
    if (lastCheckedStr) {
      const elapsedMinutes = (Date.now() - new Date(lastCheckedStr).getTime()) / (1000 * 60);
      if (elapsedMinutes < intervalMinutes) {
        continue;
      }
    }

    // Enqueue check job with normal priority
    await triggerCheckRepo(repo.id, 1);
  }

  // Update next scheduled check time (estimated next minute + interval)
  nextScheduledCheckTime = new Date(Date.now() + 60 * 1000 * 5);
}

export function startScheduler(): void {
  if (schedulerTimer) return;

  logger.info('Scheduler', 'Starting task scheduler service...');
  recoverInterruptedJobs().catch((err) => {
    logger.error('Scheduler', `恢复中断任务异常: ${err.message}`);
  });

  // Run initial cycle after 5 seconds
  setTimeout(() => {
    runScheduledCheckCycle().catch((err) => {
      logger.error('Scheduler', `首次定时检测异常: ${err.message}`);
    });
  }, 5000);

  // Check every 60 seconds for due repositories
  schedulerTimer = setInterval(() => {
    runScheduledCheckCycle().catch((err) => {
      logger.error('Scheduler', `定时检测周期异常: ${err.message}`);
    });
  }, 60 * 1000);
}

export function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info('Scheduler', 'Scheduler stopped.');
  }
}

export function getNextCheckTime(): string | null {
  return nextScheduledCheckTime ? nextScheduledCheckTime.toISOString() : null;
}

export async function triggerCheckRepo(repoId: number, priority = 10): Promise<string> {
  const repo = await getRepositoryById(repoId);
  const repoName = repo ? repo.fullName : `Repo-${repoId}`;

  // If repo is self-created without upstream, complete gracefully without throwing error
  if (repo && !repo.isFork && (!repo.syncConfig || !repo.syncConfig.upstreamRepo)) {
    return taskQueue.enqueue('check_single', repoId, repoName, priority, async (_jobId, updateStep) => {
      await updateStep('自建项目（非 Fork），无需同步上游代码');
      await compareRepositoryBranches(repoId);
    });
  }

  return taskQueue.enqueue('check_single', repoId, repoName, priority, async (jobId, updateStep) => {
    await updateStep('获取最新 Commit SHA 与比较提交历史...');
    const result = await compareRepositoryBranches(repoId);

    // If auto_sync is enabled and repo is behind_safe, automatically trigger sync!
    if (result.status === 'behind_safe' && repo?.syncConfig?.autoSyncEnabled) {
      logger.info('Scheduler', `检测到 ${repoName} 有新提交且启用了自动同步，立即安排同步任务...`);
      await triggerSyncRepo(repoId, priority + 1);
    }
  });
}

export async function triggerCheckAll(priority = 10): Promise<string[]> {
  logger.info('Scheduler', 'Triggering check for all monitored repositories...');
  const repos = await listRepositories({ monitoredOnly: true });
  // Filter only forks or repos with custom upstream configured
  const targetRepos = repos.filter((r) => r.isFork || Boolean(r.syncConfig?.upstreamRepo));
  const jobIds: string[] = [];

  for (const repo of targetRepos) {
    const jobId = await triggerCheckRepo(repo.id, priority);
    jobIds.push(jobId);
  }

  return jobIds;
}

export async function triggerSyncRepo(repoId: number, priority = 15): Promise<string> {
  const repo = await getRepositoryById(repoId);
  const repoName = repo ? repo.fullName : `Repo-${repoId}`;

  return taskQueue.enqueue('sync_single', repoId, repoName, priority, async (jobId, updateStep) => {
    await executeRepositorySync(repoId, {
      jobId,
      onProgress: (step) => {
        updateStep(step).catch(() => {});
      },
    });
  });
}

export async function triggerSyncSelected(repoIds: number[], priority = 15): Promise<string[]> {
  const jobIds: string[] = [];
  for (const repoId of repoIds) {
    const id = await triggerSyncRepo(repoId, priority);
    jobIds.push(id);
  }
  return jobIds;
}
