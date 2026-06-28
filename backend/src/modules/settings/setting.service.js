import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeLog } from '../../services/logService.js';

export async function getAll(group) {
  const where = group ? { group } : {};
  return prisma.setting.findMany({
    where,
    orderBy: { key: 'asc' },
    select: { key: true, value: true, group: true },
  });
}

export async function getAsObject(group) {
  const items = await getAll(group);
  return items.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
}

export async function get(key) {
  const setting = await prisma.setting.findUnique({
    where: { key },
    select: { key: true, value: true, group: true },
  });
  if (!setting) throw ApiError.notFound('Setting tidak ditemukan');
  return setting;
}

export async function upsert(key, value, group = 'general', actorId) {
  const setting = await prisma.setting.upsert({
    where: { key },
    update: { value, group },
    create: { key, value, group },
    select: { key: true, value: true, group: true },
  });
  writeLog({ type: 'SETTING', action: 'setting.update', message: key, userId: actorId });
  return setting;
}

export async function bulkUpsert(items, actorId) {
  for (const item of items) {
    await upsert(item.key, item.value, item.group ?? 'general', actorId);
  }
  return getAll();
}

export default { getAll, getAsObject, get, upsert, bulkUpsert };
