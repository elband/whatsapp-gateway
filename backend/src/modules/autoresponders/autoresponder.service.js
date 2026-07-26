import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeLog } from '../../services/logService.js';
import { ownerWhere, assertOwned } from '../../utils/ownerScope.js';

// Pastikan device yang dirujuk (bila ada) milik user.
async function assertDeviceOwnedById(deviceId, user) {
  if (deviceId === undefined || deviceId === null) return;
  const device = await prisma.device.findUnique({ where: { id: Number(deviceId) }, select: { id: true, ownerId: true } });
  if (!device) throw ApiError.notFound('Device tidak ditemukan');
  if (!user?.isSuperAdmin && device.ownerId !== user.id) throw ApiError.notFound('Device tidak ditemukan');
}

// Pastikan template yang dirujuk (bila ada) milik user.
async function assertTemplateOwnedById(templateId, user) {
  if (templateId === undefined || templateId === null) return;
  const tpl = await prisma.template.findUnique({ where: { id: Number(templateId) }, select: { id: true, ownerId: true } });
  if (!tpl) throw ApiError.notFound('Template tidak ditemukan');
  if (!user?.isSuperAdmin && tpl.ownerId !== user.id) throw ApiError.notFound('Template tidak ditemukan');
}

export async function list({ skip, limit, search, deviceId }, user) {
  const where = { ...ownerWhere(user) };
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

export async function get(id, user) {
  const item = await prisma.autoresponder.findUnique({ where: { id } });
  assertOwned(item, user, 'Autoresponder tidak ditemukan');
  return item;
}

export async function create(data, user) {
  await assertDeviceOwnedById(data.deviceId, user);
  await assertTemplateOwnedById(data.templateId, user);
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
      ownerId: user.id,
    },
  });
  writeLog({ type: 'SYSTEM', action: 'autoresponder.create', message: item.name, userId: user?.id });
  return item;
}

export async function update(id, data, user) {
  await get(id, user);
  if (data.deviceId !== undefined) await assertDeviceOwnedById(data.deviceId, user);
  if (data.templateId !== undefined) await assertTemplateOwnedById(data.templateId, user);
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
  writeLog({ type: 'SYSTEM', action: 'autoresponder.update', message: item.name, userId: user?.id });
  return item;
}

export async function remove(id, user) {
  await get(id, user);
  await prisma.autoresponder.delete({ where: { id } });
  writeLog({ type: 'SYSTEM', action: 'autoresponder.delete', userId: user?.id });
}

export default { list, get, create, update, remove };
