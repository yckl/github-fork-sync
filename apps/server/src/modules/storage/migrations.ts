import type { Client } from '@libsql/client';
import { logger } from '../logging/logger.js';

export async function runMigrations(client: Client): Promise<void> {
  logger.info('Storage', 'Running SQLite migrations...');

  // Enable WAL mode & foreign keys
  await client.execute('PRAGMA journal_mode = WAL;');
  await client.execute('PRAGMA foreign_keys = ON;');
  await client.execute('PRAGMA synchronous = NORMAL;');

  // Migrations table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const res = await client.execute('SELECT MAX(version) as max_version FROM schema_migrations;');
  const currentVersion = (res.rows[0]?.max_version as number) || 0;

  if (currentVersion < 1) {
    logger.info('Storage', 'Applying schema migration v1...');
    
    // 1. Accounts
    await client.execute(`
      CREATE TABLE IF NOT EXISTS accounts (
        github_id INTEGER PRIMARY KEY,
        login TEXT NOT NULL,
        name TEXT,
        avatar_url TEXT NOT NULL,
        auth_status TEXT NOT NULL,
        encrypted_token TEXT NOT NULL,
        token_hint TEXT NOT NULL,
        has_repo_access INTEGER NOT NULL DEFAULT 1,
        has_write_access INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );
    `);

    // 2. Repositories
    await client.execute(`
      CREATE TABLE IF NOT EXISTS repositories (
        id INTEGER PRIMARY KEY,
        owner TEXT NOT NULL,
        name TEXT NOT NULL,
        full_name TEXT NOT NULL UNIQUE,
        html_url TEXT NOT NULL,
        is_fork INTEGER NOT NULL DEFAULT 0,
        is_private INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        default_branch TEXT NOT NULL,
        parent_repo_id INTEGER,
        parent_full_name TEXT,
        parent_html_url TEXT,
        parent_default_branch TEXT,
        discovered_at TEXT NOT NULL
      );
    `);

    // 3. SyncConfigs
    await client.execute(`
      CREATE TABLE IF NOT EXISTS sync_configs (
        repo_id INTEGER PRIMARY KEY,
        upstream_repo TEXT NOT NULL,
        upstream_branch TEXT NOT NULL,
        target_branch TEXT NOT NULL,
        sync_mode TEXT NOT NULL DEFAULT 'mode_a',
        auto_check_enabled INTEGER NOT NULL DEFAULT 0,
        auto_sync_enabled INTEGER NOT NULL DEFAULT 0,
        check_interval_minutes INTEGER NOT NULL DEFAULT 360,
        last_success_sha TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
      );
    `);

    // 4. LatestComparisons
    await client.execute(`
      CREATE TABLE IF NOT EXISTS latest_comparisons (
        repo_id INTEGER PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'up_to_date',
        upstream_sha TEXT,
        target_sha TEXT,
        ahead_by INTEGER NOT NULL DEFAULT 0,
        behind_by INTEGER NOT NULL DEFAULT 0,
        common_ancestor_sha TEXT,
        checked_at TEXT,
        error_message TEXT,
        commit_preview_json TEXT,
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
      );
    `);

    // 5. CheckRuns
    await client.execute(`
      CREATE TABLE IF NOT EXISTS check_runs (
        id TEXT PRIMARY KEY,
        repo_id INTEGER,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        upstream_sha TEXT,
        target_sha TEXT,
        comparison_status TEXT NOT NULL,
        ahead_by INTEGER NOT NULL DEFAULT 0,
        behind_by INTEGER NOT NULL DEFAULT 0,
        summary TEXT,
        error_message TEXT,
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
      );
    `);

    // 6. SyncRuns
    await client.execute(`
      CREATE TABLE IF NOT EXISTS sync_runs (
        id TEXT PRIMARY KEY,
        repo_id INTEGER,
        sync_mode TEXT NOT NULL,
        target_branch TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        before_sha TEXT,
        target_sha TEXT NOT NULL,
        after_sha TEXT,
        status TEXT NOT NULL,
        git_error TEXT,
        verification_result INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
      );
    `);

    // 7. Jobs
    await client.execute(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        repo_id INTEGER,
        repo_full_name TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        priority INTEGER NOT NULL DEFAULT 0,
        current_step TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );
    `);

    // 8. Settings
    await client.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // 9. Logs
    await client.execute(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        repo_id INTEGER,
        job_id TEXT,
        module TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT
      );
    `);

    // Initial default settings if not exists
    const defaultSettings = [
      ['defaultCheckIntervalMinutes', '360'],
      ['defaultTargetBranch', 'upstream-sync'],
      ['defaultSyncMode', 'mode_a'],
      ['maxApiConcurrency', '2'],
      ['maxGitConcurrency', '1'],
      ['logRetentionDays', '30'],
      ['autoStartOnBoot', 'false'],
      ['autoOpenBrowser', 'true'],
    ];

    for (const [key, val] of defaultSettings) {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);',
        args: [key, val],
      });
    }

    await client.execute({
      sql: 'INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?);',
      args: [new Date().toISOString()],
    });

    logger.info('Storage', 'Schema migration v1 applied successfully.');
  }
}
