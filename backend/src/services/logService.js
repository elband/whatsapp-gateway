import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';

// M1: buffer log untuk mengurangi write amplification ke DB.
// Entri ditahan lalu ditulis sekaligus (createMany) tiap interval / saat penuh.
const MAX_BUFFER = 1000; // batas aman bila DB down (drop tertua)
const FLUSH_SIZE = 50;
const FLUSH_MS = 2000;

let buffer = [];
let timer = null;

function scheduleFlush() {
  if (timer) return;
  timer = setInterval(() => {
    flushLogs().catch(() => {});
  }, FLUSH_MS);
  if (timer.unref) timer.unref(); // jangan menahan proses exit
}

export async function flushLogs() {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  try {
    await prisma.log.createMany({ data: batch });
  } catch (err) {
    logger.error({ err, count: batch.length }, 'Gagal flush log ke database');
  }
}

// Tulis log/audit (non-blocking, best-effort).
export function writeLog({
  type,
  level = 'INFO',
  action,
  message,
  userId,
  apiKeyId,
  deviceId,
  ip,
  userAgent,
  meta,
}) {
  buffer.push({
    type,
    level,
    action,
    message: message ?? null,
    userId: userId ?? null,
    apiKeyId: apiKeyId ?? null,
    deviceId: deviceId ?? null,
    ip: ip ?? null,
    userAgent: userAgent ?? null,
    meta: meta ?? undefined,
  });

  if (buffer.length > MAX_BUFFER) buffer.shift(); // lindungi memori
  if (buffer.length >= FLUSH_SIZE) {
    flushLogs().catch(() => {});
  } else {
    scheduleFlush();
  }
}

export default { writeLog, flushLogs };
