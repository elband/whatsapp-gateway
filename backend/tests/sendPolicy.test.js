import { describe, it, expect } from 'vitest';
import { typingDelayMs, effectiveBatchSize, dayKey, msUntilNextDay } from '../src/services/sendPolicy.js';

const policy = { typingMsPerChar: 150, typingMinMs: 2000, typingMaxMs: 20000, otpTypingMaxMs: 3000 };
const mid = () => 0.5; // jitter netral (×1.0)

describe('typingDelayMs', () => {
  it('sebanding jumlah karakter', () => {
    expect(typingDelayMs('a'.repeat(40), { policy, rnd: mid })).toBe(6000);
  });
  it('dibatasi minimum untuk pesan pendek', () => {
    expect(typingDelayMs('ok', { policy, rnd: mid })).toBe(2000);
  });
  it('dibatasi maksimum untuk pesan panjang', () => {
    expect(typingDelayMs('a'.repeat(1000), { policy, rnd: mid })).toBe(20000);
  });
  it('OTP tetap cepat (maks 3 dtk)', () => {
    expect(typingDelayMs('Kode OTP Anda: 123456. Berlaku 5 menit.', { otp: true, policy, rnd: mid })).toBe(3000);
  });
  it('emoji dihitung satu karakter', () => {
    expect(typingDelayMs('😀'.repeat(20), { policy, rnd: mid })).toBe(3000);
  });
  it('jitter ±20%', () => {
    expect(typingDelayMs('a'.repeat(40), { policy, rnd: () => 0 })).toBe(4800);
    expect(typingDelayMs('a'.repeat(40), { policy, rnd: () => 1 })).toBe(7200);
  });
});

describe('effectiveBatchSize', () => {
  it('1..5 dipertahankan', () => {
    expect(effectiveBatchSize(1)).toBe(1);
    expect(effectiveBatchSize(5)).toBe(5);
  });
  it('nilai lama / 0 / tidak valid dipaksa ke 5', () => {
    expect(effectiveBatchSize(30)).toBe(5);
    expect(effectiveBatchSize(0)).toBe(5);
    expect(effectiveBatchSize(undefined)).toBe(5);
  });
});

describe('dayKey & msUntilNextDay (Asia/Jakarta, UTC+7)', () => {
  it('pergantian hari mengikuti WIB, bukan UTC', () => {
    expect(dayKey(new Date('2026-10-06T16:59:00Z'), 'Asia/Jakarta')).toBe('2026-10-06');
    expect(dayKey(new Date('2026-10-06T17:00:00Z'), 'Asia/Jakarta')).toBe('2026-10-07');
  });
  it('sisa waktu ke 00:00 WIB', () => {
    expect(msUntilNextDay(new Date('2026-10-06T16:00:00Z'), 'Asia/Jakarta')).toBe(3600000);
  });
});
