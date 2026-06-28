import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeLog } from '../../services/logService.js';

const roleInclude = {
  rolePermissions: { include: { permission: true } },
  _count: { select: { users: true } },
};

function mapRole(role) {
  if (!role) return role;
  const { rolePermissions, _count, ...rest } = role;
  return {
    ...rest,
    userCount: _count?.users ?? 0,
    permissions: (rolePermissions || []).map((rp) => rp.permission.name),
  };
}

export async function list() {
  const roles = await prisma.role.findMany({ orderBy: { id: 'asc' }, include: roleInclude });
  return roles.map(mapRole);
}

export async function get(id) {
  const role = await prisma.role.findUnique({ where: { id }, include: roleInclude });
  if (!role) throw ApiError.notFound('Role tidak ditemukan');
  return mapRole(role);
}

export async function listPermissions() {
  const permissions = await prisma.permission.findMany({ orderBy: [{ group: 'asc' }, { name: 'asc' }] });
  const grouped = {};
  for (const p of permissions) {
    if (!grouped[p.group]) grouped[p.group] = [];
    grouped[p.group].push({ id: p.id, name: p.name, description: p.description });
  }
  return grouped;
}

export async function create({ name, description, permissionIds = [] }, actorId) {
  const role = await prisma.role.create({ data: { name, description: description || null } });
  if (permissionIds.length) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }
  writeLog({ type: 'SYSTEM', action: 'role.create', message: name, userId: actorId, meta: { id: role.id } });
  return get(role.id);
}

export async function update(id, { name, description, permissionIds }, actorId) {
  await get(id);
  const payload = {};
  if (name !== undefined) payload.name = name;
  if (description !== undefined) payload.description = description;
  await prisma.role.update({ where: { id }, data: payload });

  if (permissionIds !== undefined) {
    await prisma.rolePermission.deleteMany({ where: { roleId: id } });
    if (permissionIds.length) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        skipDuplicates: true,
      });
    }
  }
  writeLog({ type: 'SYSTEM', action: 'role.update', userId: actorId, meta: { id } });
  return get(id);
}

export async function remove(id, actorId) {
  const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!role) throw ApiError.notFound('Role tidak ditemukan');
  if (role.isSystem) throw ApiError.forbidden('Role sistem tidak bisa dihapus');
  if (role._count.users > 0) throw ApiError.conflict('Role masih dipakai user');
  await prisma.role.delete({ where: { id } });
  writeLog({ type: 'SYSTEM', action: 'role.delete', userId: actorId, meta: { id } });
}

export async function assignPermissions(id, permissionIds = [], actorId) {
  await get(id);
  await prisma.rolePermission.deleteMany({ where: { roleId: id } });
  if (permissionIds.length) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      skipDuplicates: true,
    });
  }
  writeLog({ type: 'SYSTEM', action: 'role.update', userId: actorId, meta: { id, permissions: permissionIds.length } });
  return get(id);
}

export default { list, get, listPermissions, create, update, remove, assignPermissions };
