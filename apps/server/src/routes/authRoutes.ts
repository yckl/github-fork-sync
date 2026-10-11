import type { FastifyInstance } from 'fastify';
import { connectAccount, getAccountStatus, disconnectAccount } from '../modules/auth/authService.js';
import { connectAccountSchema } from '@gitforksync/shared';

export async function authRoutes(server: FastifyInstance) {
  server.post('/api/auth/connect', async (request, reply) => {
    const parseRes = connectAccountSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        success: false,
        error: parseRes.error.errors[0]?.message || '请求参数无效',
      });
    }

    try {
      const account = await connectAccount(parseRes.data.token);
      return { success: true, account };
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message || '连接 GitHub 失败',
      });
    }
  });

  server.get('/api/auth/status', async () => {
    const account = await getAccountStatus();
    return { success: true, account };
  });

  server.post('/api/auth/disconnect', async () => {
    await disconnectAccount();
    return { success: true, message: '已断开 GitHub 连接' };
  });
}
