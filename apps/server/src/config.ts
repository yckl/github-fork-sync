import path from 'path';
import os from 'os';
import fs from 'fs';

export interface AppConfig {
  port: number;
  host: string;
  appDataDir: string;
  dbPath: string;
  logDir: string;
  tempGitDir: string;
  masterKeyPath: string;
  lockFilePath: string;
  isDev: boolean;
}

export function loadConfig(): AppConfig {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const appDataDir = path.join(localAppData, 'GitForkSync');
  const logDir = path.join(appDataDir, 'logs');
  const tempGitDir = path.join(appDataDir, 'temp');
  const dbPath = path.join(appDataDir, 'data.db');
  const masterKeyPath = path.join(appDataDir, 'master.key');
  const lockFilePath = path.join(appDataDir, 'app.lock');

  // Ensure directories exist
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  if (!fs.existsSync(tempGitDir)) {
    fs.mkdirSync(tempGitDir, { recursive: true });
  }

  const port = parseInt(process.env.PORT || '3847', 10);
  const host = process.env.HOST || '127.0.0.1';
  const isDev = process.env.NODE_ENV !== 'production';

  return {
    port,
    host,
    appDataDir,
    dbPath,
    logDir,
    tempGitDir,
    masterKeyPath,
    lockFilePath,
    isDev,
  };
}

export const config = loadConfig();
