import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from '../../config.js';
import { logger, sanitizeText } from '../logging/logger.js';

let askPassScriptPath: string | null = null;

function ensureAskPassScript(): string {
  if (askPassScriptPath && fs.existsSync(askPassScriptPath)) {
    return askPassScriptPath;
  }
  const scriptPath = path.join(config.appDataDir, 'askpass.js');
  const code = `
    const prompt = (process.argv[2] || '').toLowerCase();
    if (prompt.includes('username')) {
      console.log('x-access-token');
    } else {
      console.log(process.env.GIT_FORK_SYNC_TOKEN || '');
    }
  `;
  fs.writeFileSync(scriptPath, code.trim(), 'utf8');
  askPassScriptPath = scriptPath;
  return askPassScriptPath;
}

export interface GitExecOptions {
  cwd: string;
  token?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runGitCommand(
  args: string[],
  options: GitExecOptions
): Promise<GitExecResult> {
  return new Promise((resolve, reject) => {
    const askPass = ensureAskPassScript();
    const timeout = options.timeoutMs || 90000;

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: `node "${askPass}"`,
      ...(options.env || {}),
    };

    if (options.token) {
      env.GIT_FORK_SYNC_TOKEN = options.token;
    }

    const sanitizedArgs = args.map(sanitizeText);
    logger.debug('GitRunner', `Executing: git ${sanitizedArgs.join(' ')} in ${options.cwd}`);

    const proc = spawn('git', args, {
      cwd: options.cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false, // Prevents shell injection
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {}
      reject(new Error(`Git 命令执行超时 (${timeout}ms): git ${sanitizedArgs.join(' ')}`));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const cleanStdout = sanitizeText(stdout.trim());
      const cleanStderr = sanitizeText(stderr.trim());

      if (code !== 0) {
        logger.warn('GitRunner', `Git command failed with code ${code}: ${cleanStderr}`);
      }

      resolve({
        stdout: cleanStdout,
        stderr: cleanStderr,
        exitCode: code ?? 1,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Git 执行异常: ${sanitizeText(err.message)}`));
    });
  });
}
