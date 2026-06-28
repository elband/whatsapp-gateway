import { prisma } from '../config/prisma.js';
import { SHARD_COUNT } from './clusterConfig.js';

// Fallback stateless (modulo) bila device belum punya shardId.
export function shardOf(deviceId) {
  const n = Number(deviceId) || 0;
  return ((n % SHARD_COUNT) + SHARD_COUNT) % SHARD_COUNT;
}

// Pilih shard dengan device paling sedikit (dipakai saat device dibuat).
export async function assignShard() {
  if (SHARD_COUNT <= 1) return 0;
  const rows = await prisma.device.groupBy({ by: ['shardId'], _count: { _all: true } });
  const counts = new Array(SHARD_COUNT).fill(0);
  for (const r of rows) {
    if (r.shardId != null && r.shardId >= 0 && r.shardId < SHARD_COUNT) counts[r.shardId] = r._count._all;
  }
  let min = 0;
  for (let i = 1; i < SHARD_COUNT; i++) if (counts[i] < counts[min]) min = i;
  return min;
}

// Resolusi shard untuk sebuah device (sticky: pakai shardId DB, else modulo).
const cache = new Map();
export async function shardForDevice(deviceId) {
  const key = Number(deviceId);
  if (cache.has(key)) return cache.get(key);
  const d = await prisma.device.findUnique({ where: { id: key }, select: { shardId: true } });
  const shard = d?.shardId ?? shardOf(key);
  cache.set(key, shard);
  return shard;
}
export function invalidateShardCache(deviceId) {
  cache.delete(Number(deviceId));
}

export const cmdChannel = (shard) => `wa:cmd:${shard}`;
export const replyChannel = (id) => `wa:reply:${id}`;
export const EVENT_CHANNEL = 'wa:events';
export const ownKey = (deviceId) => `wa:own:${deviceId}`;
export const workerHeartbeatKey = (shard) => `wa:worker:${shard}`;

export default {
  shardOf, assignShard, shardForDevice, invalidateShardCache,
  cmdChannel, replyChannel, EVENT_CHANNEL, ownKey, workerHeartbeatKey,
};
