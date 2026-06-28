import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { normalizePhone } from '../../utils/phone.js';
import * as messageService from '../messages/message.service.js';

// Daftar percakapan untuk sebuah device (dikelompokkan per nomor lawan bicara).
export async function conversations({ deviceId, skip = 0, limit = 20 }) {
  const did = Number(deviceId);
  if (!did) throw ApiError.badRequest('deviceId wajib diisi');

  const rows = await prisma.$queryRaw`
    SELECT party,
           MAX(createdAt) AS lastAt,
           SUM(CASE WHEN direction = 'INBOUND' AND seenAt IS NULL THEN 1 ELSE 0 END) AS unread,
           COUNT(*) AS total
    FROM (
      SELECT createdAt, direction, seenAt,
             CASE WHEN direction = 'INBOUND' THEN \`from\` ELSE \`to\` END AS party
      FROM messages WHERE deviceId = ${did}
    ) t
    WHERE party IS NOT NULL AND party <> ''
    GROUP BY party
    ORDER BY lastAt DESC
    LIMIT ${limit} OFFSET ${skip}
  `;

  const result = [];
  for (const r of rows) {
    const [last, contact] = await Promise.all([
      prisma.message.findFirst({
        where: { deviceId: did, OR: [{ to: r.party }, { from: r.party }] },
        orderBy: { createdAt: 'desc' },
        select: { body: true, direction: true, type: true, status: true, createdAt: true },
      }),
      prisma.contact.findUnique({ where: { phone: r.party }, select: { name: true } }),
    ]);
    result.push({
      phone: r.party,
      name: contact?.name || null,
      unread: Number(r.unread || 0),
      total: Number(r.total || 0),
      lastMessage: last,
      lastAt: r.lastAt,
    });
  }
  return result;
}

// Thread pesan dengan satu nomor.
export async function thread({ deviceId, phone, skip = 0, limit = 50 }) {
  const did = Number(deviceId);
  const p = normalizePhone(phone);
  if (!did || !p) throw ApiError.badRequest('deviceId & phone wajib diisi');
  const where = { deviceId: did, OR: [{ to: p }, { from: p }] };
  const [items, total] = await Promise.all([
    prisma.message.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { attachments: true } }),
    prisma.message.count({ where }),
  ]);
  return { items: items.reverse(), total, phone: p };
}

export async function markSeen({ deviceId, phone }) {
  const did = Number(deviceId);
  const p = normalizePhone(phone);
  const res = await prisma.message.updateMany({
    where: { deviceId: did, from: p, direction: 'INBOUND', seenAt: null },
    data: { seenAt: new Date() },
  });
  return { updated: res.count };
}

export async function reply({ deviceId, phone, body }) {
  return messageService.sendText({ deviceId, to: phone, body });
}

export default { conversations, thread, markSeen, reply };
