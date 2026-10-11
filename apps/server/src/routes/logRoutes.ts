import type { FastifyInstance } from 'fastify';
import { queryLogs } from '../modules/storage/db.js';
import { logger } from '../modules/logging/logger.js';
import type { LogLevel } from '@gitforksync/shared';

export async function logRoutes(server: FastifyInstance) {
  server.get('/api/logs', async (request) => {
    const query = request.query as {
      level?: string;
      repoId?: string;
      search?: string;
      limit?: string;
    };

    const logs = await queryLogs({
      level: query.level as LogLevel,
      repoId: query.repoId ? parseInt(query.repoId, 10) : undefined,
      search: query.search,
      limit: query.limit ? parseInt(query.limit, 10) : 100,
    });

    return { success: true, logs };
  });

  server.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      pid: process.pid,
      version: '1.0.0',
    };
  });
}
