import { env } from '../config/env.js';

// Aturan pengiriman anti-ban yang meniru batas WhatsApp (fungsi murni, tanpa I/O):
// - Forward maks 5 chat sekaligus  → pesan dikirim per kelompok maks 5, berurutan,
//   dengan istirahat antar kelompok.
// - Jeda antar penerima sebanding panjang pesan → simulasi mengetik.
// - Tier portofolio Meta (250 / 2.000 / ...) → batas harian penerima unik per device.

export const MAX_BATCH_SIZE = 5;
export const DAILY_TIERS = [250, 2000, 10000, 100000, 0]; // 0 = tanpa batas

// Jenis pesan (Message.meta.kind) yang tidak dihitung ke tier harian: OTP (sesuai
// kebijakan), autoreply & balasan inbox (percakapan dimulai pengguna, seperti Meta).
export const DAILY_EXEMPT_KINDS = ['otp', 'autoreply', 'chat'];

export function rand(min, max, rnd = Math.random) {
  if (max < min) [min, max] = [max, min];
  return Math.floor(rnd() * (max - min + 1)) + min;
}

// Lama simulasi mengetik untuk sebuah teks (ms), ±20% acak agar tidak seragam.
// Dihitung per code point supaya emoji terhitung 1 karakter.
export function typingDelayMs(text, { otp = false, policy = env.sendPolicy, rnd = Math.random } = {}) {
  const chars = [...String(text || '')].length;
  const max = otp ? policy.otpTypingMaxMs : policy.typingMaxMs;
  const min = Math.min(otp ? 1000 : policy.typingMinMs, max);
  const jitter = 0.8 + rnd() * 0.4;
  return Math.round(Math.min(max, Math.max(min, chars * policy.typingMsPerChar * jitter)));
}

// Ukuran kelompok efektif: 1..5. Nilai lama (mis. 30) atau 0 dipaksa ke 5.
export function effectiveBatchSize(n) {
  const v = Number(n);
  return Number.isInteger(v) && v >= 1 && v <= MAX_BATCH_SIZE ? v : MAX_BATCH_SIZE;
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

// Kunci hari (YYYY-MM-DD) pada zona waktu kebijakan.
export function dayKey(date = new Date(), timeZone = env.sendPolicy.timeZone) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

// Sisa ms sampai pergantian hari (00:00) pada zona waktu kebijakan.
export function msUntilNextDay(date = new Date(), timeZone = env.sendPolicy.timeZone) {
  const p = zonedParts(date, timeZone);
  const elapsed = (Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second)) * 1000 + date.getMilliseconds();
  return 86400000 - elapsed;
}

export default {
  MAX_BATCH_SIZE, DAILY_TIERS, DAILY_EXEMPT_KINDS,
  rand, typingDelayMs, effectiveBatchSize, dayKey, msUntilNextDay,
};
