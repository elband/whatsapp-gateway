import path from 'node:path';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { enqueueBroadcastItem } from '../../queue/index.js';
import { normalizePhone } from '../../utils/phone.js';
import { env } from '../../config/env.js';
import { uploadRoot } from '../../middlewares/upload.js';
import { writeLog } from '../../services/logService.js';
import { parseSort } from '../../utils/listQuery.js';
import { shardForDevice } from '../../cluster/deviceRouter.js';
import * as socket from '../../realtime/emit.js';

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Bangun daftar penerima dari input (manual / contactGroupId / contactIds).
async function buildRecipients({ recipients, contactGroupId, contactIds }) {
  const out = [];
  if (Array.isArray(recipients)) {
    for (const r of recipients) {
      const phone = normalizePhone(r.phone);
      if (phone) out.push({ phone, name: r.name || null, contactId: r.contactId || null, variables: r.variables || null });
    }
  }
  let contacts = [];
  if (contactGroupId) {
    const members = await prisma.contactGroupMember.findMany({
      where: { groupId: Number(contactGroupId) },
      include: { contact: true },
    });
    contacts = members.map((m) => m.contact);
  } else if (Array.isArray(contactIds) && contactIds.length) {
    contacts = await prisma.contact.findMany({ where: { id: { in: contactIds.map(Number) } } });
  }
  for (const c of contacts) {
    const phone = normalizePhone(c.phone);
    if (phone) out.push({ phone, name: c.name, contactId: c.id, variables: { nama: c.name, ...(c.meta || {}) } });
  }
  // dedup by phone
  const seen = new Set();
  return out.filter((r) => (seen.has(r.phone) ? false : seen.add(r.phone)));
}

export async function create(data, file, userId) {
  const device = await prisma.device.findUnique({ where: { id: Number(data.deviceId) } });
  if (!device) throw ApiError.notFound('Device tidak ditemukan');

  const recipients = await buildRecipients(data);
  if (recipients.length === 0) throw ApiError.badRequest('Tidak ada penerima valid');

  const mediaPath = file ? path.relative(uploadRoot, file.path) : data.mediaPath || null;
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
  const isScheduled = scheduledAt && scheduledAt > new Date();

  const broadcast = await prisma.broadcast.create({
    data: {
      name: data.name,
      deviceId: device.id,
      templateId: data.templateId ? Number(data.templateId) : null,
      messageType: data.messageType || 'TEXT',
      body: data.body || null,
      caption: data.caption || null,
      mediaPath,
      minDelayMs: data.minDelayMs || env.broadcast.minDelayMs,
      maxDelayMs: data.maxDelayMs || env.broadcast.maxDelayMs,
      scheduledAt,
      status: isScheduled ? 'SCHEDULED' : 'DRAFT',
      total: recipients.length,
      createdById: userId || null,
      items: {
        create: recipients.map((r) => ({
          phone: r.phone, name: r.name, contactId: r.contactId, variables: r.variables,
        })),
      },
    },
  });

  writeLog({ type: 'BROADCAST', action: 'broadcast.create', message: broadcast.name, userId, meta: { total: recipients.length } });

  if (!isScheduled) await start(broadcast.id);
  return get(broadcast.id);
}

// Masukkan semua item QUEUED ke queue dengan jeda acak kumulatif.
export async function start(broadcastId) {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) throw ApiError.notFound('Broadcast tidak ditemukan');

  const items = await prisma.broadcastItem.findMany({
    where: { broadcastId, status: 'QUEUED' },
    select: { id: true },
  });

  const shard = await shardForDevice(broadcast.deviceId);
  let cumulative = 0;
  for (const item of items) {
    await enqueueBroadcastItem(item.id, shard, cumulative);
    cumulative += rand(broadcast.minDelayMs, broadcast.maxDelayMs);
  }
  await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'RUNNING', startedAt: broadcast.startedAt || new Date() } });
  socket.emit('broadcast:status', { id: broadcastId, status: 'RUNNING' });
  return get(broadcastId);
}

export async function pause(id) {
  await prisma.broadcast.update({ where: { id }, data: { status: 'PAUSED' } });
  socket.emit('broadcast:status', { id, status: 'PAUSED' });
  return get(id);
}

export async function resume(id) {
  const bc = await prisma.broadcast.findUnique({ where: { id } });
  if (!bc) throw ApiError.notFound('Broadcast tidak ditemukan');
  await prisma.broadcast.update({ where: { id }, data: { status: 'RUNNING' } });
  // jadwalkan ulang item yang masih QUEUED
  return start(id);
}

export async function cancel(id) {
  await prisma.broadcast.update({ where: { id }, data: { status: 'CANCELLED', finishedAt: new Date() } });
  await prisma.broadcastItem.updateMany({ where: { broadcastId: id, status: 'QUEUED' }, data: { status: 'FAILED', error: 'Dibatalkan' } });
  socket.emit('broadcast:status', { id, status: 'CANCELLED' });
  return get(id);
}

export async function retryFailed(id) {
  const failed = await prisma.broadcastItem.findMany({ where: { broadcastId: id, status: 'FAILED' }, select: { id: true } });
  await prisma.broadcastItem.updateMany({
    where: { broadcastId: id, status: 'FAILED' },
    data: { status: 'QUEUED', error: null },
  });
  const bc = await prisma.broadcast.findUnique({ where: { id } });
  // reset hitungan gagal sesuai jumlah yang di-retry
  await prisma.broadcast.update({
    where: { id },
    data: { status: 'RUNNING', failedCount: Math.max(0, bc.failedCount - failed.length), finishedAt: null },
  });
  return start(id);
}

export async function list({ skip, limit, status, deviceId, sort, order }) {
  const where = {};
  if (status) where.status = status;
  if (deviceId) where.deviceId = Number(deviceId);
  const [items, total] = await Promise.all([
    prisma.broadcast.findMany({
      where, skip, take: limit,
      orderBy: parseSort({ sort, order }, ['createdAt', 'status', 'name']),
      include: { device: { select: { id: true, name: true } } },
    }),
    prisma.broadcast.count({ where }),
  ]);
  return { items, total };
}

export async function get(id) {
  const bc = await prisma.broadcast.findUnique({
    where: { id },
    include: { device: { select: { id: true, name: true } }, template: { select: { id: true, name: true } } },
  });
  if (!bc) throw ApiError.notFound('Broadcast tidak ditemukan');
  return bc;
}

export async function getItems(id, { skip, limit, status }) {
  const where = { broadcastId: id };
  if (status) where.status = status;
  const [items, total] = await Promise.all([
    prisma.broadcastItem.findMany({ where, skip, take: limit, orderBy: { id: 'asc' } }),
    prisma.broadcastItem.count({ where }),
  ]);
  return { items, total };
}

// Dipanggil scheduler untuk broadcast terjadwal yang sudah waktunya.
export async function runDueScheduled() {
  const due = await prisma.broadcast.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    select: { id: true },
  });
  for (const b of due) {
    await start(b.id).catch(() => {});
  }
  return due.length;
}

export default {
  create, start, pause, resume, cancel, retryFailed, list, get, getItems, runDueScheduled,
};
