import { prisma } from '../../config/prisma.js';
import { writeLog } from '../../services/logService.js';
import { parseSort } from '../../utils/listQuery.js';

const userSelect = { id: true, name: true, email: true };

export async function list({ skip, limit, type, level, action, userId, from, to, search, sort, order }) {
  const where = {};
  if (type) where.type = type;
  if (level) where.level = level;
  if (userId) where.userId = Number(userId);
  if (action) where.action = { contains: action };
  if (search) where.message = { contains: search };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    prisma.log.findMany({
      where,
      skip,
      take: limit,
      orderBy: parseSort({ sort, order }, ['createdAt', 'type', 'level']),
      include: { user: { select: userSelect } },
    }),
    prisma.log.count({ where }),
  ]);
  return { items, total };
}

export async function stats() {
  const [byTypeRaw, byLevelRaw] = await Promise.all([
    prisma.log.groupBy({ by: ['type'], _count: { _all: true } }),
    prisma.log.groupBy({ by: ['level'], _count: { _all: true } }),
  ]);

  const byType = {};
  for (const row of byTypeRaw) byType[row.type] = row._count._all;

  const byLevel = {};
  for (const row of byLevelRaw) byLevel[row.level] = row._count._all;

  return { byType, byLevel };
}

export async function clearOld(days = 30, actorId) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.log.deleteMany({ where: { createdAt: { lt: cutoff } } });
  writeLog({ type: 'SYSTEM', action: 'log.clear', message: `Hapus ${count} log lebih lama dari ${days} hari`, userId: actorId });
  return { deleted: count };
}

export default { list, stats, clearOld };
