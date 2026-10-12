import { createClient, type Client } from '@libsql/client';
import { config } from '../../config.js';
import { runMigrations } from './migrations.js';
import { logger, setDbLogWriter } from '../logging/logger.js';
import type {
  AccountInfo,
  RepositoryItem,
  SyncConfig,
  LatestComparison,
  CheckRunRecord,
  SyncRunRecord,
  JobRecord,
  SystemSettings,
  LogItem,
  LogLevel,
} from '@gitforksync/shared';

let dbClient: Client | null = null;

export async function initDb(customDbPath?: string): Promise<Client> {
  if (dbClient) {
    return dbClient;
  }

  const resolvedPath = customDbPath || process.env.GITFORKSYNC_DB_PATH || config.dbPath;
  const url = `file:${resolvedPath.replace(/\\/g, '/')}`;
  logger.info('Storage', `Initializing SQLite database at: ${url}`);
  dbClient = createClient({ url });

  await runMigrations(dbClient);

  // Hook up logger to write logs to DB asynchronously
  setDbLogWriter((item) => {
    if (!dbClient) return;
    dbClient
      .execute({
        sql: `INSERT INTO logs (timestamp, level, repo_id, job_id, module, message, details) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        args: [
          item.timestamp,
          item.level,
          item.repoId ?? null,
          item.jobId ?? null,
          item.module,
          item.message,
          item.details ?? null,
        ],
      })
      .catch(() => {});
  });

  return dbClient;
}

export function getDb(): Client {
  if (!dbClient) {
    throw new Error('Database has not been initialized yet');
  }
  return dbClient;
}

export async function closeDb(): Promise<void> {
  if (dbClient) {
    dbClient.close();
    dbClient = null;
  }
}

// ==================== Accounts DAO ====================

export async function getAccount(): Promise<{ account: AccountInfo | null; encryptedToken: string | null }> {
  const db = getDb();
  const res = await db.execute('SELECT * FROM accounts LIMIT 1;');
  if (res.rows.length === 0) {
    return { account: null, encryptedToken: null };
  }
  const row = res.rows[0];
  const account: AccountInfo = {
    githubId: row.github_id as number,
    login: row.login as string,
    name: (row.name as string) || null,
    avatarUrl: row.avatar_url as string,
    authStatus: row.auth_status as any,
    tokenHint: row.token_hint as string,
    hasRepoAccess: Boolean(row.has_repo_access),
    hasWriteAccess: Boolean(row.has_write_access),
    updatedAt: row.updated_at as string,
  };
  return { account, encryptedToken: row.encrypted_token as string };
}

export async function saveAccount(data: {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  authStatus: string;
  encryptedToken: string;
  tokenHint: string;
  hasRepoAccess: boolean;
  hasWriteAccess: boolean;
}): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute('DELETE FROM accounts;');
  await db.execute({
    sql: `INSERT INTO accounts (
      github_id, login, name, avatar_url, auth_status, encrypted_token, token_hint, has_repo_access, has_write_access, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    args: [
      data.githubId,
      data.login,
      data.name,
      data.avatarUrl,
      data.authStatus,
      data.encryptedToken,
      data.tokenHint,
      data.hasRepoAccess ? 1 : 0,
      data.hasWriteAccess ? 1 : 0,
      now,
    ],
  });
}

export async function deleteAccount(): Promise<void> {
  const db = getDb();
  await db.execute('DELETE FROM accounts;');
}

// ==================== Repositories DAO ====================

export async function upsertRepositories(repos: Array<{
  id: number;
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  isFork: boolean;
  isPrivate: boolean;
  isArchived: boolean;
  defaultBranch: string;
  parentRepoId: number | null;
  parentFullName: string | null;
  parentHtmlUrl: string | null;
  parentDefaultBranch: string | null;
}>): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  // Get default sync settings
  const settings = await getSettings();

  for (const r of repos) {
    await db.execute({
      sql: `INSERT INTO repositories (
        id, owner, name, full_name, html_url, is_fork, is_private, is_archived, default_branch,
        parent_repo_id, parent_full_name, parent_html_url, parent_default_branch, discovered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        owner = excluded.owner,
        name = excluded.name,
        full_name = excluded.full_name,
        html_url = excluded.html_url,
        is_fork = excluded.is_fork,
        is_private = excluded.is_private,
        is_archived = excluded.is_archived,
        default_branch = excluded.default_branch,
        parent_repo_id = excluded.parent_repo_id,
        parent_full_name = excluded.parent_full_name,
        parent_html_url = excluded.parent_html_url,
        parent_default_branch = excluded.parent_default_branch;`,
      args: [
        r.id,
        r.owner,
        r.name,
        r.fullName,
        r.htmlUrl,
        r.isFork ? 1 : 0,
        r.isPrivate ? 1 : 0,
        r.isArchived ? 1 : 0,
        r.defaultBranch,
        r.parentRepoId,
        r.parentFullName,
        r.parentHtmlUrl,
        r.parentDefaultBranch,
        now,
      ],
    });

    // If it's a fork and doesn't have sync config yet, create default
    if (r.isFork && r.parentFullName) {
      const targetBranch = settings.defaultSyncMode === 'mode_b' ? (r.defaultBranch || 'main') : settings.defaultTargetBranch;
      await db.execute({
        sql: `INSERT OR IGNORE INTO sync_configs (
          repo_id, upstream_repo, upstream_branch, target_branch, sync_mode, auto_check_enabled, auto_sync_enabled, check_interval_minutes, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?);`,
        args: [
          r.id,
          r.parentFullName,
          r.parentDefaultBranch || 'main',
          targetBranch,
          settings.defaultSyncMode,
          settings.defaultCheckIntervalMinutes,
          now,
        ],
      });
    }
  }
}

export async function listRepositories(filter?: {
  search?: string;
  isFork?: boolean;
  monitoredOnly?: boolean;
  status?: string;
}): Promise<RepositoryItem[]> {
  const db = getDb();
  let sql = `
    SELECT 
      r.*,
      sc.upstream_repo, sc.upstream_branch, sc.target_branch, sc.sync_mode,
      sc.auto_check_enabled, sc.auto_sync_enabled, sc.check_interval_minutes,
      sc.last_success_sha, sc.updated_at as config_updated_at,
      lc.status as comp_status, lc.upstream_sha, lc.target_sha, lc.ahead_by,
      lc.behind_by, lc.common_ancestor_sha, lc.checked_at, lc.error_message as comp_error,
      lc.commit_preview_json
    FROM repositories r
    LEFT JOIN sync_configs sc ON r.id = sc.repo_id
    LEFT JOIN latest_comparisons lc ON r.id = lc.repo_id
    WHERE 1=1
  `;
  const args: any[] = [];

  if (filter?.search) {
    sql += ` AND (r.full_name LIKE ? OR sc.upstream_repo LIKE ?)`;
    const searchPattern = `%${filter.search}%`;
    args.push(searchPattern, searchPattern);
  }

  if (typeof filter?.isFork === 'boolean') {
    sql += ` AND r.is_fork = ?`;
    args.push(filter.isFork ? 1 : 0);
  }

  if (filter?.monitoredOnly) {
    sql += ` AND sc.auto_check_enabled = 1`;
  }

  if (filter?.status) {
    sql += ` AND lc.status = ?`;
    args.push(filter.status);
  }

  sql += ` ORDER BY r.is_fork DESC, r.name ASC`;

  const res = await db.execute({ sql, args });

  return res.rows.map((row) => {
    let syncConfig: SyncConfig | null = null;
    if (row.upstream_repo) {
      syncConfig = {
        repoId: row.id as number,
        upstreamRepo: row.upstream_repo as string,
        upstreamBranch: row.upstream_branch as string,
        targetBranch: row.target_branch as string,
        syncMode: row.sync_mode as any,
        autoCheckEnabled: Boolean(row.auto_check_enabled),
        autoSyncEnabled: Boolean(row.auto_sync_enabled),
        checkIntervalMinutes: row.check_interval_minutes as number,
        lastSuccessSha: (row.last_success_sha as string) || null,
        updatedAt: row.config_updated_at as string,
      };
    }

    let latestComparison: LatestComparison | null = null;
    if (!row.is_fork && !row.upstream_repo) {
      latestComparison = {
        status: 'self_owned',
        upstreamSha: null,
        targetSha: null,
        aheadBy: 0,
        behindBy: 0,
        commonAncestorSha: null,
        checkedAt: row.checked_at ? (row.checked_at as string) : null,
        errorMessage: null,
      };
    } else if (row.checked_at || row.comp_status) {
      let commitPreview: any = undefined;
      if (row.commit_preview_json) {
        try {
          commitPreview = JSON.parse(row.commit_preview_json as string);
        } catch {}
      }

      latestComparison = {
        status: (row.comp_status as any) || 'unknown',
        upstreamSha: (row.upstream_sha as string) || null,
        targetSha: (row.target_sha as string) || null,
        aheadBy: (row.ahead_by as number) || 0,
        behindBy: (row.behind_by as number) || 0,
        commonAncestorSha: (row.common_ancestor_sha as string) || null,
        checkedAt: (row.checked_at as string) || null,
        errorMessage: (row.comp_error as string) || null,
        commitPreview,
      };
    }

    return {
      id: row.id as number,
      owner: row.owner as string,
      name: row.name as string,
      fullName: row.full_name as string,
      htmlUrl: row.html_url as string,
      isFork: Boolean(row.is_fork),
      isPrivate: Boolean(row.is_private),
      isArchived: Boolean(row.is_archived),
      defaultBranch: row.default_branch as string,
      parentRepoId: (row.parent_repo_id as number) || null,
      parentFullName: (row.parent_full_name as string) || null,
      parentHtmlUrl: (row.parent_html_url as string) || null,
      parentDefaultBranch: (row.parent_default_branch as string) || null,
      discoveredAt: row.discovered_at as string,
      syncConfig,
      latestComparison,
    };
  });
}

export async function getRepositoryById(id: number): Promise<RepositoryItem | null> {
  const repos = await listRepositories();
  return repos.find((r) => r.id === id) || null;
}

export async function deleteRepository(id: number): Promise<void> {
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM sync_configs WHERE repo_id = ?;', args: [id] });
  await db.execute({ sql: 'DELETE FROM latest_comparisons WHERE repo_id = ?;', args: [id] });
  await db.execute({ sql: 'DELETE FROM check_runs WHERE repo_id = ?;', args: [id] });
  await db.execute({ sql: 'DELETE FROM sync_runs WHERE repo_id = ?;', args: [id] });
  await db.execute({ sql: 'DELETE FROM jobs WHERE repo_id = ?;', args: [id] });
  await db.execute({ sql: 'DELETE FROM repositories WHERE id = ?;', args: [id] });
}

export async function deleteRepositories(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  await db.execute({ sql: `DELETE FROM sync_configs WHERE repo_id IN (${placeholders});`, args: ids });
  await db.execute({ sql: `DELETE FROM latest_comparisons WHERE repo_id IN (${placeholders});`, args: ids });
  await db.execute({ sql: `DELETE FROM check_runs WHERE repo_id IN (${placeholders});`, args: ids });
  await db.execute({ sql: `DELETE FROM sync_runs WHERE repo_id IN (${placeholders});`, args: ids });
  await db.execute({ sql: `DELETE FROM jobs WHERE repo_id IN (${placeholders});`, args: ids });
  await db.execute({ sql: `DELETE FROM repositories WHERE id IN (${placeholders});`, args: ids });
}

export async function updateSyncConfig(
  repoId: number,
  configData: Partial<SyncConfig>
): Promise<void> {
  const db = getDb();
  const existing = await db.execute({
    sql: 'SELECT * FROM sync_configs WHERE repo_id = ?;',
    args: [repoId],
  });

  const now = new Date().toISOString();
  if (existing.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO sync_configs (
        repo_id, upstream_repo, upstream_branch, target_branch, sync_mode, auto_check_enabled, auto_sync_enabled, check_interval_minutes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      args: [
        repoId,
        configData.upstreamRepo || '',
        configData.upstreamBranch || 'main',
        configData.targetBranch || 'upstream-sync',
        configData.syncMode || 'mode_a',
        configData.autoCheckEnabled ? 1 : 0,
        configData.autoSyncEnabled ? 1 : 0,
        configData.checkIntervalMinutes || 360,
        now,
      ],
    });
  } else {
    const cur = existing.rows[0];
    await db.execute({
      sql: `UPDATE sync_configs SET
        upstream_repo = ?,
        upstream_branch = ?,
        target_branch = ?,
        sync_mode = ?,
        auto_check_enabled = ?,
        auto_sync_enabled = ?,
        check_interval_minutes = ?,
        updated_at = ?
      WHERE repo_id = ?;`,
      args: [
        configData.upstreamRepo ?? cur.upstream_repo,
        configData.upstreamBranch ?? cur.upstream_branch,
        configData.targetBranch ?? cur.target_branch,
        configData.syncMode ?? cur.sync_mode,
        configData.autoCheckEnabled !== undefined ? (configData.autoCheckEnabled ? 1 : 0) : cur.auto_check_enabled,
        configData.autoSyncEnabled !== undefined ? (configData.autoSyncEnabled ? 1 : 0) : cur.auto_sync_enabled,
        configData.checkIntervalMinutes ?? cur.check_interval_minutes,
        now,
        repoId,
      ],
    });
  }
}

export async function updateLatestComparison(
  repoId: number,
  comp: LatestComparison
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO latest_comparisons (
      repo_id, status, upstream_sha, target_sha, ahead_by, behind_by, common_ancestor_sha, checked_at, error_message, commit_preview_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(repo_id) DO UPDATE SET
      status = excluded.status,
      upstream_sha = excluded.upstream_sha,
      target_sha = excluded.target_sha,
      ahead_by = excluded.ahead_by,
      behind_by = excluded.behind_by,
      common_ancestor_sha = excluded.common_ancestor_sha,
      checked_at = excluded.checked_at,
      error_message = excluded.error_message,
      commit_preview_json = excluded.commit_preview_json;`,
    args: [
      repoId,
      comp.status,
      comp.upstreamSha,
      comp.targetSha,
      comp.aheadBy,
      comp.behindBy,
      comp.commonAncestorSha,
      comp.checkedAt,
      comp.errorMessage,
      comp.commitPreview ? JSON.stringify(comp.commitPreview) : null,
    ],
  });
}

// ==================== CheckRuns DAO ====================

export async function createCheckRun(record: CheckRunRecord): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO check_runs (
      id, repo_id, started_at, finished_at, upstream_sha, target_sha, comparison_status, ahead_by, behind_by, summary, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    args: [
      record.id,
      record.repoId,
      record.startedAt,
      record.finishedAt,
      record.upstreamSha,
      record.targetSha,
      record.comparisonStatus,
      record.aheadBy,
      record.behindBy,
      record.summary,
      record.errorMessage,
    ],
  });
}

export async function getCheckRuns(repoId?: number, limit = 20): Promise<CheckRunRecord[]> {
  const db = getDb();
  let sql = `
    SELECT cr.*, r.name as repo_name, r.full_name as repo_full_name
    FROM check_runs cr
    LEFT JOIN repositories r ON cr.repo_id = r.id
  `;
  const args: any[] = [];
  if (repoId) {
    sql += ' WHERE cr.repo_id = ?';
    args.push(repoId);
  }
  sql += ' ORDER BY cr.started_at DESC LIMIT ?;';
  args.push(limit);

  const res = await db.execute({ sql, args });
  return res.rows.map((row) => ({
    id: row.id as string,
    repoId: row.repo_id as number,
    repoName: (row.repo_name as string) || null,
    repoFullName: (row.repo_full_name as string) || null,
    startedAt: row.started_at as string,
    finishedAt: row.finished_at as string,
    upstreamSha: (row.upstream_sha as string) || null,
    targetSha: (row.target_sha as string) || null,
    comparisonStatus: row.comparison_status as any,
    aheadBy: (row.ahead_by as number) || 0,
    behindBy: (row.behind_by as number) || 0,
    summary: (row.summary as string) || null,
    errorMessage: (row.error_message as string) || null,
  }));
}

// ==================== SyncRuns DAO ====================

export async function createSyncRun(record: SyncRunRecord): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO sync_runs (
      id, repo_id, sync_mode, target_branch, started_at, finished_at, before_sha, target_sha, after_sha, status, git_error, verification_result
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    args: [
      record.id,
      record.repoId,
      record.syncMode,
      record.targetBranch,
      record.startedAt,
      record.finishedAt,
      record.beforeSha,
      record.targetSha,
      record.afterSha,
      record.status,
      record.gitError,
      record.verificationResult ? 1 : 0,
    ],
  });

  // If sync was successful, update last_success_sha in sync_configs
  if (record.status === 'success' && record.afterSha) {
    await db.execute({
      sql: 'UPDATE sync_configs SET last_success_sha = ? WHERE repo_id = ?;',
      args: [record.afterSha, record.repoId],
    });
  }
}

export async function getSyncRuns(repoId?: number, limit = 20): Promise<SyncRunRecord[]> {
  const db = getDb();
  let sql = `
    SELECT sr.*, r.name as repo_name, r.full_name as repo_full_name
    FROM sync_runs sr
    LEFT JOIN repositories r ON sr.repo_id = r.id
  `;
  const args: any[] = [];
  if (repoId) {
    sql += ' WHERE sr.repo_id = ?';
    args.push(repoId);
  }
  sql += ' ORDER BY sr.started_at DESC LIMIT ?;';
  args.push(limit);

  const res = await db.execute({ sql, args });
  return res.rows.map((row) => ({
    id: row.id as string,
    repoId: row.repo_id as number,
    repoName: (row.repo_name as string) || null,
    repoFullName: (row.repo_full_name as string) || null,
    syncMode: row.sync_mode as any,
    targetBranch: row.target_branch as string,
    startedAt: row.started_at as string,
    finishedAt: row.finished_at as string,
    beforeSha: (row.before_sha as string) || null,
    targetSha: row.target_sha as string,
    afterSha: (row.after_sha as string) || null,
    status: row.status as any,
    gitError: (row.git_error as string) || null,
    verificationResult: Boolean(row.verification_result),
  }));
}

// ==================== Jobs DAO ====================

export async function createJob(job: JobRecord): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO jobs (
      id, type, repo_id, repo_full_name, status, attempts, priority, current_step, error, created_at, started_at, finished_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    args: [
      job.id,
      job.type,
      job.repoId,
      job.repoFullName,
      job.status,
      job.attempts,
      job.priority,
      job.currentStep,
      job.error,
      job.createdAt,
      job.startedAt,
      job.finishedAt,
    ],
  });
}

export async function updateJob(
  id: string,
  update: {
    status?: JobRecord['status'];
    currentStep?: string | null;
    error?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    attempts?: number;
  }
): Promise<void> {
  const db = getDb();
  const existing = await db.execute({
    sql: 'SELECT * FROM jobs WHERE id = ?;',
    args: [id],
  });
  if (existing.rows.length === 0) return;
  const cur = existing.rows[0];

  await db.execute({
    sql: `UPDATE jobs SET
      status = ?,
      current_step = ?,
      error = ?,
      started_at = ?,
      finished_at = ?,
      attempts = ?
    WHERE id = ?;`,
    args: [
      update.status ?? cur.status,
      update.currentStep !== undefined ? update.currentStep : cur.current_step,
      update.error !== undefined ? update.error : cur.error,
      update.startedAt !== undefined ? update.startedAt : cur.started_at,
      update.finishedAt !== undefined ? update.finishedAt : cur.finished_at,
      update.attempts !== undefined ? update.attempts : cur.attempts,
      id,
    ],
  });
}

export async function listJobs(limit = 50): Promise<JobRecord[]> {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?;',
    args: [limit],
  });
  return res.rows.map((row) => ({
    id: row.id as string,
    type: row.type as any,
    repoId: (row.repo_id as number) || null,
    repoFullName: (row.repo_full_name as string) || null,
    status: row.status as any,
    attempts: (row.attempts as number) || 0,
    priority: (row.priority as number) || 0,
    currentStep: (row.current_step as string) || null,
    error: (row.error as string) || null,
    createdAt: row.created_at as string,
    startedAt: (row.started_at as string) || null,
    finishedAt: (row.finished_at as string) || null,
  }));
}

export async function recoverInterruptedJobs(): Promise<void> {
  const db = getDb();
  // Mark running jobs as failed with recovery notice
  await db.execute(`UPDATE jobs SET status = 'failed', error = '系统重启，任务意外中断' WHERE status = 'running';`);
}

export async function clearJobs(): Promise<void> {
  const db = getDb();
  await db.execute('DELETE FROM jobs;');
}

// ==================== Settings DAO ====================

export async function getSettings(): Promise<SystemSettings> {
  const db = getDb();
  const res = await db.execute('SELECT * FROM settings;');
  const map = new Map<string, string>();
  for (const row of res.rows) {
    map.set(row.key as string, row.value as string);
  }

  return {
    defaultCheckIntervalMinutes: parseInt(map.get('defaultCheckIntervalMinutes') || '360', 10),
    defaultTargetBranch: map.get('defaultTargetBranch') || 'upstream-sync',
    defaultSyncMode: (map.get('defaultSyncMode') as any) || 'mode_a',
    maxApiConcurrency: parseInt(map.get('maxApiConcurrency') || '2', 10),
    maxGitConcurrency: parseInt(map.get('maxGitConcurrency') || '1', 10),
    logRetentionDays: parseInt(map.get('logRetentionDays') || '30', 10),
    autoStartOnBoot: map.get('autoStartOnBoot') === 'true',
    autoOpenBrowser: map.get('autoOpenBrowser') !== 'false',
  };
}

export async function updateSettings(settings: Partial<SystemSettings>): Promise<void> {
  const db = getDb();
  for (const [key, val] of Object.entries(settings)) {
    if (val !== undefined) {
      await db.execute({
        sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
        args: [key, String(val)],
      });
    }
  }
}

export async function applyDefaultSyncSettingsToAllForks(): Promise<number> {
  const db = getDb();
  const settings = await getSettings();
  const repos = await listRepositories({ isFork: true });
  let count = 0;
  const now = new Date().toISOString();
  for (const r of repos) {
    const targetBranch = settings.defaultSyncMode === 'mode_b' ? (r.defaultBranch || 'main') : settings.defaultTargetBranch;
    await db.execute({
      sql: `UPDATE sync_configs SET sync_mode = ?, target_branch = ?, updated_at = ? WHERE repo_id = ?;`,
      args: [settings.defaultSyncMode, targetBranch, now, r.id],
    });
    count++;
  }
  return count;
}

// ==================== Logs DAO ====================

export async function queryLogs(params: {
  level?: LogLevel;
  repoId?: number;
  search?: string;
  limit?: number;
}): Promise<LogItem[]> {
  const db = getDb();
  let sql = 'SELECT * FROM logs WHERE 1=1';
  const args: any[] = [];

  if (params.level) {
    sql += ' AND level = ?';
    args.push(params.level);
  }
  if (params.repoId) {
    sql += ' AND repo_id = ?';
    args.push(params.repoId);
  }
  if (params.search) {
    sql += ' AND (message LIKE ? OR module LIKE ?)';
    const p = `%${params.search}%`;
    args.push(p, p);
  }

  sql += ' ORDER BY id DESC LIMIT ?;';
  args.push(params.limit || 100);

  const res = await db.execute({ sql, args });
  return res.rows.map((row) => ({
    id: row.id as number,
    timestamp: row.timestamp as string,
    level: row.level as any,
    repoId: (row.repo_id as number) || null,
    jobId: (row.job_id as string) || null,
    module: row.module as string,
    message: row.message as string,
    details: (row.details as string) || null,
  }));
}
