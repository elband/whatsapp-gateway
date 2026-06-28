import { prisma } from '../../config/prisma.js';
import { assertSafeUrl } from '../../utils/ssrfGuard.js';

const SUPPORTED_EVENTS = [
  'message.incoming',
  'message.outgoing',
  'message.delivered',
  'message.read',
  'device.connected',
  'device.disconnected',
  'qr.updated',
  'broadcast.completed',
];

export async function test(url, event = 'test') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data: { message: 'Test webhook dari WhatsApp Gateway' },
  };

  try {
    await assertSafeUrl(url); // proteksi SSRF
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

export async function deliveries({ skip, limit, deviceId }) {
  const where = { type: 'WEBHOOK' };
  if (deviceId) where.deviceId = Number(deviceId);

  const [items, total] = await Promise.all([
    prisma.log.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.log.count({ where }),
  ]);
  return { items, total };
}

export function events() {
  return SUPPORTED_EVENTS;
}

export default { test, deliveries, events };
