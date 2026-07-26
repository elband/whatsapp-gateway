import si from 'systeminformation';
import { prisma } from '../../config/prisma.js';
import { getQueueStats } from '../../queue/index.js';
import { ownerWhere, deviceOwnerWhere } from '../../utils/ownerScope.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function dashboard(user) {
  const today = startOfToday();
  const sentStatuses = ['SENT', 'DELIVERED', 'READ'];
  const dev = ownerWhere(user); // filter device milik user
  const msg = deviceOwnerWhere(user); // filter pesan via device milik user

  const [
    totalDevices,
    onlineDevices,
    todayMessages,
    sentToday,
    failedToday,
    incomingToday,
    outgoingToday,
    queue,
    apiRequestsToday,
    activeBroadcasts,
  ] = await Promise.all([
    prisma.device.count({ where: { ...dev } }),
    prisma.device.count({ where: { ...dev, status: 'CONNECTED' } }),
    prisma.message.count({ where: { ...msg, createdAt: { gte: today } } }),
    prisma.message.count({
      where: { ...msg, createdAt: { gte: today }, direction: 'OUTBOUND', status: { in: sentStatuses } },
    }),
    prisma.message.count({ where: { ...msg, createdAt: { gte: today }, status: 'FAILED' } }),
    prisma.message.count({ where: { ...msg, createdAt: { gte: today }, direction: 'INBOUND' } }),
    prisma.message.count({ where: { ...msg, createdAt: { gte: today }, direction: 'OUTBOUND' } }),
    getQueueStats(),
    user?.isSuperAdmin
      ? prisma.log.count({ where: { type: 'API', createdAt: { gte: today } } })
      : prisma.log.count({ where: { type: 'API', createdAt: { gte: today }, userId: user.id } }),
    prisma.broadcast.count({ where: { ...msg, status: 'RUNNING' } }),
  ]);

  return {
    totalDevices,
    onlineDevices,
    offlineDevices: totalDevices - onlineDevices,
    todayMessages,
    sentToday,
    failedToday,
    incomingToday,
    outgoingToday,
    queue,
    apiRequestsToday,
    activeBroadcasts,
  };
}

export async function system() {
  const [load, mem, fs, os, time] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.osInfo(),
    Promise.resolve(si.time()),
  ]);

  const disk = fs[0] || {};

  return {
    cpu: {
      load: round2(load.currentLoad),
      cores: load.cpus ? load.cpus.length : 0,
    },
    mem: {
      total: mem.total,
      used: mem.active,
      free: mem.available,
      usedPercent: round2((mem.active / mem.total) * 100),
    },
    disk: {
      size: disk.size || 0,
      used: disk.used || 0,
      usePercent: round2(disk.use),
    },
    uptime: round2(time.uptime),
    os: {
      distro: os.distro,
      release: os.release,
      arch: os.arch,
    },
  };
}

export async function recentActivity(limit = 20, user) {
  // Admin biasa hanya melihat aktivitas miliknya; super admin melihat semua.
  const where = user?.isSuperAdmin ? {} : { userId: user.id };
  return prisma.log.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function messageChart(days = 7, user) {
  const result = [];
  const sentStatuses = ['SENT', 'DELIVERED', 'READ'];
  const msg = deviceOwnerWhere(user);

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const range = { gte: start, lt: end };
    const [sent, failed, incoming] = await Promise.all([
      prisma.message.count({ where: { ...msg, createdAt: range, direction: 'OUTBOUND', status: { in: sentStatuses } } }),
      prisma.message.count({ where: { ...msg, createdAt: range, direction: 'OUTBOUND', status: 'FAILED' } }),
      prisma.message.count({ where: { ...msg, createdAt: range, direction: 'INBOUND' } }),
    ]);

    result.push({ date: start.toISOString().slice(0, 10), sent, failed, incoming });
  }

  return result;
}

export default { dashboard, system, recentActivity, messageChart };
