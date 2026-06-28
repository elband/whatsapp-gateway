import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword } from '../../utils/password.js';
import { writeLog } from '../../services/logService.js';

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
  isActive: true,
  lastLoginAt: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
};

export async function list({ skip, limit, search }) {
  const where = {};
  if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }];

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
}

export async function get(id) {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw ApiError.notFound('User tidak ditemukan');
  return user;
}

export async function create(data, actorId) {
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: await hashPassword(data.password),
      roleId: data.roleId,
      phone: data.phone || null,
    },
    select: userSelect,
  });
  writeLog({ type: 'SYSTEM', action: 'user.create', message: user.email, userId: actorId, meta: { id: user.id } });
  return user;
}

export async function update(id, data, actorId) {
  await get(id);
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.email !== undefined) payload.email = data.email;
  if (data.phone !== undefined) payload.phone = data.phone;
  if (data.roleId !== undefined) payload.roleId = data.roleId;
  if (data.isActive !== undefined) payload.isActive = data.isActive;
  if (data.password !== undefined) payload.password = await hashPassword(data.password);

  const user = await prisma.user.update({ where: { id }, data: payload, select: userSelect });
  writeLog({ type: 'SYSTEM', action: 'user.update', message: user.email, userId: actorId, meta: { id } });
  return user;
}

export async function remove(id, actorId) {
  await get(id);
  await prisma.user.delete({ where: { id } });
  writeLog({ type: 'SYSTEM', action: 'user.delete', userId: actorId, meta: { id } });
}

export default { list, get, create, update, remove };
