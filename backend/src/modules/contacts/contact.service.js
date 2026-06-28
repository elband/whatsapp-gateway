import xlsx from 'xlsx';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { normalizePhone } from '../../utils/phone.js';
import { writeLog } from '../../services/logService.js';
import { parseSort } from '../../utils/listQuery.js';

const contactInclude = { groups: { include: { group: true } } };
const CONTACT_SORT = ['name', 'createdAt', 'phone'];

export async function list({ skip, limit, search, groupId, tag, sort, order }) {
  const orderBy = parseSort({ sort, order }, CONTACT_SORT, 'name', 'asc');
  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ];
  }
  if (groupId) where.groups = { some: { groupId: Number(groupId) } };

  // Filter tag JSON tidak reliable di MySQL — lakukan filter di memori bila tag diisi.
  if (tag) {
    const all = await prisma.contact.findMany({
      where,
      orderBy,
      include: contactInclude,
    });
    const filtered = all.filter((c) => Array.isArray(c.tags) && c.tags.includes(tag));
    const total = filtered.length;
    const items = filtered.slice(skip, skip + limit);
    return { items, total };
  }

  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: contactInclude,
    }),
    prisma.contact.count({ where }),
  ]);
  return { items, total };
}

export async function get(id) {
  const contact = await prisma.contact.findUnique({ where: { id }, include: contactInclude });
  if (!contact) throw ApiError.notFound('Kontak tidak ditemukan');
  return contact;
}

export async function create(data, userId) {
  const phone = normalizePhone(data.phone);
  if (!phone) throw ApiError.badRequest('Nomor tidak valid');

  const contact = await prisma.contact.create({
    data: {
      name: data.name,
      phone,
      email: data.email || null,
      tags: data.tags || null,
      meta: data.meta || null,
      groups: data.groupIds?.length
        ? { create: data.groupIds.map((groupId) => ({ groupId: Number(groupId) })) }
        : undefined,
    },
    include: contactInclude,
  });
  writeLog({ type: 'CONTACT', action: 'contact.create', message: contact.name, userId });
  return contact;
}

export async function update(id, data, userId) {
  await get(id);

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.meta !== undefined) updateData.meta = data.meta;
  if (data.phone !== undefined) {
    const phone = normalizePhone(data.phone);
    if (!phone) throw ApiError.badRequest('Nomor tidak valid');
    updateData.phone = phone;
  }

  await prisma.contact.update({ where: { id }, data: updateData });

  if (data.groupIds !== undefined) {
    await prisma.contactGroupMember.deleteMany({ where: { contactId: id } });
    if (data.groupIds.length) {
      await prisma.contactGroupMember.createMany({
        data: data.groupIds.map((groupId) => ({ contactId: id, groupId: Number(groupId) })),
        skipDuplicates: true,
      });
    }
  }

  const contact = await prisma.contact.findUnique({ where: { id }, include: contactInclude });
  writeLog({ type: 'CONTACT', action: 'contact.update', message: contact.name, userId });
  return contact;
}

export async function remove(id, userId) {
  await get(id);
  await prisma.contact.delete({ where: { id } });
  writeLog({ type: 'CONTACT', action: 'contact.delete', userId });
}

// Ambil nilai kolom secara case-insensitive dari sebuah baris.
function pick(row, keys) {
  const map = {};
  for (const k of Object.keys(row)) map[k.toLowerCase().trim()] = row[k];
  for (const key of keys) {
    const val = map[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
  }
  return null;
}

export async function importFile(file, groupId, userId) {
  if (!file) throw ApiError.badRequest('File wajib diunggah');

  const workbook = xlsx.readFile(file.path);
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  const total = rows.length;
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = pick(row, ['name', 'nama']);
    const rawPhone = pick(row, ['phone', 'nomor']);
    const email = pick(row, ['email']);
    const phone = normalizePhone(rawPhone || '');
    if (!phone) {
      skipped += 1;
      continue;
    }

    const contact = await prisma.contact.upsert({
      where: { phone },
      update: {
        name: name || undefined,
        email: email || undefined,
      },
      create: {
        name: name || phone,
        phone,
        email: email || null,
      },
    });

    if (groupId) {
      await prisma.contactGroupMember.upsert({
        where: { contactId_groupId: { contactId: contact.id, groupId: Number(groupId) } },
        update: {},
        create: { contactId: contact.id, groupId: Number(groupId) },
      });
    }
    imported += 1;
  }

  writeLog({ type: 'CONTACT', action: 'contact.import', message: `imported=${imported} skipped=${skipped}`, userId });
  return { imported, skipped, total };
}

// ---- Contact groups ----
export async function listGroups() {
  return prisma.contactGroup.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { contacts: true } } },
  });
}

export async function createGroup(data) {
  return prisma.contactGroup.create({ data: { name: data.name, color: data.color || null } });
}

export async function updateGroup(id, data) {
  await prisma.contactGroup.findUnique({ where: { id } }).then((g) => {
    if (!g) throw ApiError.notFound('Grup tidak ditemukan');
  });
  return prisma.contactGroup.update({ where: { id }, data: { name: data.name, color: data.color || null } });
}

export async function removeGroup(id) {
  await prisma.contactGroup.delete({ where: { id } });
}

export default {
  list, get, create, update, remove, importFile,
  listGroups, createGroup, updateGroup, removeGroup,
};
