import crypto from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { normalizePhone } from '../../utils/phone.js';
import { sha256 } from '../../utils/crypto.js';
import { renderTemplate } from '../../services/messageBuilder.js';
import * as messageService from '../messages/message.service.js';
import { writeLog } from '../../services/logService.js';

const COOLDOWN_MS = 60_000; // jeda minimal antar permintaan OTP per nomor

function genCode(length = 6) {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(length, '0');
}

// M11: simpan hash OTP (bukan plaintext) — terikat ke nomor agar tidak bisa dipakai silang.
function hashCode(code, phone) {
  return sha256(`${code}:${phone}`);
}

// Kirim OTP via WhatsApp. message default: "Kode OTP Anda: {{code}}"
export async function send({ deviceId, to, length = 6, purpose, expiresMinutes = 5, template, apiKey, apiKeyId, user }) {
  const phone = normalizePhone(to);
  if (!phone) throw ApiError.badRequest('Nomor tidak valid');

  // Cooldown anti-spam per nomor.
  const recent = await prisma.otp.findFirst({
    where: { phone, createdAt: { gt: new Date(Date.now() - COOLDOWN_MS) } },
    orderBy: { id: 'desc' },
  });
  if (recent) throw ApiError.tooMany('Tunggu sebentar sebelum meminta OTP lagi');

  const code = genCode(Math.min(8, Math.max(4, length)));
  const text = renderTemplate(template || 'Kode OTP Anda: {{code}}. Berlaku {{minutes}} menit. Jangan bagikan kode ini.', {
    code, minutes: expiresMinutes,
  });

  // Kirim lewat pipeline pesan biasa (kena kuota & queue). user diteruskan agar
  // via JWT dashboard tidak bisa kirim lewat device milik user lain.
  await messageService.sendText({ deviceId, to: phone, body: text, apiKey, apiKeyId, user });

  const otp = await prisma.otp.create({
    data: {
      deviceId: deviceId ? Number(deviceId) : apiKey?.defaultDeviceId || null,
      phone,
      code: hashCode(code, phone),
      purpose: purpose || null,
      expiresAt: new Date(Date.now() + expiresMinutes * 60000),
    },
  });

  writeLog({ type: 'SYSTEM', action: 'otp.send', message: phone, apiKeyId });
  return { otpId: otp.id, to: phone, expiresAt: otp.expiresAt };
}

export async function verify({ to, code, purpose }) {
  const phone = normalizePhone(to);
  if (!phone) throw ApiError.badRequest('Nomor tidak valid');

  const otp = await prisma.otp.findFirst({
    where: { phone, verifiedAt: null, ...(purpose ? { purpose } : {}) },
    orderBy: { id: 'desc' },
  });
  if (!otp) return { valid: false, reason: 'OTP tidak ditemukan' };
  if (otp.expiresAt < new Date()) return { valid: false, reason: 'OTP kedaluwarsa' };
  if (otp.attempts >= 5) return { valid: false, reason: 'Terlalu banyak percobaan' };

  if (otp.code !== hashCode(String(code), phone)) {
    await prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { valid: false, reason: 'Kode salah' };
  }

  await prisma.otp.update({ where: { id: otp.id }, data: { verifiedAt: new Date() } });
  return { valid: true };
}

export default { send, verify };
