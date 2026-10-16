import { nanoid } from 'nanoid';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { baileysManager } from '../../whatsapp/BaileysManager.js';
import { writeLog } from '../../services/logService.js';
import { parseSort } from '../../utils/listQuery.js';
import { clusterEnabled } from '../../cluster/clusterConfig.js';
import { assignShard } from '../../cluster/deviceRouter.js';
import { ownerWhere, assertOwned } from '../../utils/ownerScope.js';
import { dailyUsage } from '../../services/sendLimiter.js';
import { normalizeNumbers } from '../../services/autoReplyPolicy.js';

// Di mode cluster, aksi device dikirim ke WA-worker pemilik via command bus.
// Lazy import agar mode 'all' tidak membuka koneksi Redis tambahan.
let _send = null;
async function cmd(id, action, payload = {}) {
  if (!_send) _send = (await import('../../cluster/commandBus.js')).sendCommand;
  return _send(id, action, payload);
}

const isConnected = (device) =>
  clusterEnabled ? device.status === 'CONNECTED' : baileysManager.isConnected(device.id);
const dConnect = (id) => (clusterEnabled ? cmd(id, 'connect') : baileysManager.startDevice(id));
const dLogout = (id) => (clusterEnabled ? cmd(id, 'logout') : baileysManager.logoutDevice(id));
const dRestart = async (id) => {
  if (clusterEnabled) return cmd(id, 'restart');
  await baileysManager.stopDevice(id);
  await new Promise((r) => setTimeout(r, 1500));
  return baileysManager.startDevice(id);
};

export async function list({ skip, limit, search, status, groupId, sort, order }, user) {
  const where = { ...ownerWhere(user) };
  if (status) where.status = status;
  if (groupId) where.groupId = Number(groupId);
  if (search) where.OR = [{ name: { contains: search } }, { phoneNumber: { contains: search } }];

  const [items, total] = await Promise.all([
    prisma.device.findMany({
      where,
      skip,
      take: limit,
      orderBy: parseSort({ sort, order }, ['createdAt', 'name', 'status', 'lastSeenAt']),
      include: { group: true, owner: { select: { id: true, name: true } } },
    }),
    prisma.device.count({ where }),
  ]);
  const used = await dailyUsage(items.map((d) => d.id));
  const withRuntime = items.map((d) => ({ ...d, connected: isConnected(d), dailyRecipientsUsed: used[d.id] || 0 }));
  return { items: withRuntime, total };
}

export async function get(id, user) {
  const device = await prisma.device.findUnique({
    where: { id },
    include: { group: true, owner: { select: { id: true, name: true } } },
  });
  assertOwned(device, user, 'Device tidak ditemukan');
  return { ...device, connected: isConnected(device) };
}

export async function create(data, user) {
  const userId = user?.id ?? null;
  const shardId = await assignShard(); // F3: sticky assignment device → shard
  const device = await prisma.device.create({
    data: {
      name: data.name,
      deviceId: nanoid(16),
      groupId: data.groupId || null,
      ownerId: userId,
      webhookUrl: data.webhookUrl || null,
      webhookEvents: data.webhookEvents || null,
      autoReconnect: data.autoReconnect ?? true,
      shardId,
      status: 'INITIALIZING',
    },
  });
  writeLog({ type: 'DEVICE', action: 'device.create', message: device.name, userId, deviceId: device.id });
  // langsung mulai agar QR tersedia
  dConnect(device.id).catch(() => {});
  return device;
}

export async function update(id, data, user) {
  const current = await get(id, user);
  // Mode WEBHOOK mengambil balasan dari respons webhook message.incoming.
  if (data.autoReply?.mode === 'WEBHOOK') {
    const url = data.webhookUrl !== undefined ? data.webhookUrl : current.webhookUrl;
    const events = data.webhookEvents !== undefined ? data.webhookEvents : current.webhookEvents;
    if (!url) throw ApiError.badRequest('Mode auto-balas Webhook membutuhkan Webhook URL pada device');
    if (Array.isArray(events) && events.length > 0 && !events.includes('message.incoming')) {
      throw ApiError.badRequest('Mode auto-balas Webhook membutuhkan event message.incoming pada webhook device');
    }
  }
  const device = await prisma.device.update({
    where: { id },
    data: {
      name: data.name,
      groupId: data.groupId,
      webhookUrl: data.webhookUrl,
      webhookEvents: data.webhookEvents,
      autoReconnect: data.autoReconnect,
      // Nomor dikecualikan disimpan ternormalisasi (08xx → 628xx) agar tampil apa adanya di UI.
      autoReply: data.autoReply && { ...data.autoReply, excludedNumbers: normalizeNumbers(data.autoReply.excludedNumbers) },
      quota: data.quota,
      quotaUsed: data.quotaUsed,
      // reassign kepemilikan hanya boleh oleh super admin
      ...(user?.isSuperAdmin && data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
      // tier harian anti-ban hanya boleh diubah super admin (cegah pemilik menaikkan sendiri)
      ...(user?.isSuperAdmin && data.dailyRecipientLimit !== undefined ? { dailyRecipientLimit: data.dailyRecipientLimit } : {}),
    },
  });
  writeLog({ type: 'DEVICE', action: 'device.update', message: device.name, userId: user?.id, deviceId: id });
  return device;
}

// Reassign kepemilikan device (khusus super admin). Memindahkan device otomatis
// memindahkan Message/Broadcast/Chat/OTP karena diisolasi lewat relasi device.
export async function reassign(id, ownerId, user) {
  await get(id, user);
  const target = await prisma.user.findUnique({ where: { id: Number(ownerId) } });
  if (!target || !target.isActive) throw ApiError.badRequest('User tujuan tidak valid atau tidak aktif');
  const device = await prisma.device.update({
    where: { id },
    data: { ownerId: target.id },
    include: { owner: { select: { id: true, name: true } } },
  });
  writeLog({ type: 'DEVICE', action: 'device.reassign', message: `${device.name} -> ${target.name}`, userId: user?.id, deviceId: id });
  return device;
}

export async function remove(id, user) {
  await get(id, user);
  await dLogout(id).catch(() => {});
  await prisma.device.delete({ where: { id } });
  writeLog({ type: 'DEVICE', action: 'device.delete', userId: user?.id, deviceId: id });
}

export async function connect(id, user) {
  await get(id, user);
  await dConnect(id);
  return get(id, user);
}

export async function getQr(id, user) {
  const device = await get(id, user);
  if (device.status === 'CONNECTED') return { status: 'CONNECTED', qr: null };

  if (clusterEnabled) {
    if (device.status !== 'QR') await cmd(id, 'connect').catch(() => {});
    const fresh = await prisma.device.findUnique({ where: { id }, select: { status: true, qr: true } });
    return { status: fresh?.status, qr: fresh?.qr };
  }

  if (!baileysManager.getSocket(id) && device.status !== 'QR') {
    await baileysManager.startDevice(id).catch(() => {});
  }
  return { status: device.status, qr: device.qr };
}

export async function logout(id, user) {
  await get(id, user);
  await dLogout(id);
  writeLog({ type: 'DEVICE', action: 'device.logout', userId: user?.id, deviceId: id });
  return get(id, user);
}

export async function restart(id, user) {
  await get(id, user);
  await dRestart(id);
  return get(id, user);
}

// ---- Device groups ----
export async function listGroups() {
  return prisma.deviceGroup.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { devices: true } } } });
}
export async function createGroup(data) {
  return prisma.deviceGroup.create({ data: { name: data.name, color: data.color } });
}
export async function removeGroup(id) {
  await prisma.deviceGroup.delete({ where: { id } });
}

export default {
  list, get, create, update, reassign, remove, connect, getQr, logout, restart,
  listGroups, createGroup, removeGroup,
};
