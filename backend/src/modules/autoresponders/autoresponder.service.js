import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeLog } from '../../services/logService.js';

export async function list({ skip, limit, search, deviceId }) {
  const where = {};
  if (deviceId) where.deviceId = Number(deviceId);
  if (search) where.OR = [{ name: { contains: search } }, { keyword: { contains: search } }];
  const [items, total] = await Promise.all([
    prisma.autoresponder.findMany({
      where, skip, take: limit,
      orderBy: [{ priority: 'desc' }, { id: 'desc' }],
      include: { device: { select: { id: true, name: true } }, template: { select: { id: true, name: true } } },
    }),
    prisma.autoresponder.count({ where }),
  ]);
  return { items, total };
}

export async function get(id) {
  const item = await prisma.autoresponder.findUnique({ where: { id } });
  if (!item) throw ApiError.notFound('Autoresponder tidak ditemukan');
  return item;
}

export async function create(data, userId) {
  const item = await prisma.autoresponder.create({
    data: {
      name: data.name,
      deviceId: data.deviceId ?? null,
      keyword: data.keyword,
      matchType: data.matchType || 'CONTAINS',
      response: data.response,
      templateId: data.templateId ?? null,
      isActive: data.isActive ?? true,
      priority: data.priority ?? 0,
    },
  });
  writeLog({ type: 'SYSTEM', action: 'autoresponder.create', message: item.name, userId });
  return item;
}

export async function update(id, data, userId) {
  await get(id);
  const item = await prisma.autoresponder.update({
    where: { id },
    data: {
      name: data.name,
      deviceId: data.deviceId,
      keyword: data.keyword,
      matchType: data.matchType,
      response: data.response,
      templateId: data.templateId,
      isActive: data.isActive,
      priority: data.priority,
    },
  });
  writeLog({ type: 'SYSTEM', action: 'autoresponder.update', message: item.name, userId });
  return item;
}

export async function remove(id, userId) {
  await get(id);
  await prisma.autoresponder.delete({ where: { id } });
  writeLog({ type: 'SYSTEM', action: 'autoresponder.delete', userId });
}

export default { list, get, create, update, remove };
