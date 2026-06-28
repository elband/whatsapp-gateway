import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { enqueueSingle } from '../queue/index.js';
import { shardForDevice } from '../cluster/deviceRouter.js';
import { renderTemplate } from './messageBuilder.js';

function isMatch(rule, text) {
  const t = (text || '').trim().toLowerCase();
  const k = (rule.keyword || '').trim().toLowerCase();
  if (!k) return false;
  switch (rule.matchType) {
    case 'EXACT':
      return t === k;
    case 'STARTS_WITH':
      return t.startsWith(k);
    case 'REGEX':
      // M10: batasi panjang pola & input untuk meredam ReDoS (regex katastrofik).
      // Untuk proteksi penuh, ganti ke library re2 (linear-time).
      if (!rule.keyword || rule.keyword.length > 200) return false;
      try {
        const sample = (text || '').slice(0, 1000);
        return new RegExp(rule.keyword, 'i').test(sample);
      } catch {
        return false;
      }
    case 'CONTAINS':
    default:
      return t.includes(k);
  }
}

// Dipanggil dari BaileysManager saat ada pesan masuk.
// Mencari autoresponder yang cocok lalu mengantre balasan.
export async function runAutoreply({ device, fromPhone, text, pushName }) {
  if (!text) return;
  const rules = await prisma.autoresponder.findMany({
    where: {
      isActive: true,
      OR: [{ deviceId: device.id }, { deviceId: null }],
    },
    orderBy: [{ priority: 'desc' }, { id: 'asc' }],
    include: { template: true },
  });

  const matched = rules.find((r) => isMatch(r, text));
  if (!matched) return;

  const vars = { nama: pushName || fromPhone, name: pushName || fromPhone, nomor: fromPhone };
  const bodyTemplate = matched.template?.body || matched.response || '';
  const body = renderTemplate(bodyTemplate, vars);
  if (!body) return;

  const message = await prisma.message.create({
    data: {
      deviceId: device.id,
      direction: 'OUTBOUND',
      type: 'TEXT',
      status: 'QUEUED',
      to: fromPhone,
      body,
      meta: { autoresponderId: matched.id },
    },
  });
  await enqueueSingle(message.id, await shardForDevice(device.id));
  await prisma.autoresponder
    .update({ where: { id: matched.id }, data: { hitCount: { increment: 1 } } })
    .catch(() => {});

  logger.info({ deviceId: device.id, ruleId: matched.id, to: fromPhone }, 'Autoreply terkirim ke antrean');
}

export default { runAutoreply };
