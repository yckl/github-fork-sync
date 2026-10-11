import type { FastifyInstance } from 'fastify';
import { listJobs } from '../modules/storage/db.js';
import { triggerCheckAll, triggerSyncSelected } from '../modules/scheduler/schedulerService.js';
import { taskQueue } from '../modules/scheduler/queue.js';
import { z } from 'zod';

export async function jobRoutes(server: FastifyInstance) {
  server.get('/api/jobs', async () => {
    const jobs = await listJobs(50);
    const queueStatus = taskQueue.getQueueStatus();
    return { success: true, jobs, queueStatus };
  });

  server.post('/api/jobs/check-all', async () => {
    const jobIds = await triggerCheckAll(10);
    return { success: true, count: jobIds.length, jobIds, message: '全局检测任务已排队' };
  });

  server.post('/api/jobs/sync-selected', async (request, reply) => {
    const schema = z.object({ repoIds: z.array(z.number()) });
    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, error: 'repoIds 参数无效' });
    }

    const jobIds = await triggerSyncSelected(parse.data.repoIds, 15);
    return { success: true, count: jobIds.length, jobIds, message: '批量同步任务已排队' };
  });
}
