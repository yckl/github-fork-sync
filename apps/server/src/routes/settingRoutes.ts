import type { FastifyInstance } from 'fastify';
import { getSettings, updateSettings, listRepositories, updateSyncConfig } from '../modules/storage/db.js';
import { updateSettingsSchema } from '@gitforksync/shared';
import { z } from 'zod';

export async function settingRoutes(server: FastifyInstance) {
  server.get('/api/settings', async () => {
    const settings = await getSettings();
    return { success: true, settings };
  });

  server.patch('/api/settings', async (request, reply) => {
    const parseRes = updateSettingsSchema.partial().safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        success: false,
        error: parseRes.error.errors[0]?.message || '参数无效',
      });
    }

    await updateSettings(parseRes.data);
    const updated = await getSettings();
    return { success: true, settings: updated };
  });

  // Export configuration (excluding tokens and secrets)
  server.get('/api/settings/export', async () => {
    const settings = await getSettings();
    const repos = await listRepositories();
    const monitoredConfigs = repos
      .filter((r) => r.syncConfig)
      .map((r) => ({
        repoFullName: r.fullName,
        upstreamRepo: r.syncConfig!.upstreamRepo,
        upstreamBranch: r.syncConfig!.upstreamBranch,
        targetBranch: r.syncConfig!.targetBranch,
        syncMode: r.syncConfig!.syncMode,
        autoCheckEnabled: r.syncConfig!.autoCheckEnabled,
        autoSyncEnabled: r.syncConfig!.autoSyncEnabled,
        checkIntervalMinutes: r.syncConfig!.checkIntervalMinutes,
      }));

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings,
      repositories: monitoredConfigs,
    };
  });

  // Import configuration
  server.post('/api/settings/import', async (request, reply) => {
    const schema = z.object({
      settings: updateSettingsSchema.partial().optional(),
      repositories: z.array(
        z.object({
          repoFullName: z.string(),
          upstreamRepo: z.string(),
          upstreamBranch: z.string(),
          targetBranch: z.string(),
          syncMode: z.enum(['mode_a', 'mode_b', 'mode_c']),
          autoCheckEnabled: z.boolean(),
          autoSyncEnabled: z.boolean(),
          checkIntervalMinutes: z.number(),
        })
      ).optional(),
    });

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, error: '导入文件格式不正确' });
    }

    if (parse.data.settings) {
      await updateSettings(parse.data.settings);
    }

    let appliedCount = 0;
    if (parse.data.repositories) {
      const repos = await listRepositories();
      for (const importItem of parse.data.repositories) {
        const match = repos.find((r) => r.fullName === importItem.repoFullName);
        if (match) {
          await updateSyncConfig(match.id, importItem);
          appliedCount++;
        }
      }
    }

    return { success: true, message: `配置已导入，已更新 ${appliedCount} 个仓库配置` };
  });
}
