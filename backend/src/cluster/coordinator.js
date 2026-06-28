import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { SHARD_COUNT } from './clusterConfig.js';
import { workerHeartbeatKey, ownKey, invalidateShardCache } from './deviceRouter.js';

// F3+ — Coordinator rebalancing.
// Satu instance (leader-elected) memantau heartbeat shard. Bila sebuah shard mati,
// device miliknya di-reassign ke shard sehat (balanced), lock stale dilepas, lalu
// worker target diperintahkan menyalakan device (auto-restore dari sesi terenkripsi).
const LEADER_KEY = 'wa:coordinator:leader';
const INTERVAL_MS = 10000;
const RECONNECTABLE = ['CONNECTED', 'CONNECTING', 'QR', 'INITIALIZING', 'DISCONNECTED'];
const pid = String(process.pid);

async function aliveShards() {
  const alive = [];
  for (let s = 0; s < SHARD_COUNT; s++) {
    if (await redis.exists(workerHeartbeatKey(s))) alive.push(s);
  }
  return alive;
}

async function isLeader() {
  const ok = (await redis.set(LEADER_KEY, pid, 'NX', 'EX', 15)) === 'OK';
  if (ok) return true;
  if ((await redis.get(LEADER_KEY)) === pid) {
    await redis.expire(LEADER_KEY, 15);
    return true;
  }
  return false;
}

async function tick() {
  if (SHARD_COUNT <= 1) return;
  if (!(await isLeader())) return;

  const alive = await aliveShards();
  if (alive.length === 0) return; // tidak ada worker hidup — jangan reassign
  const aliveSet = new Set(alive);

  const devices = await prisma.device.findMany({
    where: { status: { in: RECONNECTABLE } },
    select: { id: true, shardId: true, name: true },
  });

  // Beban shard hidup saat ini (untuk balancing).
  const load = Object.fromEntries(alive.map((s) => [s, 0]));
  for (const d of devices) if (d.shardId != null && aliveSet.has(d.shardId)) load[d.shardId]++;

  let moved = 0;
  for (const d of devices) {
    if (d.shardId != null && aliveSet.has(d.shardId)) continue; // pemilik sehat

    let target = alive[0];
    for (const s of alive) if (load[s] < load[target]) target = s;
    load[target]++;

    await prisma.device.update({ where: { id: d.id }, data: { shardId: target } });
    await redis.del(ownKey(d.id)).catch(() => {}); // lepas lock stale milik shard mati
    invalidateShardCache(d.id);
    try {
      const { sendCommand } = await import('./commandBus.js');
      await sendCommand(d.id, 'connect', {}, 20000);
    } catch (e) {
      logger.warn({ e: e.message, id: d.id }, 'rebalance: gagal perintah connect');
    }
    moved++;
  }
  if (moved > 0) logger.info({ moved, alive }, 'Coordinator: device di-rebalance dari shard mati');
}

export function startCoordinator() {
  const t = setInterval(() => tick().catch((e) => logger.error({ e: e.message }, 'coordinator error')), INTERVAL_MS);
  if (t.unref) t.unref();
  logger.info('Coordinator rebalancing aktif (leader-elected)');
}

export default { startCoordinator };
