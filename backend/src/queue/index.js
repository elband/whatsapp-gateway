import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { SHARD_COUNT } from '../cluster/clusterConfig.js';

// F3: satu queue per shard → `wa-messages-<shard>`. Worker shard hanya
// mengonsumsi queue-nya sendiri (isolasi & throughput linier).
export const queueName = (shard) => `wa-messages-${shard}`;

const connection = createRedisConnection();
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
};

const queues = new Map();
export function queueFor(shard) {
  if (!queues.has(shard)) {
    queues.set(shard, new Queue(queueName(shard), { connection, defaultJobOptions }));
  }
  return queues.get(shard);
}

// Enqueue pengiriman pesan tunggal ke shard pemilik device.
export function enqueueSingle(messageId, shard = 0, opts = {}) {
  return queueFor(shard).add('single', { messageId }, opts);
}

// Enqueue satu item broadcast ke shard pemilik device (dengan delay terjadwal).
export function enqueueBroadcastItem(itemId, shard = 0, delay = 0) {
  return queueFor(shard).add('broadcast', { itemId }, { delay });
}

// Agregasi statistik seluruh shard (untuk dashboard monitoring).
export async function getQueueStats() {
  const total = { waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0, paused: 0 };
  for (let s = 0; s < SHARD_COUNT; s++) {
    const c = await queueFor(s).getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused');
    for (const k of Object.keys(total)) total[k] += c[k] || 0;
  }
  return total;
}

export default { queueFor, enqueueSingle, enqueueBroadcastItem, getQueueStats, queueName };
