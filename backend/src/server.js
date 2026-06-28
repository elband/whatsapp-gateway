import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectPrisma, disconnectPrisma } from './config/prisma.js';
import { initSocket } from './socket/index.js';
import { baileysManager } from './whatsapp/BaileysManager.js';
import { startWorker, stopWorker } from './queue/worker.js';
import { startScheduler } from './services/scheduler.js';
import { flushLogs } from './services/logService.js';
import { ROLE, isWorker, isApi, clusterEnabled } from './cluster/clusterConfig.js';
import { startCoordinator } from './cluster/coordinator.js';

async function bootstrap() {
  await connectPrisma();
  logger.info(`Database terhubung (CLUSTER_ROLE=${ROLE})`);

  const app = createApp();
  const server = http.createServer(app);

  // Socket.IO realtime
  initSocket(server);

  // Penjadwal broadcast (berjalan di tier API/all)
  startScheduler();

  // Coordinator rebalancing (hanya saat cluster & tier API; leader-elected)
  if (clusterEnabled && isApi) startCoordinator();

  // Worker queue & sesi Baileys hanya bila proses ini memegang device
  // (mode 'all'). Di mode 'api' murni, ini ditangani proses WA-worker terpisah.
  if (isWorker) {
    startWorker();
    baileysManager.restoreAll().catch((err) => logger.error({ err }, 'restoreAll gagal'));
  } else {
    logger.info('Mode API: worker & sesi Baileys ditangani proses WA-worker terpisah');
  }

  server.listen(env.port, () => {
    logger.info(`🚀 ${env.appName} berjalan di ${env.appUrl} (port ${env.port})`);
    logger.info(`📚 Swagger: ${env.appUrl}/api/docs`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} diterima, mematikan...`);
    // L4: tunggu request berjalan selesai (maks 10 dtk) sebelum lanjut.
    await Promise.race([
      new Promise((resolve) => server.close(resolve)),
      new Promise((resolve) => setTimeout(resolve, 10000)),
    ]);
    await flushLogs().catch(() => {});
    await stopWorker().catch(() => {});
    await baileysManager.shutdown().catch(() => {});
    await disconnectPrisma().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
  process.on('uncaughtException', (err) => logger.error({ err }, 'uncaughtException'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Bootstrap gagal');
  process.exit(1);
});
