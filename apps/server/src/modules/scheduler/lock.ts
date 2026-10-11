import { logger } from '../logging/logger.js';

class RepoLockManager {
  private activeLocks: Map<number, { taskId: string; acquiredAt: number }> = new Map();

  public tryAcquire(repoId: number, taskId: string): boolean {
    const existing = this.activeLocks.get(repoId);
    if (existing) {
      // If lock has been held for more than 5 minutes, consider it stale and release
      if (Date.now() - existing.acquiredAt > 5 * 60 * 1000) {
        logger.warn('RepoLock', `Lock on repo ${repoId} held by task ${existing.taskId} timed out, forcefully reclaiming.`);
        this.activeLocks.delete(repoId);
      } else {
        return false;
      }
    }

    this.activeLocks.set(repoId, { taskId, acquiredAt: Date.now() });
    logger.debug('RepoLock', `Acquired lock on repo ${repoId} for task ${taskId}`);
    return true;
  }

  public release(repoId: number, taskId: string): void {
    const existing = this.activeLocks.get(repoId);
    if (existing && existing.taskId === taskId) {
      this.activeLocks.delete(repoId);
      logger.debug('RepoLock', `Released lock on repo ${repoId} for task ${taskId}`);
    }
  }

  public isLocked(repoId: number): boolean {
    return this.activeLocks.has(repoId);
  }
}

export const repoLock = new RepoLockManager();
