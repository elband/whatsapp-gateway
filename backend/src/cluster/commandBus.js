import { nanoid } from 'nanoid';
import { createRedisConnection } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { shardForDevice, cmdChannel, replyChannel } from './deviceRouter.js';

// ============================================================
// Command bus request/reply lewat Redis pub/sub.
// API tier  : sendCommand(deviceId, action, payload) -> menunggu balasan shard pemilik.
// WA-worker : serveCommands(shardId, handler) -> mengeksekusi & membalas.
// ============================================================

const pub = createRedisConnection();
const sub = createRedisConnection();
const pending = new Map(); // correlationId -> { resolve, reject, timer }
let replyReady = false;

async function ensureReplySubscriber() {
  if (replyReady) return;
  replyReady = true;
  await sub.psubscribe('wa:reply:*');
  sub.on('pmessage', (_pattern, channel, message) => {
    const id = channel.split(':').pop();
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimeout(p.timer);
    try {
      const res = JSON.parse(message);
      res.error ? p.reject(new Error(res.error)) : p.resolve(res.data);
    } catch (e) {
      p.reject(e);
    }
  });
}

// Sisi API tier.
export async function sendCommand(deviceId, action, payload = {}, timeoutMs = 15000) {
  await ensureReplySubscriber();
  const id = nanoid(16);
  const shard = await shardForDevice(deviceId);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Command timeout (${action} device ${deviceId})`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    pub.publish(
      cmdChannel(shard),
      JSON.stringify({ id, action, deviceId, payload, reply: replyChannel(id) }),
    );
  });
}

// Sisi WA-worker.
export async function serveCommands(shardId, handler) {
  const wsub = createRedisConnection();
  const wpub = createRedisConnection();
  await wsub.subscribe(cmdChannel(shardId));
  wsub.on('message', async (_channel, message) => {
    let cmd;
    try {
      cmd = JSON.parse(message);
    } catch {
      return;
    }
    try {
      const data = await handler(cmd.action, cmd.deviceId, cmd.payload);
      await wpub.publish(cmd.reply, JSON.stringify({ data: data ?? null }));
    } catch (err) {
      await wpub.publish(cmd.reply, JSON.stringify({ error: err.message }));
    }
  });
  logger.info({ shardId }, 'Command server siap (shard)');
}

export default { sendCommand, serveCommands };
