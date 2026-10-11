import type { FastifyInstance } from 'fastify';
import {
  listRepositories,
  getRepositoryById,
  deleteRepository,
  deleteRepositories,
  updateSyncConfig,
  getCheckRuns,
  getSyncRuns,
} from '../modules/storage/db.js';
import { discoverRepositories } from '../modules/github/repoService.js';
import { triggerCheckRepo, triggerSyncRepo } from '../modules/scheduler/schedulerService.js';
import { updateSyncConfigSchema, batchMonitorSchema, batchSyncModeSchema } from '@gitforksync/shared';

export async function repoRoutes(server: FastifyInstance) {
  // List repositories
  server.get('/api/repositories', async (request) => {
    const query = request.query as {
      search?: string;
      isFork?: string;
      monitoredOnly?: string;
      status?: string;
    };

    const repos = await listRepositories({
      search: query.search,
      isFork: query.isFork === undefined ? undefined : query.isFork === 'true',
      monitoredOnly: query.monitoredOnly === 'true',
      status: query.status,
    });

    return { success: true, repos };
  });

  // Re-discover repositories from GitHub
  server.post('/api/repositories/discover', async (request, reply) => {
    try {
      const result = await discoverRepositories();
      return { success: true, result };
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || '扫描仓库失败',
      });
    }
  });

  // Get repository details by ID
  server.get('/api/repositories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const repoId = parseInt(id, 10);
    const repo = await getRepositoryById(repoId);
    if (!repo) {
      return reply.status(404).send({ success: false, error: '仓库未找到' });
    }

    const checkRuns = await getCheckRuns(repoId, 10);
    const syncRuns = await getSyncRuns(repoId, 10);

    return {
      success: true,
      repo,
      history: {
        checkRuns,
        syncRuns,
      },
    };
  });

  // Update repository sync config
  server.patch('/api/repositories/:id/config', async (request, reply) => {
    const { id } = request.params as { id: string };
    const repoId = parseInt(id, 10);

    const parseRes = updateSyncConfigSchema.partial().safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        success: false,
        error: parseRes.error.errors[0]?.message || '配置参数无效',
      });
    }

    await updateSyncConfig(repoId, parseRes.data);
    const updated = await getRepositoryById(repoId);
    return { success: true, repo: updated };
  });

  // Trigger manual check for a single repository
  server.post('/api/repositories/:id/check', async (request, reply) => {
    const { id } = request.params as { id: string };
    const repoId = parseInt(id, 10);

    try {
      const jobId = await triggerCheckRepo(repoId, 10);
      return { success: true, jobId, message: '已加入检测队列' };
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message || '触发检测失败',
      });
    }
  });

  // Trigger manual sync for a single repository
  server.post('/api/repositories/:id/sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    const repoId = parseInt(id, 10);

    try {
      const jobId = await triggerSyncRepo(repoId, 15);
      return { success: true, jobId, message: '已加入同步队列' };
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message || '触发同步失败',
      });
    }
  });

  // Batch enable/disable monitoring
  server.post('/api/repositories/batch-monitor', async (request, reply) => {
    const parseRes = batchMonitorSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({ success: false, error: '参数错误' });
    }

    for (const repoId of parseRes.data.repoIds) {
      await updateSyncConfig(repoId, { autoCheckEnabled: parseRes.data.enabled });
    }

    return { success: true, count: parseRes.data.repoIds.length };
  });

  // Batch update sync mode
  server.post('/api/repositories/batch-sync-mode', async (request, reply) => {
    const parseRes = batchSyncModeSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({ success: false, error: '参数错误' });
    }

    for (const repoId of parseRes.data.repoIds) {
      await updateSyncConfig(repoId, { syncMode: parseRes.data.syncMode });
    }

    return { success: true, count: parseRes.data.repoIds.length };
  });

  // Delete a single repository from tracking
  server.delete('/api/repositories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const repoId = parseInt(id, 10);
    if (isNaN(repoId)) {
      return reply.status(400).send({ success: false, error: '仓库 ID 无效' });
    }

    await deleteRepository(repoId);
    return { success: true, message: '仓库已从系统中移除' };
  });

  // Batch delete repositories from tracking
  server.post('/api/repositories/batch-delete', async (request, reply) => {
    const { repoIds } = (request.body as { repoIds?: number[] }) || {};
    if (!Array.isArray(repoIds) || repoIds.length === 0) {
      return reply.status(400).send({ success: false, error: '请提供要删除的仓库 ID 列表' });
    }

    await deleteRepositories(repoIds);
    return { success: true, count: repoIds.length, message: `已从系统中移除 ${repoIds.length} 个仓库` };
  });
}
