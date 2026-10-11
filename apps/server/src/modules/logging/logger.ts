import fs from 'fs';
import path from 'path';
import { config } from '../../config.js';
import type { LogItem, LogLevel } from '@gitforksync/shared';

const logFilePath = path.join(config.logDir, 'app.log');

// Regex patterns to mask sensitive tokens
const TOKEN_PATTERNS = [
  /ghp_[a-zA-Z0-9]{20,}/g,
  /github_pat_[a-zA-Z0-9_]{30,}/g,
  /Bearer\s+[a-zA-Z0-9_\-\.]+/gi,
];

export function sanitizeText(text: string): string {
  if (!text) return text;
  let sanitized = text;
  for (const pattern of TOKEN_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      const prefix = match.slice(0, 6);
      return `${prefix}***[REDACTED]`;
    });
  }
  return sanitized;
}

// In-memory ring buffer for fast query without DB lock
const MAX_MEM_LOGS = 500;
const memoryLogs: LogItem[] = [];
let nextLogId = 1;

// Callback to write log to SQLite once DB is initialized
let dbLogWriter: ((item: LogItem) => void) | null = null;

export function setDbLogWriter(writer: (item: LogItem) => void) {
  dbLogWriter = writer;
}

export function log(
  level: LogLevel,
  module: string,
  message: string,
  options?: {
    repoId?: number | null;
    jobId?: string | null;
    details?: any;
  }
) {
  const sanitizedMessage = sanitizeText(message);
  let sanitizedDetails: string | null = null;
  if (options?.details) {
    if (typeof options.details === 'string') {
      sanitizedDetails = sanitizeText(options.details);
    } else {
      try {
        sanitizedDetails = sanitizeText(JSON.stringify(options.details));
      } catch {
        sanitizedDetails = '[Unserializable details]';
      }
    }
  }

  const item: LogItem = {
    id: nextLogId++,
    timestamp: new Date().toISOString(),
    level,
    repoId: options?.repoId ?? null,
    jobId: options?.jobId ?? null,
    module,
    message: sanitizedMessage,
    details: sanitizedDetails,
  };

  memoryLogs.unshift(item);
  if (memoryLogs.length > MAX_MEM_LOGS) {
    memoryLogs.pop();
  }

  // Console output
  const prefix = `[${item.timestamp}] [${level.toUpperCase()}] [${module}]`;
  if (level === 'error') {
    console.error(prefix, sanitizedMessage, sanitizedDetails || '');
  } else if (level === 'warn') {
    console.warn(prefix, sanitizedMessage, sanitizedDetails || '');
  } else {
    console.log(prefix, sanitizedMessage, sanitizedDetails || '');
  }

  // File write
  try {
    const fileLine = `${item.timestamp} [${level.toUpperCase()}] [${module}] ${sanitizedMessage} ${
      sanitizedDetails ? `| Details: ${sanitizedDetails}` : ''
    }\n`;
    fs.appendFileSync(logFilePath, fileLine, 'utf8');
  } catch (err) {
    // avoid throwing in logger
  }

  // Persist to DB if ready
  if (dbLogWriter) {
    try {
      dbLogWriter(item);
    } catch {
      // ignore
    }
  }

  return item;
}

export const logger = {
  debug: (mod: string, msg: string, opts?: { repoId?: number | null; jobId?: string | null; details?: any }) =>
    log('debug', mod, msg, opts),
  info: (mod: string, msg: string, opts?: { repoId?: number | null; jobId?: string | null; details?: any }) =>
    log('info', mod, msg, opts),
  warn: (mod: string, msg: string, opts?: { repoId?: number | null; jobId?: string | null; details?: any }) =>
    log('warn', mod, msg, opts),
  error: (mod: string, msg: string, opts?: { repoId?: number | null; jobId?: string | null; details?: any }) =>
    log('error', mod, msg, opts),
  getRecentLogs: () => [...memoryLogs],
};
