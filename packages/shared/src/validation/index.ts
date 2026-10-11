import { z } from 'zod';

export const connectAccountSchema = z.object({
  token: z.string().min(10, 'GitHub Token 长度不足').max(255, 'GitHub Token 过长'),
});

export const updateSyncConfigSchema = z.object({
  upstreamRepo: z.string().min(3, '请输入有效的上游仓库名 (如 owner/repo)'),
  upstreamBranch: z.string().min(1, '请输入上游分支名'),
  targetBranch: z.string().min(1, '请输入目标分支名'),
  syncMode: z.enum(['mode_a', 'mode_b', 'mode_c']),
  autoCheckEnabled: z.boolean(),
  autoSyncEnabled: z.boolean(),
  checkIntervalMinutes: z.number().int().min(5).max(43200),
});

export const addManualRepoSchema = z.object({
  myRepoUrl: z.string().url('请输入有效的 GitHub 仓库地址'),
  upstreamRepoUrl: z.string().url('请输入有效的上游仓库地址'),
  upstreamBranch: z.string().default('main'),
  targetBranch: z.string().default('upstream-sync'),
  syncMode: z.enum(['mode_a', 'mode_b', 'mode_c']).default('mode_a'),
  checkIntervalMinutes: z.number().int().min(5).default(360),
});

export const updateSettingsSchema = z.object({
  defaultCheckIntervalMinutes: z.number().int().min(5).max(43200),
  defaultTargetBranch: z.string().min(1),
  defaultSyncMode: z.enum(['mode_a', 'mode_b', 'mode_c']),
  maxApiConcurrency: z.number().int().min(1).max(10),
  maxGitConcurrency: z.number().int().min(1).max(5),
  logRetentionDays: z.number().int().min(1).max(365),
  autoStartOnBoot: z.boolean(),
  autoOpenBrowser: z.boolean(),
});

export const batchMonitorSchema = z.object({
  repoIds: z.array(z.number()),
  enabled: z.boolean(),
});

export const batchSyncModeSchema = z.object({
  repoIds: z.array(z.number()),
  syncMode: z.enum(['mode_a', 'mode_b', 'mode_c']),
});
