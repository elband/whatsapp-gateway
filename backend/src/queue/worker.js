import { Worker } from 'bullmq';
import path from 'node:path';
import { createRedisConnection } from '../config/redis.js';
import { env } from '../config/env.js';
import { queueName, enqueueBroadcastItem } from './index.js';
import { shardForDevice } from '../cluster/deviceRouter.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { baileysManager } from '../whatsapp/BaileysManager.js';
import { buildContent, renderTemplate } from '../services/messageBuilder.js';
import { toJid } from '../utils/phone.js';
import * as socket from '../realtime/emit.js';
import { dispatchWebhook } from '../services/webhookService.js';
import { uploadRoot } from '../middlewares/upload.js';

function resolveMedia(p) {
  if (!p) return null;
  return path.isAbsolute(p) ? p : path.resolve(uploadRoot, p);
}

async function processSingle(messageId) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { attachments: true, device: true },
  });
  if (!message) return;

  const jid = toJid(message.to);
  if (!jid) throw new Error('Nomor tujuan tidak valid');

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
    const sent = await baileysManager.sendMessage(message.deviceId, jid, content);
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

async function processBroadcastItem(itemId) {
  const item = await prisma.broadcastItem.findUnique({
    where: { id: itemId },
    include: { broadcast: { include: { device: true, template: true } } },
  });
  if (!item) return;
  const bc = item.broadcast;

  // Hormati status broadcast (pause/cancel).
  if (bc.status === 'CANCELLED') {
    await prisma.broadcastItem.update({ where: { id: itemId }, data: { status: 'FAILED', error: 'Dibatalkan' } });
    return;
  }
  if (bc.status === 'PAUSED') {
    // tunda dan coba lagi nanti (ke shard pemilik device)
    const shard = await shardForDevice(bc.deviceId);
    await enqueueBroadcastItem(itemId, shard, 10000);
    return;
  }

  if (bc.startedAt === null) {
    await prisma.broadcast.update({ where: { id: bc.id }, data: { status: 'RUNNING', startedAt: new Date() } });
  }

  const variables = { nama: item.name, name: item.name, nomor: item.phone, ...(item.variables || {}) };
  const bodyTemplate = bc.template?.body || bc.body || '';
  const body = renderTemplate(bodyTemplate, variables);
  const caption = renderTemplate(bc.caption || bc.template?.caption || '', variables);
  const mediaPath = resolveMedia(bc.mediaPath || bc.template?.mediaPath);

  const jid = toJid(item.phone);
  if (!jid) {
    await prisma.broadcastItem.update({ where: { id: itemId }, data: { status: 'FAILED', error: 'Nomor tidak valid' } });
    await bumpBroadcast(bc.id, 'failed');
    return;
  }

  const content = buildContent({
    type: bc.messageType,
    body,
    caption,
    mediaPath,
    fileName: mediaPath ? path.basename(mediaPath) : undefined,
  });

  try {
    await prisma.broadcastItem.update({ where: { id: itemId }, data: { status: 'SENDING', attempts: { increment: 1 } } });
    const sent = await baileysManager.sendMessage(bc.deviceId, jid, content);

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
    async (job) => {
      if (job.name === 'single') return processSingle(job.data.messageId);
      if (job.name === 'broadcast') return processBroadcastItem(job.data.itemId);
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
