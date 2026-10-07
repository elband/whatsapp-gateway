import { redis } from '../config/redis.js';
import { dayKey } from './sendPolicy.js';

// Penegak aturan pengiriman berbasis Redis (atomik via Lua, aman untuk banyak
// worker/shard). Kebijakannya ada di services/sendPolicy.js.

const paceKey = (deviceId) => `wa:pace:${deviceId}`;
const dailyKey = (deviceId, day) => `wa:daily:${deviceId}:${day}`;

// Slot kirim per device: hanya satu pesan "sedang diketik/dikirim" per device.
// Hash { free: kapan device bebas (epoch ms), cnt: pesan dalam kelompok berjalan }.
// Tiap kelompok `batchSize` pesan, slot terakhir ditambah istirahat `restMs`.
// Device yang menganggur lebih lama dari `restMs` memulai kelompok baru.
// Return 0 = slot didapat; selain itu = epoch ms kapan device bebas.
const PACE_LUA = `
local now = tonumber(ARGV[1])
local hold = tonumber(ARGV[2])
local batch = tonumber(ARGV[3])
local rest = tonumber(ARGV[4])
local free = tonumber(redis.call('HGET', KEYS[1], 'free') or '0')
if free > now then return free end
local cnt = tonumber(redis.call('HGET', KEYS[1], 'cnt') or '0')
if now - free > rest then cnt = 0 end
cnt = cnt + 1
if batch > 0 and cnt >= batch then
  hold = hold + rest
  cnt = 0
end
redis.call('HSET', KEYS[1], 'free', now + hold, 'cnt', cnt)
redis.call('PEXPIRE', KEYS[1], hold + rest + 3600000)
return 0
`;

export async function reserveSendSlot(deviceId, { holdMs, batchSize, restMs, now = Date.now() }) {
  const res = await redis.eval(PACE_LUA, 1, paceKey(deviceId), now, Math.max(0, holdMs), batchSize, Math.max(0, restMs));
  return Number(res) || 0;
}

// Tier harian: catat penerima unik device hari ini. Penerima yang sudah
// tercatat hari ini selalu lolos (idempoten); penerima baru ditolak bila
// jumlah unik sudah mencapai `limit` (0 = tanpa batas).
const DAILY_LUA = `
if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then
  return {1, redis.call('SCARD', KEYS[1])}
end
local n = redis.call('SCARD', KEYS[1])
local limit = tonumber(ARGV[2])
if limit > 0 and n >= limit then return {0, n} end
redis.call('SADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], 172800)
return {1, n + 1}
`;

export async function claimDailyRecipient(deviceId, phone, limit) {
  const [allowed, used] = await redis.eval(DAILY_LUA, 1, dailyKey(deviceId, dayKey()), String(phone), Number(limit) || 0);
  return { allowed: allowed === 1, used: Number(used), limit: Number(limit) || 0 };
}

// Jumlah penerima unik hari ini untuk beberapa device sekaligus → { [deviceId]: n }.
export async function dailyUsage(deviceIds) {
  if (!deviceIds.length) return {};
  const day = dayKey();
  const pipe = redis.pipeline();
  deviceIds.forEach((id) => pipe.scard(dailyKey(id, day)));
  const res = await pipe.exec();
  return Object.fromEntries(deviceIds.map((id, i) => [id, Number(res[i]?.[1]) || 0]));
}

export default { reserveSendSlot, claimDailyRecipient, dailyUsage };
