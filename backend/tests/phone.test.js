import { describe, it, expect } from 'vitest';
import { normalizePhone, toJid, fromJid } from '../src/utils/phone.js';

describe('phone util', () => {
  it('normalisasi 08xx -> 628xx', () => {
    expect(normalizePhone('08123456789')).toBe('628123456789');
  });
  it('normalisasi format internasional', () => {
    expect(normalizePhone('+62 812-3456-789')?.startsWith('62')).toBe(true);
  });
  it('input invalid -> null', () => {
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
  it('toJid menghasilkan suffix WhatsApp', () => {
    expect(toJid('08123456789')).toBe('628123456789@s.whatsapp.net');
  });
  it('fromJid mengekstrak nomor', () => {
    expect(fromJid('628123456789@s.whatsapp.net')).toBe('628123456789');
    expect(fromJid('628123456789:12@s.whatsapp.net')).toBe('628123456789');
  });

  it('IDEMPOTEN: nomor berawalan 62 tidak ditambah 62 lagi (anti bug dobel)', () => {
    expect(normalizePhone('62811522204')).toBe('62811522204');
    // normalisasi berulang tetap sama
    const once = normalizePhone('0811522204');
    expect(normalizePhone(once)).toBe(once);
    expect(once).toBe('62811522204');
    // 8xx (mobile ID tanpa 0) -> 628xx, lalu idempoten
    expect(normalizePhone('811522204')).toBe('62811522204');
    // toJid juga tidak menggandakan
    expect(toJid('62811522204')).toBe('62811522204@s.whatsapp.net');
  });
});
