import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { config } from './config.js';
import { logger } from './modules/logging/logger.js';
import { initDb, getSettings } from './modules/storage/db.js';
import { startScheduler, stopScheduler } from './modules/scheduler/schedulerService.js';
import { acquireSingleInstanceLock } from './modules/security/singleInstance.js';
import { authRoutes } from './routes/authRoutes.js';
import { repoRoutes } from './routes/repoRoutes.js';
import { jobRoutes } from './routes/jobRoutes.js';
import { dashboardRoutes } from './routes/dashboardRoutes.js';
import { settingRoutes } from './routes/settingRoutes.js';
import { logRoutes } from './routes/logRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createServer() {
  const server = Fastify({
    logger: false, // We use custom structured logger
    bodyLimit: 10 * 1024 * 1024,
  });

  // Allow empty JSON bodies on POST/PATCH requests
  server.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, defaultDone) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      defaultDone(null, {});
      return;
    }
    try {
      defaultDone(null, JSON.parse(body as string));
    } catch (err: any) {
      defaultDone(err, undefined);
    }
  });

  server.addContentTypeParser(['application/x-www-form-urlencoded', 'text/plain'], { parseAs: 'string' }, (req, body, defaultDone) => {
    defaultDone(null, {});
  });

  server.setErrorHandler((error, request, reply) => {
    logger.error('Server', `API 错误: ${error.message}`, { details: error.stack });
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: error.message || '服务器内部错误',
    });
  });

  // CORS for local development
  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  // Register API routes
  await server.register(authRoutes);
  await server.register(repoRoutes);
  await server.register(jobRoutes);
  await server.register(dashboardRoutes);
  await server.register(settingRoutes);
  await server.register(logRoutes);

  // Serve static web build if present
  const clientDistPath = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(clientDistPath)) {
    logger.info('Server', `Serving static web client from: ${clientDistPath}`);
    await server.register(fastifyStatic, {
      root: clientDistPath,
      prefix: '/',
    });

    server.setNotFoundHandler((request, reply) => {
      if (request.raw.url && request.raw.url.startsWith('/api')) {
        return reply.status(404).send({ success: false, error: 'API 端点不存在' });
      }
      return reply.sendFile('index.html');
    });
  }

  return server;
}

export async function startApp() {
  logger.info('App', '=======================================================');
  logger.info('App', '   GitHub Fork 自动同步管理器 (Windows 本地版) 启动中   ');
  logger.info('App', '=======================================================');

  // 1. Single instance lock check
  if (!acquireSingleInstanceLock()) {
    logger.error('App', '已有 GitHub Fork 同步管理器在运行！请勿重复启动多个实例。');
    console.error('\n[错误] 检测到程序已在后台运行中，禁止重复启动多实例！\n');
    process.exit(1);
  }

  // 2. Initialize Database & run migrations
  try {
    await initDb();
  } catch (err: any) {
    logger.error('App', `数据库初始化失败: ${err.message}`);
    process.exit(1);
  }

  // 3. Start task scheduler
  startScheduler();

  // 4. Create and start HTTP server with auto port resolution
  const server = await createServer();
  let port = config.port;
  let bound = false;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await server.listen({ port, host: config.host });
      bound = true;
      break;
    } catch (err: any) {
      if (err.code === 'EADDRINUSE') {
        logger.warn('Server', `端口 ${port} 已被占用，正在尝试端口 ${port + 1}...`);
        port++;
      } else {
        throw err;
      }
    }
  }

  if (!bound) {
    logger.error('Server', '未能成功绑定可用端口，请检查网络设置。');
    process.exit(1);
  }

  const appUrl = `http://127.0.0.1:${port}`;
  logger.info('Server', `服务已启动，本地访问地址: ${appUrl}`);
  console.log(`
+------------------------------------------------------------------------+
|       GitForkSync - GitHub Fork 自动同步管理器 (Windows 本地版)        |
+------------------------------------------------------------------------+
  [运行状态] 正常运行中
  [本地地址] ${appUrl}
  [数据目录] ${config.appDataDir}
  [日志文件] ${config.logDir}\\app.log
+------------------------------------------------------------------------+
  * 浏览器已自动打开管理控制台网页。
  * 关闭浏览器网页不会影响同步，本窗口将持续在后台检测和同步。
  * 如需完全退出程序，请按 Ctrl + C 或直接关闭本控制台窗口。
+------------------------------------------------------------------------+
`);

  // 5. Open browser if configured
  try {
    const settings = await getSettings();
    if (settings.autoOpenBrowser) {
      setTimeout(() => {
        exec(`start ${appUrl}`);
      }, 1000);
    }
  } catch {}

  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info('App', 'Shutting down server...');
    stopScheduler();
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
