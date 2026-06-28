import { nanoid } from 'nanoid';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { sha256, randomToken } from '../../utils/crypto.js';
import { writeLog } from '../../services/logService.js';

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

export async function list({ skip, limit, search }) {
  const where = {};
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

export async function get(id) {
  const apiKey = await prisma.apiKey.findUnique({ where: { id }, select: safeSelect });
  if (!apiKey) throw ApiError.notFound('API key tidak ditemukan');
  return apiKey;
}

export async function create(data, actorId) {
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

export async function update(id, data, actorId) {
  await get(id);
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

export async function remove(id, actorId) {
  await get(id);
  await prisma.apiKey.delete({ where: { id } });
  writeLog({ type: 'SYSTEM', action: 'apikey.delete', userId: actorId, apiKeyId: id });
}

export async function regenerate(id, actorId) {
  await get(id);
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
