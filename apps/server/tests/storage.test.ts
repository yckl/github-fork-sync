import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  initDb,
  closeDb,
  saveAccount,
  getAccount,
  deleteAccount,
  upsertRepositories,
  listRepositories,
  updateSyncConfig,
  getSettings,
  updateSettings,
  deleteRepository,
  deleteRepositories,
} from '../src/modules/storage/db.js';

describe('Storage & SQLite DAO Module', () => {
  const tempDbPath = path.join(os.tmpdir(), `gitforksync-test-${Date.now()}.db`);

  beforeAll(async () => {
    await initDb(tempDbPath);
  });

  afterAll(async () => {
    await closeDb();
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    } catch {
      // ignore
    }
  });

  it('should save account with encrypted token and retrieve masked account info', async () => {
    await saveAccount({
      githubId: 12345,
      login: 'testuser',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.png',
      authStatus: 'connected',
      encryptedToken: 'iv:tag:ciphertext',
      tokenHint: 'ghp_...1234',
      hasRepoAccess: true,
      hasWriteAccess: true,
    });

    const { account, encryptedToken } = await getAccount();
    expect(account).not.toBeNull();
    expect(account?.login).toBe('testuser');
    expect(account?.tokenHint).toBe('ghp_...1234');
    expect(encryptedToken).toBe('iv:tag:ciphertext');

    // Clean up
    await deleteAccount();
    const after = await getAccount();
    expect(after.account).toBeNull();
  });

  it('should upsert repositories and generate default sync config for forks', async () => {
    await upsertRepositories([
      {
        id: 1001,
        owner: 'myuser',
        name: 'my-fork',
        fullName: 'myuser/my-fork',
        htmlUrl: 'https://github.com/myuser/my-fork',
        isFork: true,
        isPrivate: false,
        isArchived: false,
        defaultBranch: 'main',
        parentRepoId: 2001,
        parentFullName: 'upstream/original',
        parentHtmlUrl: 'https://github.com/upstream/original',
        parentDefaultBranch: 'main',
      },
    ]);

    const repos = await listRepositories({ isFork: true });
    expect(repos.length).toBeGreaterThan(0);
    const target = repos.find((r) => r.id === 1001);
    expect(target).toBeDefined();
    expect(target?.syncConfig).not.toBeNull();
    expect(target?.syncConfig?.upstreamRepo).toBe('upstream/original');
    expect(target?.syncConfig?.targetBranch).toBe('upstream-sync');

    // Test updating sync config
    await updateSyncConfig(1001, {
      autoCheckEnabled: true,
      autoSyncEnabled: true,
      checkIntervalMinutes: 120,
    });

    const updated = await listRepositories({ monitoredOnly: true });
    expect(updated.some((r) => r.id === 1001)).toBe(true);
  });

  it('should read and update system settings', async () => {
    const settings = await getSettings();
    expect(settings.defaultTargetBranch).toBeDefined();

    await updateSettings({ defaultTargetBranch: 'upstream-sync-custom' });
    const updated = await getSettings();
    expect(updated.defaultTargetBranch).toBe('upstream-sync-custom');
  });

  it('should delete single and multiple repositories', async () => {
    // 1001 exists from previous test
    const before = await listRepositories();
    expect(before.some((r) => r.id === 1001)).toBe(true);

    await deleteRepository(1001);
    const after = await listRepositories();
    expect(after.some((r) => r.id === 1001)).toBe(false);

    // Upsert two more and batch delete
    await upsertRepositories([
      {
        id: 1002,
        owner: 'test',
        name: 'repo-a',
        fullName: 'test/repo-a',
        htmlUrl: 'https://github.com/test/repo-a',
        isFork: false,
        isPrivate: false,
        isArchived: false,
        defaultBranch: 'main',
        parentRepoId: null,
        parentFullName: null,
        parentHtmlUrl: null,
        parentDefaultBranch: null,
      },
      {
        id: 1003,
        owner: 'test',
        name: 'repo-b',
        fullName: 'test/repo-b',
        htmlUrl: 'https://github.com/test/repo-b',
        isFork: false,
        isPrivate: false,
        isArchived: false,
        defaultBranch: 'main',
        parentRepoId: null,
        parentFullName: null,
        parentHtmlUrl: null,
        parentDefaultBranch: null,
      },
    ]);

    const batchBefore = await listRepositories();
    expect(batchBefore.filter((r) => r.id === 1002 || r.id === 1003).length).toBe(2);

    await deleteRepositories([1002, 1003]);
    const batchAfter = await listRepositories();
    expect(batchAfter.filter((r) => r.id === 1002 || r.id === 1003).length).toBe(0);
  });
});
