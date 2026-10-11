import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runGitCommand } from '../src/modules/sync/gitRunner.js';
import { repoLock } from '../src/modules/scheduler/lock.js';

describe('Git Sync Engine & Local Repository Integration (14.2)', () => {
  let testRootDir: string;

  beforeAll(() => {
    testRootDir = path.join(os.tmpdir(), `gitsync_test_${Date.now()}`);
    fs.mkdirSync(testRootDir, { recursive: true });
  });

  afterAll(() => {
    try {
      if (fs.existsSync(testRootDir)) {
        fs.rmSync(testRootDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('should execute git command safely with argument array', async () => {
    const res = await runGitCommand(['--version'], { cwd: testRootDir });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('git version');
  });

  it('should enforce repo mutex lock to prevent concurrent sync operations', () => {
    const repoId = 999;
    const taskA = 'task-a';
    const taskB = 'task-b';

    expect(repoLock.tryAcquire(repoId, taskA)).toBe(true);
    // Concurrent task for same repo MUST fail
    expect(repoLock.tryAcquire(repoId, taskB)).toBe(false);

    // Release taskA
    repoLock.release(repoId, taskA);

    // Now taskB can acquire
    expect(repoLock.tryAcquire(repoId, taskB)).toBe(true);
    repoLock.release(repoId, taskB);
  });

  it('should execute real Git fetch and fast-forward push between local bare repositories', async () => {
    const upstreamBare = path.join(testRootDir, 'upstream.git');
    const forkBare = path.join(testRootDir, 'fork.git');
    const upstreamWork = path.join(testRootDir, 'upstream-work');
    const syncWork = path.join(testRootDir, 'sync-work');

    // 1. Initialize bare repos
    fs.mkdirSync(upstreamBare);
    fs.mkdirSync(forkBare);
    await runGitCommand(['init', '--bare'], { cwd: upstreamBare });
    await runGitCommand(['init', '--bare'], { cwd: forkBare });

    // 2. Clone upstream to make initial commit
    fs.mkdirSync(upstreamWork);
    await runGitCommand(['init'], { cwd: upstreamWork });
    await runGitCommand(['config', 'user.name', 'Tester'], { cwd: upstreamWork });
    await runGitCommand(['config', 'user.email', 'test@local'], { cwd: upstreamWork });
    await runGitCommand(['remote', 'add', 'origin', upstreamBare], { cwd: upstreamWork });

    fs.writeFileSync(path.join(upstreamWork, 'file1.txt'), 'version 1', 'utf8');
    await runGitCommand(['add', '.'], { cwd: upstreamWork });
    await runGitCommand(['commit', '-m', 'initial commit'], { cwd: upstreamWork });
    await runGitCommand(['branch', '-M', 'main'], { cwd: upstreamWork });
    await runGitCommand(['push', 'origin', 'main'], { cwd: upstreamWork });

    const upstreamSha1 = (await runGitCommand(['rev-parse', 'HEAD'], { cwd: upstreamWork })).stdout;

    // 3. Perform sync in syncWork: fetch upstream main -> push to forkBare:upstream-sync
    fs.mkdirSync(syncWork);
    await runGitCommand(['init'], { cwd: syncWork });
    await runGitCommand(['config', 'user.name', 'GitForkSync'], { cwd: syncWork });
    await runGitCommand(['config', 'user.email', 'bot@gitforksync.local'], { cwd: syncWork });
    await runGitCommand(['remote', 'add', 'upstream', upstreamBare], { cwd: syncWork });
    await runGitCommand(['remote', 'add', 'origin', forkBare], { cwd: syncWork });

    await runGitCommand(['fetch', 'upstream', 'main'], { cwd: syncWork });
    const fetchedSha = (await runGitCommand(['rev-parse', 'FETCH_HEAD'], { cwd: syncWork })).stdout;
    expect(fetchedSha).toBe(upstreamSha1);

    // Initial creation of upstream-sync on fork
    const pushRes = await runGitCommand(['push', 'origin', 'FETCH_HEAD:refs/heads/upstream-sync'], { cwd: syncWork });
    expect(pushRes.exitCode).toBe(0);

    // Verify forkBare has upstream-sync at upstreamSha1
    const forkSha1 = (await runGitCommand(['rev-parse', 'refs/heads/upstream-sync'], { cwd: forkBare })).stdout;
    expect(forkSha1).toBe(upstreamSha1);

    // 4. Add new commit to upstream (simulating 1 new commit upstream)
    fs.writeFileSync(path.join(upstreamWork, 'file2.txt'), 'version 2 upstream update', 'utf8');
    await runGitCommand(['add', '.'], { cwd: upstreamWork });
    await runGitCommand(['commit', '-m', 'upstream update 2'], { cwd: upstreamWork });
    await runGitCommand(['push', 'origin', 'main'], { cwd: upstreamWork });

    const upstreamSha2 = (await runGitCommand(['rev-parse', 'HEAD'], { cwd: upstreamWork })).stdout;
    expect(upstreamSha2).not.toBe(upstreamSha1);

    // 5. Fetch updated upstream in syncWork and fast-forward push to fork
    await runGitCommand(['fetch', 'upstream', 'main'], { cwd: syncWork });
    const fetchedSha2 = (await runGitCommand(['rev-parse', 'FETCH_HEAD'], { cwd: syncWork })).stdout;
    expect(fetchedSha2).toBe(upstreamSha2);

    // Safe non-forced push to fork
    const ffPushRes = await runGitCommand(['push', 'origin', 'FETCH_HEAD:refs/heads/upstream-sync'], { cwd: syncWork });
    expect(ffPushRes.exitCode).toBe(0);

    // 6. Verify fork SHA successfully updated to upstreamSha2
    const forkSha2 = (await runGitCommand(['rev-parse', 'refs/heads/upstream-sync'], { cwd: forkBare })).stdout;
    expect(forkSha2).toBe(upstreamSha2);
  });
});
