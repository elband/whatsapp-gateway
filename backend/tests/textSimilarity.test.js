import { describe, it, expect } from 'vitest';
import { tokens, textSimilarity, findMostSimilar } from '../src/services/textSimilarity.js';

describe('textSimilarity', () => {
  it('singkatan, akhiran -nya, sapaan & urutan kata tidak berpengaruh', () => {
    expect(tokens('Brp harganya kak?')).toEqual(['berapa', 'harga']);
    expect(textSimilarity('harga berapa?', 'brp harganya kak')).toBe(1);
    expect(textSimilarity('besok bisa ketemu?', 'bisa ketemu besok pak?')).toBe(1);
    expect(textSimilarity('sudah sampai?', 'udh nyampe?')).toBe(1);
  });
  it('salah ketik ringan masih mirip', () => {
    expect(textSimilarity('alamat kantor dimana', 'alamt kantor dmn')).toBeGreaterThanOrEqual(0.8);
  });
  it('makna berbeda di bawah 80%', () => {
    expect(textSimilarity('kantor buka jam berapa', 'kantor tutup jam berapa')).toBeLessThan(0.8);
    expect(textSimilarity('paket sudah dikirim?', 'paket sudah diterima')).toBeLessThan(0.8);
    expect(textSimilarity('harga berapa', 'kapan bisa ketemu')).toBe(0);
  });
  it('angka harus persis', () => {
    expect(textSimilarity('kamar 101', 'kamar 102')).toBeLessThan(0.8);
  });
  it('findMostSimilar: skor tertinggi di atas batas', () => {
    const items = [{ id: 1, sample: 'jam buka kantor' }, { id: 2, sample: 'harga paket berapa' }];
    expect(findMostSimilar('brp harga paketnya?', items, 0.8)?.item.id).toBe(2);
    expect(findMostSimilar('cuaca hari ini', items, 0.8)).toBeNull();
  });
});
