import type { FastifyInstance } from 'fastify';
import { listRepositories, getCheckRuns, getSyncRuns, listJobs } from '../modules/storage/db.js';
import { getLatestRateLimit } from '../modules/github/client.js';
import { getNextCheckTime } from '../modules/scheduler/schedulerService.js';
import type { DashboardStats } from '@gitforksync/shared';

export async function dashboardRoutes(server: FastifyInstance) {
  server.get('/api/dashboard', async () => {
    const repos = await listRepositories();
    const jobs = await listJobs(20);
    const recentChecks = await getCheckRuns(undefined, 8);
    const recentSyncs = await getSyncRuns(undefined, 8);

    const totalRepos = repos.length;
    let forkRepos = 0;
    let monitoredRepos = 0;
    let upToDateCount = 0;
    let pendingSyncCount = 0;
    let needsAttentionCount = 0;

    for (const r of repos) {
      if (r.isFork) forkRepos++;
      if (r.syncConfig?.autoCheckEnabled) monitoredRepos++;

      const st = r.latestComparison?.status;
      if (st === 'up_to_date') {
        upToDateCount++;
      } else if (st === 'behind_safe') {
        pendingSyncCount++;
      } else if (st === 'diverged' || st === 'incompatible' || st === 'unknown' || st === 'error') {
        needsAttentionCount++;
      }
    }

    const failedSyncCount = recentSyncs.filter((s) => s.status === 'failed').length;
    const runningJobsCount = jobs.filter((j) => j.status === 'running').length;

    const stats: DashboardStats = {
      totalRepos,
      forkRepos,
      monitoredRepos,
      upToDateCount,
      pendingSyncCount,
      needsAttentionCount,
      failedSyncCount,
      runningJobsCount,
      apiRateLimit: getLatestRateLimit(),
      nextCheckTime: getNextCheckTime(),
      recentChecks,
      recentSyncs,
    };

    return { success: true, stats };
  });
}
