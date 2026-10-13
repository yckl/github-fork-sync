import crypto from 'crypto';
import { createJob, updateJob, listJobs, getSettings } from '../storage/db.js';
import { logger } from '../logging/logger.js';
import { compareRepositoryBranches } from '../comparison/compareService.js';
import { executeRepositorySync } from '../sync/syncService.js';
import { getLatestRateLimit } from '../github/client.js';
import type { JobRecord, JobType } from '@gitforksync/shared';

interface QueueItem {
  job: JobRecord;
  execute: () => Promise<void>;
}

class TaskQueue {
  private queue: QueueItem[] = [];
  private activeApiTasks = 0;
  private activeGitTasks = 0;
  private isProcessing = false;

  public async enqueue(
    type: JobType,
    repoId: number | null,
    repoFullName: string | null,
    priority = 0,
    runner: (jobId: string, updateStep: (step: string) => Promise<void>) => Promise<void>
  ): Promise<string> {
    // Deduplication: if an identical task for this repo is already pending in the queue, skip duplicate enqueue
    if (repoId !== null) {
      const existingPending = this.queue.find(
        (item) => item.job.repoId === repoId && item.job.type === type && item.job.status === 'pending'
      );
      if (existingPending) {
        logger.debug('TaskQueue', `[Deduplicate] 仓库 #${repoId} 的任务 [${type}] 已在队列中排队，自动跳过重复入队`);
        return existingPending.job.id;
      }
    }

    const id = crypto.randomUUID();
    const job: JobRecord = {
      id,
      type,
      repoId,
      repoFullName,
      status: 'pending',
      attempts: 0,
      priority,
      currentStep: '排队中...',
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
    };

    await createJob(job);
    logger.info('TaskQueue', `Job queued: ${type} [${id}] for ${repoFullName || 'system'} (Priority: ${priority})`);

    const updateStep = async (step: string) => {
      job.currentStep = step;
      await updateJob(id, { currentStep: step });
    };

    const item: QueueItem = {
      job,
      execute: async () => {
        job.status = 'running';
        job.startedAt = new Date().toISOString();
        await updateJob(id, {
          status: 'running',
          startedAt: job.startedAt,
          currentStep: '开始执行...',
        });

        try {
          await runner(id, updateStep);
          job.status = 'completed';
          job.finishedAt = new Date().toISOString();
          job.currentStep = '执行完成';
          await updateJob(id, {
            status: 'completed',
            finishedAt: job.finishedAt,
            currentStep: '执行完成',
          });
          logger.info('TaskQueue', `Job completed: ${type} [${id}]`);
        } catch (err: any) {
          job.status = 'failed';
          job.finishedAt = new Date().toISOString();
          job.error = err.message || '执行异常';
          await updateJob(id, {
            status: 'failed',
            finishedAt: job.finishedAt,
            error: job.error,
          });
          logger.error('TaskQueue', `Job failed: ${type} [${id}] - ${job.error}`);
        }
      },
    };

    // Higher priority items go first
    this.queue.push(item);
    this.queue.sort((a, b) => b.job.priority - a.job.priority);

    this.processNext();
    return id;
  }

  public async processNext(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const settings = await getSettings();
      const maxApi = settings.maxApiConcurrency || 2;
      const maxGit = settings.maxGitConcurrency || 1;

      // Check rate limit status
      const rateLimit = getLatestRateLimit();
      if (rateLimit.remaining <= 1) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (rateLimit.reset > nowSec) {
          logger.warn('TaskQueue', `GitHub API 额度耗尽 (${rateLimit.remaining})，等待至 ${new Date(rateLimit.reset * 1000).toLocaleTimeString()} 后重试`);
          return;
        }
      }

      for (let i = 0; i < this.queue.length; i++) {
        const item = this.queue[i];
        const isGitJob = item.job.type.startsWith('sync');
        const isApiJob = !isGitJob;

        if (isGitJob && this.activeGitTasks >= maxGit) {
          continue;
        }
        if (isApiJob && this.activeApiTasks >= maxApi) {
          continue;
        }

        // Dequeue item
        this.queue.splice(i, 1);
        i--;

        if (isGitJob) this.activeGitTasks++;
        if (isApiJob) this.activeApiTasks++;

        item
          .execute()
          .finally(() => {
            if (isGitJob) this.activeGitTasks--;
            if (isApiJob) this.activeApiTasks--;
            this.processNext();
          });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public getQueueStatus() {
    return {
      queuedCount: this.queue.length,
      activeApiTasks: this.activeApiTasks,
      activeGitTasks: this.activeGitTasks,
    };
  }
}

export const taskQueue = new TaskQueue();
