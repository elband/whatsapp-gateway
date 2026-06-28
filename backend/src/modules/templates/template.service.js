import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { extractVariables, renderTemplate } from '../../services/messageBuilder.js';
import { writeLog } from '../../services/logService.js';

export async function list({ skip, limit, search }) {
  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { body: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.template.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.template.count({ where }),
  ]);
  return { items, total };
}

export async function get(id) {
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) throw ApiError.notFound('Template tidak ditemukan');
  return template;
}

export async function create(data, userId) {
  const variables = extractVariables(`${data.body || ''} ${data.caption || ''}`);
  const template = await prisma.template.create({
    data: {
      name: data.name,
      type: data.type || 'TEXT',
      body: data.body,
      caption: data.caption || null,
      mediaPath: data.mediaPath || null,
      description: data.description || null,
      variables,
    },
  });
  writeLog({ type: 'TEMPLATE', action: 'template.create', message: template.name, userId });
  return template;
}

export async function update(id, data, userId) {
  const current = await get(id);

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.body !== undefined) updateData.body = data.body;
  if (data.caption !== undefined) updateData.caption = data.caption || null;
  if (data.mediaPath !== undefined) updateData.mediaPath = data.mediaPath || null;
  if (data.description !== undefined) updateData.description = data.description || null;

  if (data.body !== undefined || data.caption !== undefined) {
    const body = data.body !== undefined ? data.body : current.body;
    const caption = data.caption !== undefined ? data.caption : current.caption;
    updateData.variables = extractVariables(`${body || ''} ${caption || ''}`);
  }

  const template = await prisma.template.update({ where: { id }, data: updateData });
  writeLog({ type: 'TEMPLATE', action: 'template.update', message: template.name, userId });
  return template;
}

export async function remove(id, userId) {
  await get(id);
  await prisma.template.delete({ where: { id } });
  writeLog({ type: 'TEMPLATE', action: 'template.delete', userId });
}

export async function preview(id, variables = {}) {
  const template = await get(id);
  return {
    body: renderTemplate(template.body, variables),
    caption: renderTemplate(template.caption || '', variables),
  };
}

export default { list, get, create, update, remove, preview };
