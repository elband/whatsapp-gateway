import { nanoid } from 'nanoid';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { baileysManager } from '../../whatsapp/BaileysManager.js';
import { writeLog } from '../../services/logService.js';
import { parseSort } from '../../utils/listQuery.js';
import { clusterEnabled } from '../../cluster/clusterConfig.js';
import { assignShard } from '../../cluster/deviceRouter.js';

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

export async function list({ skip, limit, search, status, groupId, sort, order }) {
  const where = {};
  if (status) where.status = status;
  if (groupId) where.groupId = Number(groupId);
  if (search) where.OR = [{ name: { contains: search } }, { phoneNumber: { contains: search } }];

  const [items, total] = await Promise.all([
    prisma.device.findMany({
      where,
      skip,
      take: limit,
      orderBy: parseSort({ sort, order }, ['createdAt', 'name', 'status', 'lastSeenAt']),
      include: { group: true },
    }),
    prisma.device.count({ where }),
  ]);
  const withRuntime = items.map((d) => ({ ...d, connected: isConnected(d) }));
  return { items: withRuntime, total };
}

export async function get(id) {
  const device = await prisma.device.findUnique({ where: { id }, include: { group: true } });
  if (!device) throw ApiError.notFound('Device tidak ditemukan');
  return { ...device, connected: isConnected(device) };
}

export async function create(data, userId) {
  const shardId = await assignShard(); // F3: sticky assignment device → shard
  const device = await prisma.device.create({
    data: {
      name: data.name,
      deviceId: nanoid(16),
      groupId: data.groupId || null,
      ownerId: userId || null,
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

export async function update(id, data, userId) {
  await get(id);
  const device = await prisma.device.update({
    where: { id },
    data: {
      name: data.name,
      groupId: data.groupId,
      webhookUrl: data.webhookUrl,
      webhookEvents: data.webhookEvents,
      autoReconnect: data.autoReconnect,
      quota: data.quota,
      quotaUsed: data.quotaUsed,
    },
  });
  writeLog({ type: 'DEVICE', action: 'device.update', message: device.name, userId, deviceId: id });
  return device;
}

export async function remove(id, userId) {
  await get(id);
  await dLogout(id).catch(() => {});
  await prisma.device.delete({ where: { id } });
  writeLog({ type: 'DEVICE', action: 'device.delete', userId, deviceId: id });
}

export async function connect(id) {
  await get(id);
  await dConnect(id);
  return get(id);
}

export async function getQr(id) {
  const device = await get(id);
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

export async function logout(id, userId) {
  await get(id);
  await dLogout(id);
  writeLog({ type: 'DEVICE', action: 'device.logout', userId, deviceId: id });
  return get(id);
}

export async function restart(id) {
  await get(id);
  await dRestart(id);
  return get(id);
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
  list, get, create, update, remove, connect, getQr, logout, restart,
  listGroups, createGroup, removeGroup,
};
