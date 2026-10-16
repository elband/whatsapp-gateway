import * as baileys from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import { Boom } from '@hapi/boom';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { clusterEnabled, SHARD_ID } from '../cluster/clusterConfig.js';
import { ownKey } from '../cluster/deviceRouter.js';
import { useDbAuthState } from './useDbAuthState.js';
import * as socket from '../realtime/emit.js';
import { dispatchWebhook } from '../services/webhookService.js';
import { writeLog } from '../services/logService.js';
import { runAutoreply, runMissedCallReply, markManualReply } from '../services/autoresponderService.js';
import { rememberIncoming, learnFromManualReply } from '../services/autoLearnService.js';
import { parseCallNode, createCallTracker } from '../services/missedCall.js';
import { fromJid } from '../utils/phone.js';

const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  isJidStatusBroadcast,
  isJidGroup,
} = baileys;

// Mengelola banyak koneksi WhatsApp (multi-device).
class BaileysManager {
  constructor() {
    /** @type {Map<number, import('@whiskeysockets/baileys').WASocket>} */
    this.sockets = new Map();
    this.starting = new Set(); // mencegah start ganda
    this.retries = new Map();
  }

  // Dipanggil saat boot: pulihkan semua device yang sebelumnya terhubung.
  async restoreAll() {
    const devices = await prisma.device.findMany({
      where: { status: { in: ['CONNECTED', 'CONNECTING', 'QR', 'INITIALIZING'] } },
    });
    logger.info(`Memulihkan ${devices.length} sesi WhatsApp...`);
    for (const device of devices) {
      this.startDevice(device.id).catch((err) =>
        logger.error({ err, deviceId: device.id }, 'Gagal memulihkan device'),
      );
    }
  }

  getSocket(devicePk) {
    return this.sockets.get(devicePk);
  }

  isConnected(devicePk) {
    const sock = this.sockets.get(devicePk);
    return Boolean(sock?.user);
  }

  async updateDeviceStatus(devicePk, data) {
    const device = await prisma.device.update({ where: { id: devicePk }, data });
    socket.emit('device:status', {
      id: device.id,
      deviceId: device.deviceId,
      status: device.status,
      phoneNumber: device.phoneNumber,
      lastSeenAt: device.lastSeenAt,
    });
    socket.emitToDevice(device.id, 'device:update', device);
    return device;
  }

  async startDevice(devicePk) {
    if (this.sockets.has(devicePk) || this.starting.has(devicePk)) {
      logger.warn({ devicePk }, 'Device sudah berjalan/sedang start');
      return;
    }
    this.starting.add(devicePk);

    try {
      const device = await prisma.device.findUnique({ where: { id: devicePk } });
      if (!device) throw new Error('Device tidak ditemukan');

      // F3: klaim kepemilikan device (anti split-brain antar shard).
      if (clusterEnabled) {
        const acquired = await redis.set(ownKey(devicePk), String(SHARD_ID), 'NX', 'EX', 30);
        if (!acquired) {
          const owner = await redis.get(ownKey(devicePk));
          if (owner !== String(SHARD_ID)) {
            logger.warn({ devicePk, owner }, 'Device dimiliki shard lain — start dilewati');
            this.starting.delete(devicePk);
            return;
          }
        }
      }

      const { state, saveCreds } = await useDbAuthState(devicePk);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false,
        browser: ['WhatsApp Gateway', 'Chrome', '1.0.0'],
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
        logger,
      });

      this.sockets.set(devicePk, sock);

      sock.ev.on('creds.update', saveCreds);
      sock.ev.on('connection.update', (update) =>
        this.handleConnectionUpdate(devicePk, update).catch((e) =>
          logger.error({ e, devicePk }, 'connection.update error'),
        ),
      );
      sock.ev.on('messages.upsert', (m) =>
        this.handleIncoming(devicePk, m).catch((e) =>
          logger.error({ e, devicePk }, 'messages.upsert error'),
        ),
      );
      sock.ev.on('messages.update', (updates) =>
        this.handleMessageUpdate(devicePk, updates).catch(() => {}),
      );
      // Panggilan masuk: pakai node mentah (bukan ev 'call') — lihat services/missedCall.js.
      const callTracker = createCallTracker();
      sock.ws.on('CB:call', (node) =>
        this.handleCall(devicePk, callTracker, node).catch((e) =>
          logger.warn({ e: e.message, devicePk }, 'Balasan panggilan tak terjawab gagal'),
        ),
      );

      await this.updateDeviceStatus(devicePk, { status: 'CONNECTING' });
    } catch (err) {
      logger.error({ err, devicePk }, 'startDevice gagal');
      this.sockets.delete(devicePk);
      throw err;
    } finally {
      this.starting.delete(devicePk);
    }
  }

  async handleConnectionUpdate(devicePk, update) {
    const { connection, lastDisconnect, qr } = update;
    const device = await prisma.device.findUnique({ where: { id: devicePk } });
    if (!device) return;

    if (qr) {
      const qrDataUrl = await qrcode.toDataURL(qr);
      await this.updateDeviceStatus(devicePk, { status: 'QR', qr: qrDataUrl });
      socket.emitToDevice(devicePk, 'device:qr', { id: devicePk, qr: qrDataUrl });
      socket.emit('device:qr', { id: devicePk, qr: qrDataUrl });
      dispatchWebhook(device, 'qr.updated', { qr: qrDataUrl });
    }

    if (connection === 'open') {
      const sock = this.sockets.get(devicePk);
      const phone = fromJid(sock?.user?.id);
      this.retries.set(devicePk, 0);
      await this.updateDeviceStatus(devicePk, {
        status: 'CONNECTED',
        qr: null,
        phoneNumber: phone,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
      });
      writeLog({ type: 'DEVICE', action: 'device.connected', message: device.name, deviceId: devicePk });
      dispatchWebhook(device, 'device.connected', { phoneNumber: phone });
      logger.info({ devicePk, phone }, 'Device terhubung');
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      this.sockets.delete(devicePk);

      if (loggedOut) {
        const { clear } = await useDbAuthState(devicePk);
        await clear();
        await this.updateDeviceStatus(devicePk, {
          status: 'LOGGED_OUT',
          qr: null,
          phoneNumber: null,
        });
        writeLog({ type: 'DEVICE', level: 'WARN', action: 'device.logged_out', deviceId: devicePk });
        dispatchWebhook(device, 'device.disconnected', { reason: 'logged_out' });
        logger.warn({ devicePk }, 'Device logout (perlu scan QR ulang)');
        return;
      }

      await this.updateDeviceStatus(devicePk, { status: 'DISCONNECTED', lastSeenAt: new Date() });
      dispatchWebhook(device, 'device.disconnected', { reason: statusCode });

      // Auto-reconnect dengan backoff.
      if (device.autoReconnect) {
        const attempt = (this.retries.get(devicePk) || 0) + 1;
        this.retries.set(devicePk, attempt);
        const delay = Math.min(30000, 2000 * attempt);
        logger.warn({ devicePk, attempt, delay }, 'Reconnect dijadwalkan');
        setTimeout(() => {
          this.startDevice(devicePk).catch((e) =>
            logger.error({ e, devicePk }, 'Reconnect gagal'),
          );
        }, delay);
      }
    }
  }

  async handleIncoming(devicePk, { messages, type }) {
    if (type !== 'notify') return;
    const device = await prisma.device.findUnique({ where: { id: devicePk } });
    if (!device) return;

    for (const msg of messages) {
      if (!msg.message) continue;
      const remoteJid = msg.key.remoteJid;
      if (isJidBroadcast(remoteJid) || isJidStatusBroadcast(remoteJid)) continue;

      // Pesan fromMe bertipe 'notify' = diketik manusia langsung di HP (kiriman
      // gateway sendiri bertipe 'append'). Catat agar auto-balas ke kontak itu jeda.
      if (msg.key.fromMe) {
        const m = msg.message;
        if (m.conversation || m.extendedTextMessage || m.imageMessage || m.videoMessage || m.audioMessage || m.documentMessage || m.stickerMessage) {
          markManualReply(devicePk, fromJid(remoteJid)).catch(() => {});
          const replyText = m.conversation || m.extendedTextMessage?.text;
          if (replyText && !isJidGroup?.(remoteJid)) {
            learnFromManualReply({ device, party: fromJid(remoteJid), reply: replyText, waMessageId: msg.key.id })
              .catch((e) => logger.warn({ e: e.message }, 'Belajar dari balasan manual gagal'));
          }
        }
        continue;
      }

      // L6: deteksi pesan grup & simpan partisipan (pengirim sebenarnya).
      const isGroup = isJidGroup ? isJidGroup(remoteJid) : String(remoteJid).endsWith('@g.us');

      // WhatsApp LID: pesan masuk bisa beralamat <id>@lid. Pakai NOMOR TELEPON asli
      // (senderPn) agar tidak terpecah dari thread nomor yang sama.
      const isLid = String(remoteJid).endsWith('@lid');
      const senderJid = isGroup
        ? msg.key.participant
        : isLid
          ? msg.key.senderPn || msg.key.participantPn || remoteJid
          : remoteJid;
      const fromPhone = fromJid(senderJid);
      const participant = isGroup ? fromPhone : null;

      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        '';

      const record = await prisma.message.create({
        data: {
          deviceId: devicePk,
          direction: 'INBOUND',
          type: 'TEXT',
          status: 'DELIVERED',
          from: isGroup ? fromJid(remoteJid) : fromPhone,
          to: device.phoneNumber,
          body,
          waMessageId: msg.key.id,
          meta: { pushName: msg.pushName, isGroup, participant, lid: isLid ? fromJid(remoteJid) : undefined, groupJid: isGroup ? remoteJid : undefined },
          deliveredAt: new Date(),
        },
      });

      socket.emit('message:incoming', record);
      const webhookResult = dispatchWebhook(device, 'message.incoming', {
        from: record.from,
        pushName: msg.pushName,
        body,
        messageId: msg.key.id,
        isGroup,
        participant,
      }).catch(() => null);

      // Auto-balas sesuai mode device (best-effort) — lihat services/autoReplyPolicy.js.
      runAutoreply({
        device,
        fromPhone,
        text: body,
        pushName: msg.pushName,
        isGroup,
        groupJid: isGroup ? remoteJid : undefined,
        lid: isLid ? fromJid(remoteJid) : undefined,
        webhookResult,
      }).catch((e) => logger.warn({ e: e.message }, 'Autoreply gagal'));
      rememberIncoming({
        device,
        fromPhone,
        lid: isLid ? fromJid(remoteJid) : undefined,
        text: body,
        pushName: msg.pushName,
        isGroup,
      }).catch(() => {});
    }
  }

  // Balas panggilan pribadi yang berakhir tanpa diangkat (aturan MISSED_CALL).
  async handleCall(devicePk, callTracker, node) {
    const missed = callTracker.track(parseCallNode(node));
    if (!missed) return;
    const device = await prisma.device.findUnique({ where: { id: devicePk } });
    if (!device) return;

    // Pemanggil bisa beralamat LID; utamakan nomor asli (caller_pn) agar balasan
    // masuk ke thread nomor yang sama. Tanpa itu, balas langsung ke alamat LID.
    const isLid = String(missed.from).endsWith('@lid');
    const fromPhone = fromJid(isLid ? missed.callerPn || missed.from : missed.from);
    if (!fromPhone || fromPhone === device.phoneNumber) return;
    const lidJid = isLid && !missed.callerPn ? `${fromPhone}@lid` : undefined;

    logger.info({ devicePk, from: fromPhone, reason: missed.reason, isVideo: missed.isVideo }, 'Panggilan tak terjawab');
    await runMissedCallReply({ device, fromPhone, lidJid, isVideo: missed.isVideo });
  }

  async handleMessageUpdate(devicePk, updates) {
    const device = await prisma.device.findUnique({ where: { id: devicePk } });
    for (const u of updates) {
      const waId = u.key?.id;
      if (!waId) continue;
      const status = u.update?.status;
      if (status === undefined) continue;

      // Baileys status: 2=SERVER_ACK(sent),3=DELIVERY_ACK(delivered),4=READ
      let newStatus = null;
      const data = {};
      if (status >= 4) {
        newStatus = 'READ';
        data.readAt = new Date();
      } else if (status === 3) {
        newStatus = 'DELIVERED';
        data.deliveredAt = new Date();
      }
      if (!newStatus) continue;

      const msg = await prisma.message.findFirst({ where: { waMessageId: waId, deviceId: devicePk } });
      if (!msg) continue;
      await prisma.message.update({ where: { id: msg.id }, data: { status: newStatus, ...data } });
      socket.emit('message:status', { id: msg.id, status: newStatus });
      if (device) {
        dispatchWebhook(device, newStatus === 'READ' ? 'message.read' : 'message.delivered', {
          messageId: waId,
          to: msg.to,
        });
      }
    }
  }

  // Kirim pesan; dipanggil oleh worker queue.
  async sendMessage(devicePk, jid, content, options = {}) {
    const sock = this.sockets.get(devicePk);
    if (!sock || !sock.user) {
      throw new Error('Device tidak terhubung');
    }
    return sock.sendMessage(jid, content, options);
  }

  // Tampilkan "sedang mengetik…" (atau "merekam audio…") ke penerima selama `ms`,
  // meniru manusia sebelum pesan terkirim. Kegagalan presence tidak menggagalkan kirim.
  async simulateTyping(devicePk, jid, ms, { recording = false } = {}) {
    const sock = this.sockets.get(devicePk);
    if (!sock?.user || ms <= 0) return;
    try {
      await sock.presenceSubscribe(jid);
      await sock.sendPresenceUpdate(recording ? 'recording' : 'composing', jid);
    } catch (err) {
      logger.debug({ err: err.message, devicePk }, 'Presence composing gagal');
    }
    await new Promise((r) => setTimeout(r, ms));
    try {
      await sock.sendPresenceUpdate('paused', jid);
    } catch {
      /* abaikan */
    }
  }

  // Cek apakah nomor terdaftar di WhatsApp.
  async checkNumber(devicePk, jid) {
    const sock = this.sockets.get(devicePk);
    if (!sock?.user) throw new Error('Device tidak terhubung');
    const [result] = await sock.onWhatsApp(jid);
    return result?.exists ? result.jid : null;
  }

  async logoutDevice(devicePk) {
    const sock = this.sockets.get(devicePk);
    try {
      if (sock) await sock.logout();
    } catch (err) {
      logger.warn({ err, devicePk }, 'logout error (diabaikan)');
    }
    this.sockets.delete(devicePk);
    this.retries.delete(devicePk);
    if (clusterEnabled) await redis.del(ownKey(devicePk)).catch(() => {});
    const { clear } = await useDbAuthState(devicePk);
    await clear();
    await this.updateDeviceStatus(devicePk, { status: 'LOGGED_OUT', qr: null, phoneNumber: null });
  }

  // Putuskan koneksi tanpa logout (sesi tetap tersimpan).
  async stopDevice(devicePk) {
    const sock = this.sockets.get(devicePk);
    try {
      sock?.end(undefined);
    } catch {
      // ignore
    }
    this.sockets.delete(devicePk);
    this.retries.delete(devicePk);
    if (clusterEnabled) await redis.del(ownKey(devicePk)).catch(() => {});
    await this.updateDeviceStatus(devicePk, { status: 'DISCONNECTED' });
  }

  // F3: id device yang dipegang proses ini (untuk perpanjang lock & heartbeat).
  ownedDeviceIds() {
    return [...this.sockets.keys()];
  }

  // Perpanjang TTL lock kepemilikan agar tidak kedaluwarsa selama aktif.
  async renewLocks() {
    if (!clusterEnabled) return;
    for (const id of this.sockets.keys()) {
      await redis.set(ownKey(id), String(SHARD_ID), 'EX', 30).catch(() => {});
    }
  }

  async shutdown() {
    for (const [pk, sock] of this.sockets) {
      try {
        sock.end(undefined);
      } catch {
        // ignore
      }
      this.sockets.delete(pk);
    }
  }
}

export const baileysManager = new BaileysManager();
export default baileysManager;
