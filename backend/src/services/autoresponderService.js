import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { redis } from '../config/redis.js';
import { enqueueSingle } from '../queue/index.js';
import { shardForDevice } from '../cluster/deviceRouter.js';
import { renderTemplate } from './messageBuilder.js';
import { normalizeAutoReply, isWithinSchedule, pickReply, pickCallReply, appendSignature } from './autoReplyPolicy.js';

// Kebijakan (mode, jam kerja, pemilihan balasan) ada di services/autoReplyPolicy.js;
// di sini penegakannya: jeda setelah balasan manual, cooldown per kontak, dan
// rem anti-loop — semuanya di Redis agar konsisten antar proses/shard.

const manualKey = (deviceId, party) => `wa:ar:manual:${deviceId}:${party}`;
const cooldownKey = (deviceId, party, key) => `wa:ar:cd:${deviceId}:${party}:${key}`;
const loopKey = (deviceId, party) => `wa:ar:loop:${deviceId}:${party}`;

const MANUAL_TTL_S = 86400; // = batas atas pauseAfterManualMinutes (1440 mnt)
// Rem anti-loop (mis. dua bot saling balas): maks balasan otomatis per kontak per jendela.
const LOOP_WINDOW_S = 600;
const LOOP_MAX = 10;

// Catat bahwa manusia baru saja membalas `party` (nomor / id grup) lewat inbox
// atau langsung dari HP. Auto-balas ke kontak itu diam selama
// `pauseAfterManualMinutes` milik device.
export async function markManualReply(deviceId, party) {
  if (!deviceId || !party) return;
  await redis.set(manualKey(deviceId, party), Date.now(), 'EX', MANUAL_TTL_S);
}

async function lastManualReply(deviceId, parties) {
  const values = await redis.mget(parties.map((p) => manualKey(deviceId, p)));
  return Math.max(0, ...values.map((v) => Number(v) || 0));
}

async function isPaused(deviceId, parties, minutes) {
  if (!minutes) return false;
  return Date.now() - (await lastManualReply(deviceId, parties)) < minutes * 60000;
}

// Dipakai worker sebelum mengirim balasan yang ditunda (replyDelaySeconds):
// apakah manusia sudah membalas salah satu `parties` sejak `sinceMs`?
export async function repliedManuallySince(deviceId, parties, sinceMs) {
  const list = (parties || []).filter(Boolean);
  if (!deviceId || !list.length) return false;
  return (await lastManualReply(deviceId, list)) >= sinceMs;
}

// Dipanggil dari BaileysManager saat ada pesan masuk.
// `webhookResult`: promise respons webhook message.incoming (dipakai mode WEBHOOK).
export async function runAutoreply({ device, fromPhone, text, pushName, isGroup = false, groupJid, lid, webhookResult }) {
  const config = normalizeAutoReply(device.autoReply);
  if (config.mode === 'OFF') return;
  if (isGroup && !config.replyInGroups) return;

  // Lawan bicara = kunci thread inbox: id grup untuk grup, nomor untuk chat pribadi.
  const party = isGroup ? String(groupJid).split('@')[0] : fromPhone;
  if (!party) return;
  if (await isPaused(device.id, [party, lid].filter(Boolean), config.pauseAfterManualMinutes)) return;

  let rules = [];
  if (config.mode === 'KEYWORD' && text) {
    // Multi-user: cocokkan autoresponder yang menyasar device ini secara spesifik,
    // ATAU yang berlaku "semua device" (deviceId null) TAPI hanya milik pemilik device
    // yang sama — agar aturan user A tidak terpicu di device milik user B.
    const scope = [{ deviceId: device.id }];
    if (config.useGlobalRules) scope.push({ deviceId: null, ownerId: device.ownerId });
    rules = await prisma.autoresponder.findMany({
      where: { isActive: true, triggerType: 'MESSAGE', OR: scope },
      orderBy: [{ priority: 'desc' }, { id: 'asc' }],
      include: { template: true },
    });
  }

  const webhookReply = config.mode === 'WEBHOOK' ? (await webhookResult)?.reply : undefined;
  const reply = pickReply({
    config,
    rules,
    text,
    withinHours: isWithinSchedule(config.schedule),
    webhookReply,
  });
  if (!reply) return;

  const vars = { nama: pushName || fromPhone, name: pushName || fromPhone, nomor: fromPhone };
  // Balasan webhook sudah final dari aplikasi luar — jangan dirender sebagai template.
  const body = reply.key === 'webhook' ? reply.template : appendSignature(renderTemplate(reply.template, vars), config.signature);
  if (!body) return;

  // Pengirim hanya dikenal lewat LID (nomor asli tidak ikut terkirim): `party` berisi
  // id LID, bukan nomor — balasan harus dialamatkan ke JID LID-nya (lihat worker).
  const lidOnly = !isGroup && lid && lid === fromPhone;
  await queueReply({
    device,
    party,
    reply,
    body,
    delaySeconds: config.replyDelaySeconds,
    manualParties: [party, lid].filter(Boolean),
    meta: isGroup ? { groupJid } : lidOnly ? { lidJid: `${lid}@lid` } : {},
  });
}

// Dipanggil dari BaileysManager saat panggilan masuk berakhir tanpa diangkat.
// `lidJid` diisi bila nomor asli pemanggil tidak diketahui (hanya alamat LID).
export async function runMissedCallReply({ device, fromPhone, lidJid, isVideo = false }) {
  const config = normalizeAutoReply(device.autoReply);
  if (config.mode === 'OFF' || !fromPhone) return;
  if (await isPaused(device.id, [fromPhone], config.pauseAfterManualMinutes)) return;

  const scope = [{ deviceId: device.id }];
  if (config.useGlobalRules) scope.push({ deviceId: null, ownerId: device.ownerId });
  const rules = await prisma.autoresponder.findMany({
    where: { isActive: true, triggerType: 'MISSED_CALL', OR: scope },
    orderBy: [{ priority: 'desc' }, { id: 'asc' }],
    include: { template: true },
  });
  const reply = pickCallReply({ config, rules });
  if (!reply) return;

  // Panggilan tidak membawa pushName — pakai nama dari buku kontak pemilik bila ada.
  const contact = lidJid
    ? null
    : await prisma.contact.findFirst({ where: { ownerId: device.ownerId, phone: fromPhone }, select: { name: true } });
  const nama = contact?.name || fromPhone;
  const body = appendSignature(renderTemplate(reply.template, { nama, name: nama, nomor: fromPhone }), config.signature);
  if (!body) return;

  await queueReply({
    device,
    party: fromPhone,
    reply,
    body,
    delaySeconds: config.replyDelaySeconds,
    manualParties: [fromPhone, lidJid && String(lidJid).split('@')[0]].filter(Boolean),
    meta: { trigger: 'missed_call', isVideo, ...(lidJid ? { lidJid } : {}) },
  });
}

// Cooldown per kontak per jenis balasan (klaim atomik), rem anti-loop, lalu
// masukkan balasan ke antrean kirim. `delaySeconds` > 0: job ditunda dan worker
// membatalkannya bila dalam jeda itu manusia membalas salah satu `manualParties`.
async function queueReply({ device, party, reply, body, delaySeconds = 0, manualParties = [], meta = {} }) {
  if (reply.cooldownMinutes > 0) {
    const claimed = await redis.set(cooldownKey(device.id, party, reply.key), 1, 'EX', reply.cooldownMinutes * 60, 'NX');
    if (!claimed) return;
  }
  const count = await redis.incr(loopKey(device.id, party));
  if (count === 1) await redis.expire(loopKey(device.id, party), LOOP_WINDOW_S);
  if (count > LOOP_MAX) {
    if (count === LOOP_MAX + 1) logger.warn({ deviceId: device.id, party }, 'Autoreply dihentikan sementara (rem anti-loop)');
    return;
  }

  const message = await prisma.message.create({
    data: {
      deviceId: device.id,
      direction: 'OUTBOUND',
      type: 'TEXT',
      status: 'QUEUED',
      to: party,
      body,
      meta: {
        kind: 'autoreply',
        autoReplyKey: reply.key,
        ...(reply.ruleId ? { autoresponderId: reply.ruleId } : {}),
        ...(delaySeconds > 0 ? { waitForManual: manualParties } : {}),
        ...meta,
      },
    },
  });
  await enqueueSingle(message.id, await shardForDevice(device.id), delaySeconds > 0 ? { delay: delaySeconds * 1000 } : {});
  if (reply.ruleId) {
    await prisma.autoresponder
      .update({ where: { id: reply.ruleId }, data: { hitCount: { increment: 1 } } })
      .catch(() => {});
  }

  logger.info({ deviceId: device.id, reply: reply.key, to: party, delaySeconds }, 'Autoreply terkirim ke antrean');
}

export default { runAutoreply, runMissedCallReply, markManualReply, repliedManuallySince };
