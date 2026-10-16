import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { redis } from '../config/redis.js';
import { normalizeAutoReply, isExcluded, isMatch, learnedKeyword, personalizeReply } from './autoReplyPolicy.js';
import { findMostSimilar } from './textSimilarity.js';

// Belajar dari balasan manual (opsi learnFromReplies per device): pesan masuk terakhir
// dari kontak diingat sebentar; bila pemilik membalasnya sendiri (HP / Inbox) dan
// belum ada aturan yang cocok, pasangan pesan → balasan disimpan sebagai aturan
// autoresponder baru (learned = true) milik device itu.

const LEARN_WINDOW_S = 30 * 60; // balasan manual lebih lama dari ini tidak dipasangkan
const pendingKey = (deviceId, party) => `wa:ar:learn:${deviceId}:${party}`;

// Dipanggil dari BaileysManager untuk setiap pesan masuk pribadi.
export async function rememberIncoming({ device, fromPhone, lid, text, pushName, isGroup = false }) {
  const config = normalizeAutoReply(device.autoReply);
  if (isGroup || !text || !config.learnFromReplies) return;
  // Nomor yang dikecualikan (mis. keluarga): percakapannya tidak dijadikan aturan.
  if (isExcluded(config, [fromPhone, lid]) || !learnedKeyword(text)) return;
  const value = JSON.stringify({ text, pushName: pushName || '' });
  const pipe = redis.multi();
  // Kontak LID: balasan dari HP bisa beralamat nomor maupun LID — simpan di keduanya.
  for (const p of new Set([fromPhone, lid].filter(Boolean))) pipe.set(pendingKey(device.id, p), value, 'EX', LEARN_WINDOW_S);
  await pipe.exec();
}

// Dipanggil saat manusia membalas `party` (dari HP atau Inbox) dengan teks `reply`.
// `waMessageId`: id pesan dari HP — dicek agar kiriman gateway sendiri tidak dipelajari.
export async function learnFromManualReply({ device, party, reply, waMessageId }) {
  if (!device || !party || !reply?.trim()) return;
  const config = normalizeAutoReply(device.autoReply);
  if (!config.learnFromReplies) return;
  if (waMessageId && (await prisma.message.findFirst({ where: { waMessageId }, select: { id: true } }))) return;

  // Ambil & hapus sekaligus: hanya balasan manual pertama yang dipasangkan.
  const key = pendingKey(device.id, party);
  const [[, raw]] = await redis.multi().get(key).del(key).exec();
  if (!raw) return;
  let pending;
  try {
    pending = JSON.parse(raw);
  } catch {
    return;
  }
  const keyword = learnedKeyword(pending.text);
  if (!keyword) return;

  // Sudah ada aturan aktif yang menjawab pesan ini → tidak perlu belajar.
  const scope = [{ deviceId: device.id }];
  if (config.useGlobalRules) scope.push({ deviceId: null, ownerId: device.ownerId });
  const rules = await prisma.autoresponder.findMany({
    where: { triggerType: 'MESSAGE', OR: scope },
    select: { keyword: true, matchType: true, isActive: true, deviceId: true, sample: true },
  });
  if (rules.some((r) => r.isActive && isMatch(r, pending.text))) return;
  // Pertanyaan yang sama / mirip sudah pernah dipelajari (mungkin masih menunggu ditinjau).
  if (rules.some((r) => r.deviceId === device.id && r.keyword === keyword)) return;
  const threshold = (config.similarityPercent || 80) / 100;
  if (findMostSimilar(pending.text, rules.filter((r) => r.sample), threshold)) return;

  const response = personalizeReply(reply, pending.pushName);
  if (!response) return;
  const rule = await prisma.autoresponder.create({
    data: {
      name: `Dipelajari: ${pending.text.trim().replace(/\s+/g, ' ').slice(0, 60)}`,
      deviceId: device.id,
      triggerType: 'MESSAGE',
      keyword,
      matchType: 'REGEX',
      response,
      isActive: config.learnAutoActivate,
      priority: 0,
      learned: true,
      sample: pending.text.trim().slice(0, 1000),
      ownerId: device.ownerId,
    },
  });
  logger.info({ deviceId: device.id, ruleId: rule.id, active: rule.isActive }, 'Autoresponder dipelajari dari balasan manual');
}

export default { rememberIncoming, learnFromManualReply };
