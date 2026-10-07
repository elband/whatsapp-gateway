import { Worker, DelayedError } from 'bullmq';
import path from 'node:path';
import { createRedisConnection } from '../config/redis.js';
import { env } from '../config/env.js';
import { queueName } from './index.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { baileysManager } from '../whatsapp/BaileysManager.js';
import { buildContent, renderTemplate } from '../services/messageBuilder.js';
import { toJid } from '../utils/phone.js';
import * as socket from '../realtime/emit.js';
import { dispatchWebhook } from '../services/webhookService.js';
import { uploadRoot } from '../middlewares/upload.js';
import { rand, typingDelayMs, effectiveBatchSize, msUntilNextDay } from '../services/sendPolicy.js';
import { reserveSendSlot, claimDailyRecipient } from '../services/sendLimiter.js';

function resolveMedia(p) {
  if (!p) return null;
  return path.isAbsolute(p) ? p : path.resolve(uploadRoot, p);
}

// Tunda job (tanpa memakan attempt) sampai `at` (epoch ms).
async function delayJob(job, token, at) {
  await job.moveToDelayed(at, token);
  throw new DelayedError();
}

// Antre slot kirim device (satu pesan per device pada satu waktu, kelompok maks 5).
// Bila device sedang sibuk, job ditunda ke saat device bebas (+jitter kecil).
async function paceOrDelay(job, token, deviceId, opts) {
  const freeAt = await reserveSendSlot(deviceId, opts);
  if (freeAt) await delayJob(job, token, freeAt + rand(250, 1500));
}

const SENT_STATUSES = ['SENT', 'DELIVERED', 'READ'];

async function processSingle(job, token) {
  const messageId = job.data.messageId;
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { attachments: true, device: true },
  });
  if (!message) return;
  if (SENT_STATUSES.includes(message.status)) return; // sudah terkirim (job ganda)

  // Aturan anti-ban: simulasi mengetik sebanding panjang pesan; selain OTP,
  // pesan diantre berurutan per device dalam kelompok maks 5 + istirahat.
  const isOtp = message.meta?.kind === 'otp';
  const typingMs = typingDelayMs(message.body || message.caption || '', { otp: isOtp });
  if (!isOtp) {
    const sp = env.sendPolicy;
    await paceOrDelay(job, token, message.deviceId, {
      holdMs: typingMs + rand(sp.gapMinMs, sp.gapMaxMs),
      batchSize: effectiveBatchSize(env.broadcast.batchSize),
      restMs: rand(env.broadcast.batchRestMinMs, env.broadcast.batchRestMaxMs),
    });
  }

  const jid = toJid(message.to);
  if (!jid) throw new Error('Nomor tujuan tidak valid');

  // Verifikasi nomor terdaftar di WhatsApp & pakai JID kanonik hasil resolusi.
  // Mencegah status "SENT" palsu: jika nomor tidak punya WhatsApp, Baileys tetap
  // menerima pesan & mengembalikan key.id, tapi pesan tak pernah terkirim.
  let targetJid = jid;
  if (message.type !== 'GROUP' && !String(jid).endsWith('@g.us')) {
    const resolved = await baileysManager.checkNumber(message.deviceId, jid);
    if (!resolved) throw new Error('Nomor tidak terdaftar di WhatsApp');
    targetJid = resolved;
  }

  const att = message.attachments[0];
  const content = buildContent({
    type: message.type,
    body: message.body,
    caption: message.caption,
    mediaPath: resolveMedia(att?.filePath),
    fileName: att?.fileName,
    mimeType: att?.mimeType,
    location: message.meta?.location,
    contact: message.meta?.contact,
    buttons: message.meta?.buttons,
    list: message.meta?.list,
  });

  await prisma.message.update({ where: { id: messageId }, data: { status: 'SENDING' } });

  try {
    await baileysManager.simulateTyping(message.deviceId, targetJid, typingMs, { recording: message.type === 'AUDIO' });
    const sent = await baileysManager.sendMessage(message.deviceId, targetJid, content);
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENT', waMessageId: sent?.key?.id, sentAt: new Date(), error: null },
    });
    socket.emit('message:status', { id: messageId, status: 'SENT' });
    dispatchWebhook(message.device, 'message.outgoing', {
      to: message.to,
      body: message.body,
      messageId: sent?.key?.id,
      status: 'SENT',
    });
    return updated;
  } catch (err) {
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'FAILED', error: err.message },
    });
    socket.emit('message:status', { id: messageId, status: 'FAILED', error: err.message });
    throw err;
  }
}

async function processBroadcastItem(job, token) {
  const itemId = job.data.itemId;
  const item = await prisma.broadcastItem.findUnique({
    where: { id: itemId },
    include: { broadcast: { include: { device: true, template: true } } },
  });
  if (!item) return;
  // Hanya item QUEUED yang diproses: job ganda (mis. resume setelah pause) atau
  // retry setelah item final tidak boleh mengirim/menghitung dua kali.
  if (item.status !== 'QUEUED') return;
  const bc = item.broadcast;

  // Hormati status broadcast (pause/cancel).
  if (bc.status === 'CANCELLED') {
    await prisma.broadcastItem.update({ where: { id: itemId }, data: { status: 'FAILED', error: 'Dibatalkan' } });
    return;
  }
  if (bc.status === 'PAUSED') {
    // tunda job ini dan cek lagi nanti
    await delayJob(job, token, Date.now() + 10000);
  }

  // Tier harian penerima unik device: bila penuh, tunda ke hari berikutnya
  // (tersebar acak 0–30 mnt setelah 00:00 agar tidak serentak).
  const daily = await claimDailyRecipient(bc.deviceId, item.phone, bc.device.dailyRecipientLimit);
  if (!daily.allowed) {
    logger.info({ broadcastId: bc.id, itemId, limit: daily.limit }, 'Batas harian penerima tercapai, item ditunda ke besok');
    await delayJob(job, token, Date.now() + msUntilNextDay() + rand(0, 30 * 60000));
  }

  if (bc.startedAt === null) {
    await prisma.broadcast.update({ where: { id: bc.id }, data: { status: 'RUNNING', startedAt: new Date() } });
  }

  const variables = { nama: item.name, name: item.name, nomor: item.phone, ...(item.variables || {}) };
  const bodyTemplate = bc.template?.body || bc.body || '';
  const body = renderTemplate(bodyTemplate, variables);
  const caption = renderTemplate(bc.caption || bc.template?.caption || '', variables);
  const mediaPath = resolveMedia(bc.mediaPath || bc.template?.mediaPath);

  // Jeda antar penerima = simulasi mengetik (sebanding panjang pesan) + jeda acak
  // broadcast; kelompok maks 5 lalu istirahat (aturan forward WhatsApp).
  const typingMs = typingDelayMs(body || caption);
  await paceOrDelay(job, token, bc.deviceId, {
    holdMs: typingMs + rand(bc.minDelayMs, bc.maxDelayMs),
    batchSize: effectiveBatchSize(bc.batchSize),
    restMs: rand(bc.batchRestMinMs, bc.batchRestMaxMs),
  });

  // Klaim item secara atomik: hanya satu job yang boleh lanjut mengirim.
  const claimed = await prisma.broadcastItem.updateMany({
    where: { id: itemId, status: 'QUEUED' },
    data: { status: 'SENDING', attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return;

  const jid = toJid(item.phone);
  if (!jid) {
    await prisma.broadcastItem.update({ where: { id: itemId }, data: { status: 'FAILED', error: 'Nomor tidak valid' } });
    await bumpBroadcast(bc.id, 'failed');
    return;
  }

  // Verifikasi nomor terdaftar di WhatsApp & pakai JID kanonik (cegah SENT palsu).
  let targetJid = jid;
  try {
    const resolved = await baileysManager.checkNumber(bc.deviceId, jid);
    if (!resolved) {
      await prisma.broadcastItem.update({ where: { id: itemId }, data: { status: 'FAILED', error: 'Nomor tidak terdaftar di WhatsApp' } });
      await bumpBroadcast(bc.id, 'failed');
      return;
    }
    targetJid = resolved;
  } catch (err) {
    await prisma.broadcastItem.update({ where: { id: itemId }, data: { status: 'FAILED', error: err.message } });
    await bumpBroadcast(bc.id, 'failed');
    throw err;
  }

  const content = buildContent({
    type: bc.messageType,
    body,
    caption,
    mediaPath,
    fileName: mediaPath ? path.basename(mediaPath) : undefined,
  });

  try {
    await baileysManager.simulateTyping(bc.deviceId, targetJid, typingMs, { recording: bc.messageType === 'AUDIO' });
    const sent = await baileysManager.sendMessage(bc.deviceId, targetJid, content);
    const message = await prisma.message.create({
      data: {
        deviceId: bc.deviceId,
        direction: 'OUTBOUND',
        type: bc.messageType,
        status: 'SENT',
        to: item.phone,
        body,
        caption,
        waMessageId: sent?.key?.id,
        broadcastItemId: itemId,
        sentAt: new Date(),
      },
    });
    await prisma.broadcastItem.update({ where: { id: itemId }, data: { status: 'SENT', sentAt: new Date() } });
    await bumpBroadcast(bc.id, 'sent');
    dispatchWebhook(bc.device, 'message.outgoing', { to: item.phone, messageId: message.waMessageId, broadcastId: bc.id });
  } catch (err) {
    await prisma.broadcastItem.update({ where: { id: itemId }, data: { status: 'FAILED', error: err.message } });
    await bumpBroadcast(bc.id, 'failed');
    throw err;
  }
}

async function bumpBroadcast(broadcastId, kind) {
  const data = kind === 'sent' ? { sentCount: { increment: 1 } } : { failedCount: { increment: 1 } };
  const bc = await prisma.broadcast.update({ where: { id: broadcastId }, data });
  const done = bc.sentCount + bc.failedCount;
  socket.emit('broadcast:progress', {
    id: bc.id,
    sentCount: bc.sentCount,
    failedCount: bc.failedCount,
    total: bc.total,
    done,
  });
  if (done >= bc.total && bc.status === 'RUNNING') {
    await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'COMPLETED', finishedAt: new Date() } });
    socket.emit('broadcast:completed', { id: bc.id });
    dispatchWebhook(bc.device || (await prisma.device.findUnique({ where: { id: bc.deviceId } })), 'broadcast.completed', {
      broadcastId: bc.id,
      sent: bc.sentCount,
      failed: bc.failedCount,
    });
  }
}

let worker = null;

export function startWorker(shardId = 0) {
  if (worker) return worker;
  worker = new Worker(
    queueName(shardId),
    async (job, token) => {
      if (job.name === 'single') return processSingle(job, token);
      if (job.name === 'broadcast') return processBroadcastItem(job, token);
    },
    { connection: createRedisConnection(), concurrency: env.queueConcurrency },
  );

  worker.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, name: job?.name, err: err.message }, 'Job gagal');
  });
  worker.on('error', (err) => logger.error({ err }, 'Worker error'));

  logger.info({ shardId, queue: queueName(shardId) }, 'Message worker started');
  return worker;
}

export async function stopWorker() {
  if (worker) await worker.close();
}

export default startWorker;
