import path from 'node:path';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { enqueueSingle } from '../../queue/index.js';
import { normalizePhone, toJid } from '../../utils/phone.js';
import { uploadRoot } from '../../middlewares/upload.js';
import { baileysManager } from '../../whatsapp/BaileysManager.js';
import { parseSort } from '../../utils/listQuery.js';
import { clusterEnabled } from '../../cluster/clusterConfig.js';
import { shardForDevice } from '../../cluster/deviceRouter.js';

let _send = null;
async function cmd(id, action, payload = {}) {
  if (!_send) _send = (await import('../../cluster/commandBus.js')).sendCommand;
  return _send(id, action, payload);
}

async function resolveDevice(deviceId, apiKey) {
  let id = deviceId ? Number(deviceId) : null;
  if (!id && apiKey?.defaultDeviceId) id = apiKey.defaultDeviceId;
  if (!id) throw ApiError.badRequest('deviceId wajib diisi');
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) throw ApiError.notFound('Device tidak ditemukan');
  return device;
}

// Buat record outbound + masukkan ke queue.
async function queueOutbound({ device, to, type, body, caption, attachment, meta, apiKeyId }) {
  const phone = normalizePhone(to);
  if (!phone) throw ApiError.badRequest(`Nomor tidak valid: ${to}`);

  // M2: kuota + pembuatan pesan dalam SATU transaksi.
  // increment kuota memakai updateMany ber-kondisi (atomic, anti-race).
  const message = await prisma.$transaction(async (tx) => {
    if (device.quota && device.quota > 0) {
      const claimed = await tx.device.updateMany({
        where: { id: device.id, quota: { gt: 0 }, quotaUsed: { lt: device.quota } },
        data: { quotaUsed: { increment: 1 } },
      });
      if (claimed.count === 0) {
        throw ApiError.forbidden(`Kuota pesan device "${device.name}" habis`);
      }
    }
    return tx.message.create({
      data: {
        deviceId: device.id,
        direction: 'OUTBOUND',
        type,
        status: 'QUEUED',
        to: phone,
        body: body || null,
        caption: caption || null,
        apiKeyId: apiKeyId || null,
        meta: meta || null,
        attachments: attachment ? { create: attachment } : undefined,
      },
      include: { attachments: true },
    });
  });

  const shard = await shardForDevice(device.id);
  await enqueueSingle(message.id, shard);
  return message;
}

function relPath(file) {
  // simpan path relatif terhadap uploadRoot agar portable
  return path.relative(uploadRoot, file.path);
}

export async function sendText({ deviceId, to, body, apiKey, apiKeyId }) {
  const device = await resolveDevice(deviceId, apiKey);
  return queueOutbound({ device, to, type: 'TEXT', body, apiKeyId });
}

export async function sendMedia({ deviceId, to, type, caption, file, apiKey, apiKeyId }) {
  const device = await resolveDevice(deviceId, apiKey);
  if (!file) throw ApiError.badRequest('File media wajib diunggah');
  const attachment = {
    fileName: file.originalname,
    filePath: relPath(file),
    mimeType: file.mimetype,
    size: file.size,
  };
  return queueOutbound({ device, to, type, caption, attachment, apiKeyId });
}

export async function sendLocation({ deviceId, to, latitude, longitude, name, address, apiKey, apiKeyId }) {
  const device = await resolveDevice(deviceId, apiKey);
  return queueOutbound({
    device, to, type: 'LOCATION', apiKeyId,
    meta: { location: { latitude, longitude, name, address } },
  });
}

export async function sendContact({ deviceId, to, contactName, contactPhone, apiKey, apiKeyId }) {
  const device = await resolveDevice(deviceId, apiKey);
  return queueOutbound({
    device, to, type: 'CONTACT', apiKeyId,
    meta: { contact: { name: contactName, phone: contactPhone } },
  });
}

export async function sendButtons({ deviceId, to, body, footer, buttons, apiKey, apiKeyId }) {
  const device = await resolveDevice(deviceId, apiKey);
  return queueOutbound({
    device, to, type: 'BUTTON', body, apiKeyId,
    meta: { buttons: { items: buttons, footer } },
  });
}

export async function sendList({ deviceId, to, body, footer, title, buttonText, sections, apiKey, apiKeyId }) {
  const device = await resolveDevice(deviceId, apiKey);
  return queueOutbound({
    device, to, type: 'LIST', body, apiKeyId,
    meta: { list: { text: body, footer, title, buttonText, sections } },
  });
}

// Cek satu/banyak nomor apakah terdaftar di WhatsApp.
export async function checkNumbers({ deviceId, numbers, apiKey }) {
  const device = await resolveDevice(deviceId, apiKey);
  if (!clusterEnabled && !baileysManager.isConnected(device.id)) {
    throw ApiError.badRequest('Device tidak terhubung');
  }
  const list = Array.isArray(numbers) ? numbers : [numbers];
  const results = [];
  for (const n of list) {
    const phone = normalizePhone(n);
    if (!phone) {
      results.push({ input: n, phone: null, exists: false, error: 'Nomor tidak valid' });
      continue;
    }
    try {
      // Cluster: minta WA-worker pemilik device yang mengecek.
      const jid = clusterEnabled
        ? await cmd(device.id, 'checkNumber', { jid: toJid(phone) })
        : await baileysManager.checkNumber(device.id, toJid(phone));
      results.push({ input: n, phone, exists: Boolean(jid), jid: jid || null });
    } catch (e) {
      results.push({ input: n, phone, exists: false, error: e.message });
    }
  }
  return results;
}

export async function list({ skip, limit, deviceId, direction, status, type, search, from, to, sort, order }) {
  const where = {};
  if (deviceId) where.deviceId = Number(deviceId);
  if (direction) where.direction = direction;
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) where.OR = [{ body: { contains: search } }, { to: { contains: search } }, { from: { contains: search } }];
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    prisma.message.findMany({
      where, skip, take: limit,
      orderBy: parseSort({ sort, order }, ['createdAt', 'status', 'type', 'direction']),
      include: { attachments: true, device: { select: { id: true, name: true } } },
    }),
    prisma.message.count({ where }),
  ]);
  return { items, total };
}

export async function get(id) {
  const msg = await prisma.message.findUnique({ where: { id }, include: { attachments: true } });
  if (!msg) throw ApiError.notFound('Pesan tidak ditemukan');
  return msg;
}

export async function resend(id) {
  const msg = await get(id);
  await prisma.message.update({ where: { id }, data: { status: 'QUEUED', error: null } });
  await enqueueSingle(id, await shardForDevice(msg.deviceId));
  return msg;
}

export default { sendText, sendMedia, sendLocation, sendContact, list, get, resend };
