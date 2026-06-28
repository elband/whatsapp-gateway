// ============================================================
// H5 scaffold — Entrypoint WA-WORKER (satu proses = satu shard).
// Memegang koneksi Baileys untuk subset device + memproses queue + melayani
// perintah dari API tier. BELUM dipakai oleh deployment saat ini (mode 'all').
//
// Aktifkan:
//   CLUSTER_ROLE=worker SHARD_COUNT=4 SHARD_ID=0 node src/entrypoints/worker-wa.js
//   (jalankan satu proses per SHARD_ID: 0,1,2,3)
//
// PRASYARAT WIRING (lihat docs/SCALE-OUT-H5.md):
//   BaileysManager harus mem-publish event lewat cluster/eventBus.publishEvent
//   (bukan socket.emit langsung) saat berjalan di mode worker.
// ============================================================
import { connectPrisma, prisma, disconnectPrisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { redis } from '../config/redis.js';
import { SHARD_ID, SHARD_COUNT } from '../cluster/clusterConfig.js';
import { shardOf, workerHeartbeatKey } from '../cluster/deviceRouter.js';
import { serveCommands } from '../cluster/commandBus.js';
import { baileysManager } from '../whatsapp/BaileysManager.js';
import { startWorker, stopWorker } from '../queue/worker.js';

async function main() {
  await connectPrisma();
  logger.info({ SHARD_ID, SHARD_COUNT }, 'WA-worker shard starting');

  // 1) Pulihkan HANYA device milik shard ini (sticky shardId, fallback modulo).
  const devices = await prisma.device.findMany({
    where: { status: { in: ['CONNECTED', 'CONNECTING', 'QR', 'INITIALIZING'] } },
    select: { id: true, shardId: true },
  });
  for (const d of devices) {
    const shard = d.shardId ?? shardOf(d.id);
    if (shard === SHARD_ID) {
      baileysManager.startDevice(d.id).catch((e) => logger.error({ e, id: d.id }, 'restore gagal'));
    }
  }

  // 2) Worker queue memproses job kirim untuk shard ini (queue `wa-messages-<shard>`).
  startWorker(SHARD_ID);

  // 2b) Heartbeat: tandai shard hidup + perpanjang lock kepemilikan device.
  const heartbeat = setInterval(() => {
    redis.set(workerHeartbeatKey(SHARD_ID), String(process.pid), 'EX', 15).catch(() => {});
    baileysManager.renewLocks().catch(() => {});
  }, 5000);
  if (heartbeat.unref) heartbeat.unref();

  // 3) Layani perintah dari API tier.
  await serveCommands(SHARD_ID, async (action, deviceId, payload = {}) => {
    switch (action) {
      case 'connect':
        return baileysManager.startDevice(deviceId);
      case 'logout':
        return baileysManager.logoutDevice(deviceId);
      case 'restart':
        await baileysManager.stopDevice(deviceId);
        return baileysManager.startDevice(deviceId);
      case 'qr': {
        const dev = await prisma.device.findUnique({ where: { id: deviceId }, select: { status: true, qr: true } });
        return { status: dev?.status, qr: dev?.qr };
      }
      case 'checkNumber':
        return baileysManager.checkNumber(deviceId, payload.jid);
      case 'connected':
        return { connected: baileysManager.isConnected(deviceId) };
      default:
        throw new Error(`Aksi tidak dikenal: ${action}`);
    }
  });

  const shutdown = async () => {
    await stopWorker().catch(() => {});
    await baileysManager.shutdown().catch(() => {});
    await disconnectPrisma().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  logger.error({ e }, 'WA-worker gagal start');
  process.exit(1);
});
