import { nanoid } from 'nanoid';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { sha256, randomToken } from '../../utils/crypto.js';
import { writeLog } from '../../services/logService.js';
import { ownerWhere } from '../../utils/ownerScope.js';

// Field aman yang boleh dikembalikan (tanpa keyHash).
const safeSelect = {
  id: true,
  name: true,
  keyPrefix: true,
  scopes: true,
  defaultDeviceId: true,
  rateLimit: true,
  isActive: true,
  lastUsedAt: true,
  expiresAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
};

// Generate kunci baru: format `wag_<prefix>.<secret>`.
// keyPrefix = `wag_<prefix>` (teks sebelum titik), keyHash = sha256(fullKey).
function generateKey() {
  const prefix = nanoid(10).toLowerCase();
  const secret = randomToken(24);
  const keyPrefix = `wag_${prefix}`;
  const fullKey = `${keyPrefix}.${secret}`;
  return { keyPrefix, fullKey, keyHash: sha256(fullKey) };
}

// Isolasi multi-user: API key dimiliki pembuatnya (createdById). Super admin
// melihat semua; role lain hanya key buatannya sendiri.
function keyOwnerWhere(user) {
  return user?.isSuperAdmin ? {} : { createdById: user.id };
}

// defaultDeviceId hanya boleh device milik user (cegah key dipin ke device orang lain).
async function assertDeviceUsable(deviceId, user) {
  if (deviceId === undefined || deviceId === null) return;
  const device = await prisma.device.findFirst({ where: { id: deviceId, ...ownerWhere(user) }, select: { id: true } });
  if (!device) throw ApiError.badRequest('Default device tidak ditemukan');
}

export async function list({ skip, limit, search }, user) {
  const where = { ...keyOwnerWhere(user) };
  if (search) where.OR = [{ name: { contains: search } }, { keyPrefix: { contains: search } }];

  const [items, total] = await Promise.all([
    prisma.apiKey.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: safeSelect,
    }),
    prisma.apiKey.count({ where }),
  ]);
  return { items, total };
}

export async function get(id, user) {
  // 404 (bukan 403) untuk key milik user lain — anti-IDOR.
  const apiKey = await prisma.apiKey.findFirst({ where: { id, ...keyOwnerWhere(user) }, select: safeSelect });
  if (!apiKey) throw ApiError.notFound('API key tidak ditemukan');
  return apiKey;
}

export async function create(data, user) {
  const actorId = user.id;
  await assertDeviceUsable(data.defaultDeviceId, user);
  const { keyPrefix, fullKey, keyHash } = generateKey();
  const record = await prisma.apiKey.create({
    data: {
      name: data.name,
      keyPrefix,
      keyHash,
      scopes: data.scopes ?? null,
      defaultDeviceId: data.defaultDeviceId ?? null,
      rateLimit: data.rateLimit ?? 0,
      expiresAt: data.expiresAt ?? null,
      createdById: actorId || null,
    },
    select: safeSelect,
  });
  writeLog({ type: 'SYSTEM', action: 'apikey.create', message: record.name, userId: actorId, apiKeyId: record.id });
  // tampilkan plaintext key SEKALI saja
  return { ...record, key: fullKey };
}

export async function update(id, data, user) {
  const actorId = user.id;
  await get(id, user);
  await assertDeviceUsable(data.defaultDeviceId, user);
  const record = await prisma.apiKey.update({
    where: { id },
    data: {
      name: data.name,
      scopes: data.scopes,
      defaultDeviceId: data.defaultDeviceId,
      rateLimit: data.rateLimit,
      isActive: data.isActive,
      expiresAt: data.expiresAt,
    },
    select: safeSelect,
  });
  writeLog({ type: 'SYSTEM', action: 'apikey.update', message: record.name, userId: actorId, apiKeyId: id });
  return record;
}

export async function remove(id, user) {
  const actorId = user.id;
  await get(id, user);
  await prisma.apiKey.delete({ where: { id } });
  writeLog({ type: 'SYSTEM', action: 'apikey.delete', userId: actorId, apiKeyId: id });
}

export async function regenerate(id, user) {
  const actorId = user.id;
  await get(id, user);
  const { keyPrefix, fullKey, keyHash } = generateKey();
  const record = await prisma.apiKey.update({
    where: { id },
    data: { keyPrefix, keyHash },
    select: safeSelect,
  });
  writeLog({ type: 'SYSTEM', action: 'apikey.update', message: record.name, userId: actorId, apiKeyId: id });
  return { ...record, key: fullKey };
}

export default { list, get, create, update, remove, regenerate };
