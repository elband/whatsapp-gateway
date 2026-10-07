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
import { deviceOwnerWhere, ownerWhere, assertOwned, assertDeviceOwned } from '../../utils/ownerScope.js';
import { rand, typingDelayMs, effectiveBatchSize, MAX_BROADCAST_RECIPIENTS } from '../../services/sendPolicy.js';

// Ambil integer dari input; pakai fallback bila kosong. 0 tetap dihormati
// (mis. batchRestMinMs=0 = tanpa istirahat antar kelompok), jadi tidak boleh pakai `||`.
function intOr(val, fallback) {
  if (val === undefined || val === null || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

// Bangun daftar penerima dari input (manual / contactGroupId / contactIds).
// Kontak dari DB dibatasi milik user (super admin: tanpa batas).
async function buildRecipients({ recipients, contactGroupId, contactIds }, user) {
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
      where: { groupId: Number(contactGroupId), contact: { ...ownerWhere(user) } },
      include: { contact: true },
    });
    contacts = members.map((m) => m.contact);
  } else if (Array.isArray(contactIds) && contactIds.length) {
    contacts = await prisma.contact.findMany({ where: { id: { in: contactIds.map(Number) }, ...ownerWhere(user) } });
  }
  for (const c of contacts) {
    const phone = normalizePhone(c.phone);
    if (phone) out.push({ phone, name: c.name, contactId: c.id, variables: { nama: c.name, ...(c.meta || {}) } });
  }
  // dedup by phone
  const seen = new Set();
  return out.filter((r) => (seen.has(r.phone) ? false : seen.add(r.phone)));
}

export async function create(data, file, user) {
  const userId = user?.id ?? null;
  const device = await prisma.device.findUnique({ where: { id: Number(data.deviceId) } });
  assertOwned(device, user, 'Device tidak ditemukan');

  const recipients = await buildRecipients(data, user);
  if (recipients.length === 0) throw ApiError.badRequest('Tidak ada penerima valid');
  // Aturan daftar siaran WhatsApp: maks 256 kontak per siaran.
  if (recipients.length > MAX_BROADCAST_RECIPIENTS) {
    throw ApiError.badRequest(
      `Maksimal ${MAX_BROADCAST_RECIPIENTS} penerima per broadcast (aturan daftar siaran WhatsApp), saat ini ${recipients.length}. Bagi menjadi beberapa broadcast.`,
    );
  }

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
      batchSize: effectiveBatchSize(intOr(data.batchSize, env.broadcast.batchSize)),
      batchRestMinMs: intOr(data.batchRestMinMs, env.broadcast.batchRestMinMs),
      batchRestMaxMs: intOr(data.batchRestMaxMs, env.broadcast.batchRestMaxMs),
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
  return _get(broadcast.id);
}

// Masukkan semua item QUEUED ke queue dengan jeda kumulatif yang meniru aturan
// worker: tiap pesan = simulasi mengetik (sebanding panjang pesan) + jeda acak,
// dan istirahat panjang (batchRest*) tiap kelompok maks 5 pesan. Penegakan
// sebenarnya ada di worker (slot per device); jadwal ini hanya menyebar job.
export async function start(broadcastId) {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId }, include: { template: true } });
  if (!broadcast) throw ApiError.notFound('Broadcast tidak ditemukan');

  const items = await prisma.broadcastItem.findMany({
    where: { broadcastId, status: 'QUEUED' },
    select: { id: true },
  });

  // Pengaturan istirahat per-batch: utamakan nilai per-broadcast, fallback ke env.
  const batchSize = effectiveBatchSize(broadcast.batchSize ?? env.broadcast.batchSize);
  const batchRestMinMs = broadcast.batchRestMinMs ?? env.broadcast.batchRestMinMs;
  const batchRestMaxMs = broadcast.batchRestMaxMs ?? env.broadcast.batchRestMaxMs;
  const shard = await shardForDevice(broadcast.deviceId);
  const text = broadcast.template?.body || broadcast.body || broadcast.caption || '';
  let cumulative = 0;
  let sentInSchedule = 0;
  for (const item of items) {
    await enqueueBroadcastItem(item.id, shard, cumulative);
    sentInSchedule += 1;
    // Jeda antar pesan: mengetik + jeda acak.
    cumulative += typingDelayMs(text) + rand(broadcast.minDelayMs, broadcast.maxDelayMs);
    // Istirahat panjang tiap kelipatan batchSize (kecuali item terakhir).
    if (sentInSchedule % batchSize === 0 && sentInSchedule < items.length) {
      cumulative += rand(batchRestMinMs, batchRestMaxMs);
    }
  }
  await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'RUNNING', startedAt: broadcast.startedAt || new Date() } });
  socket.emit('broadcast:status', { id: broadcastId, status: 'RUNNING' });
  return _get(broadcastId);
}

export async function pause(id, user) {
  await get(id, user); // guard kepemilikan
  await prisma.broadcast.update({ where: { id }, data: { status: 'PAUSED' } });
  socket.emit('broadcast:status', { id, status: 'PAUSED' });
  return _get(id);
}

export async function resume(id, user) {
  await get(id, user); // guard kepemilikan
  await prisma.broadcast.update({ where: { id }, data: { status: 'RUNNING' } });
  // jadwalkan ulang item yang masih QUEUED
  return start(id);
}

export async function cancel(id, user) {
  await get(id, user); // guard kepemilikan
  await prisma.broadcast.update({ where: { id }, data: { status: 'CANCELLED', finishedAt: new Date() } });
  await prisma.broadcastItem.updateMany({ where: { broadcastId: id, status: 'QUEUED' }, data: { status: 'FAILED', error: 'Dibatalkan' } });
  socket.emit('broadcast:status', { id, status: 'CANCELLED' });
  return _get(id);
}

export async function retryFailed(id, user) {
  await get(id, user); // guard kepemilikan
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

export async function list({ skip, limit, status, deviceId, sort, order }, user) {
  const where = { ...deviceOwnerWhere(user) };
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

// Ambil broadcast tanpa guard kepemilikan (pemakaian internal).
async function _get(id) {
  const bc = await prisma.broadcast.findUnique({
    where: { id },
    include: {
      device: { select: { id: true, name: true, ownerId: true } },
      template: { select: { id: true, name: true } },
    },
  });
  if (!bc) throw ApiError.notFound('Broadcast tidak ditemukan');
  return bc;
}

export async function get(id, user) {
  const bc = await _get(id);
  assertDeviceOwned(bc, user, 'Broadcast tidak ditemukan');
  return bc;
}

export async function getItems(id, { skip, limit, status }, user) {
  await get(id, user); // guard kepemilikan broadcast
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
