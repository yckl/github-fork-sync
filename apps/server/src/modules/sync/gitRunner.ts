import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from '../../config.js';
import { logger, sanitizeText } from '../logging/logger.js';

let askPassScriptPath: string | null = null;
let cachedProxy: string | null | undefined = undefined;

export function getEffectiveProxy(): string | null {
  // 1. Check process environment variables
  const envProxy =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy ||
    process.env.all_proxy;

  if (envProxy) {
    let p = envProxy.trim();
    if (!p.startsWith('http://') && !p.startsWith('https://')) {
      p = `http://${p}`;
    }
    return p;
  }

  // 2. Return cached Windows system proxy if already resolved
  if (cachedProxy !== undefined) {
    return cachedProxy;
  }

  // 3. Auto-detect Windows system proxy from Registry
  if (process.platform === 'win32') {
    try {
      const out = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000,
      });
      const enableMatch = out.match(/ProxyEnable\s+REG_DWORD\s+(0x[0-9a-fA-F]+|[0-9]+)/);
      const serverMatch = out.match(/ProxyServer\s+REG_SZ\s+([^\r\n]+)/);
      const isEnabled = enableMatch
        ? (parseInt(enableMatch[1], 16) || parseInt(enableMatch[1], 10)) === 1
        : false;

      if (isEnabled && serverMatch) {
        let server = serverMatch[1].trim();
        if (server.includes('=')) {
          const httpsMatch = server.match(/https=([^;]+)/);
          const httpMatch = server.match(/http=([^;]+)/);
          server = httpsMatch ? httpsMatch[1] : httpMatch ? httpMatch[1] : server;
        }
        if (!server.startsWith('http://') && !server.startsWith('https://')) {
          server = `http://${server}`;
        }
        cachedProxy = server;
        logger.info('GitRunner', `自动识别到 Windows 代理配置: ${server}，已为 Git 网络操作启用代理加速`);
        return cachedProxy;
      }
    } catch {}
  }

  cachedProxy = null;
  return null;
}

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
    const effectiveProxy = getEffectiveProxy();

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: `node "${askPass}"`,
      ...(effectiveProxy
        ? {
            HTTP_PROXY: effectiveProxy,
            HTTPS_PROXY: effectiveProxy,
            ALL_PROXY: effectiveProxy,
            http_proxy: effectiveProxy,
            https_proxy: effectiveProxy,
            all_proxy: effectiveProxy,
          }
        : {}),
      ...(options.env || {}),
    };

    if (options.token) {
      env.GIT_FORK_SYNC_TOKEN = options.token;
    }

    // Automatically prepend git proxy flags if a proxy is detected
    const finalArgs = effectiveProxy
      ? ['-c', `http.proxy=${effectiveProxy}`, '-c', `https.proxy=${effectiveProxy}`, ...args]
      : args;

    const sanitizedArgs = finalArgs.map(sanitizeText);
    logger.debug('GitRunner', `Executing: git ${sanitizedArgs.join(' ')} in ${options.cwd}`);

    const proc = spawn('git', finalArgs, {
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
