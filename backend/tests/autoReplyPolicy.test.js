import { describe, it, expect } from 'vitest';
import { normalizeAutoReply, isWithinSchedule, isMatch, pickReply, pickCallReply, appendSignature, learnedKeyword, personalizeReply, normalizeNumbers, isExcluded, DEFAULT_AUTO_REPLY, DEFAULT_SIGNATURE } from '../src/services/autoReplyPolicy.js';

describe('normalizeAutoReply', () => {
  it('NULL / bukan objek → default (perilaku lama: keyword + aturan global)', () => {
    expect(normalizeAutoReply(null)).toEqual(DEFAULT_AUTO_REPLY);
    expect(normalizeAutoReply('x')).toEqual(DEFAULT_AUTO_REPLY);
    expect(normalizeAutoReply(null).replyInGroups).toBe(false);
  });
  it('nilai tak valid jatuh ke default, nilai valid dipertahankan', () => {
    const c = normalizeAutoReply({
      mode: 'AWAY', cooldownMinutes: -5, noticeCooldownMinutes: 0, pauseAfterManualMinutes: 30,
      schedule: { days: [6, 6, 9], start: '25:00', end: '21:30', timeZone: 'Mars/Olympus' },
    });
    expect(c.mode).toBe('AWAY');
    expect(c.cooldownMinutes).toBe(0);
    expect(c.noticeCooldownMinutes).toBe(60);
    expect(c.pauseAfterManualMinutes).toBe(30);
    expect(c.schedule).toEqual({ days: [6], start: '08:00', end: '21:30', timeZone: 'Asia/Jakarta' });
  });
  it('replyDelaySeconds: default 120, 0 = langsung, di luar batas → default', () => {
    expect(normalizeAutoReply(null).replyDelaySeconds).toBe(120);
    expect(normalizeAutoReply({ replyDelaySeconds: 0 }).replyDelaySeconds).toBe(0);
    expect(normalizeAutoReply({ replyDelaySeconds: 90 }).replyDelaySeconds).toBe(90);
    expect(normalizeAutoReply({ replyDelaySeconds: 9999 }).replyDelaySeconds).toBe(120);
  });
  it('mode tak dikenal → KEYWORD', () => {
    expect(normalizeAutoReply({ mode: 'AI' }).mode).toBe('KEYWORD');
  });
});

describe('isWithinSchedule', () => {
  const office = { days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00', timeZone: 'Asia/Jakarta' };
  // 2026-10-13 = Selasa. WIB = UTC+7.
  it('di dalam & di luar jam kerja (WIB)', () => {
    expect(isWithinSchedule(office, new Date('2026-10-13T01:00:00Z'))).toBe(true); // 08:00
    expect(isWithinSchedule(office, new Date('2026-10-13T00:59:00Z'))).toBe(false); // 07:59
    expect(isWithinSchedule(office, new Date('2026-10-13T10:00:00Z'))).toBe(false); // 17:00
  });
  it('hari libur di luar jadwal', () => {
    expect(isWithinSchedule(office, new Date('2026-10-17T03:00:00Z'))).toBe(false); // Sabtu 10:00
  });
  it('zona waktu device (WIT = UTC+9)', () => {
    const wit = { ...office, timeZone: 'Asia/Jayapura' };
    expect(isWithinSchedule(wit, new Date('2026-10-12T23:30:00Z'))).toBe(true); // Selasa 08:30 WIT
    expect(isWithinSchedule(office, new Date('2026-10-12T23:30:00Z'))).toBe(false); // Selasa 06:30 WIB
  });
  it('shift melewati tengah malam dihitung dari hari mulai', () => {
    const night = { days: [5], start: '22:00', end: '06:00', timeZone: 'Asia/Jakarta' }; // Jumat malam
    expect(isWithinSchedule(night, new Date('2026-10-16T16:00:00Z'))).toBe(true); // Jumat 23:00
    expect(isWithinSchedule(night, new Date('2026-10-16T22:00:00Z'))).toBe(true); // Sabtu 05:00
    expect(isWithinSchedule(night, new Date('2026-10-16T23:00:00Z'))).toBe(false); // Sabtu 06:00
    expect(isWithinSchedule(night, new Date('2026-10-15T22:00:00Z'))).toBe(false); // Jumat 05:00
  });
  it('start == end berarti 24 jam pada hari terpilih', () => {
    const allDay = { days: [2], start: '00:00', end: '00:00', timeZone: 'Asia/Jakarta' };
    expect(isWithinSchedule(allDay, new Date('2026-10-13T15:00:00Z'))).toBe(true);
    expect(isWithinSchedule(allDay, new Date('2026-10-14T15:00:00Z'))).toBe(false);
  });
});

describe('isMatch', () => {
  it('EXACT / CONTAINS / STARTS_WITH tidak peka huruf besar', () => {
    expect(isMatch({ keyword: 'Info', matchType: 'EXACT' }, ' info ')).toBe(true);
    expect(isMatch({ keyword: 'info', matchType: 'EXACT' }, 'info dong')).toBe(false);
    expect(isMatch({ keyword: 'harga', matchType: 'CONTAINS' }, 'Berapa HARGA nya?')).toBe(true);
    expect(isMatch({ keyword: 'halo', matchType: 'STARTS_WITH' }, 'Halo kak')).toBe(true);
  });
  it('REGEX tak valid / terlalu panjang tidak cocok', () => {
    expect(isMatch({ keyword: '^(1|2)$', matchType: 'REGEX' }, '2')).toBe(true);
    expect(isMatch({ keyword: '(', matchType: 'REGEX' }, '(')).toBe(false);
    expect(isMatch({ keyword: 'a'.repeat(201), matchType: 'REGEX' }, 'a'.repeat(201))).toBe(false);
  });
});

describe('pickReply', () => {
  const cfg = (over) => normalizeAutoReply(over);
  const rules = [
    { id: 7, keyword: 'harga', matchType: 'CONTAINS', response: 'Daftar harga…' },
    { id: 9, keyword: 'promo', matchType: 'CONTAINS', response: 'lama', template: { body: 'Dari template' } },
  ];

  it('OFF tidak pernah membalas', () => {
    expect(pickReply({ config: cfg({ mode: 'OFF', fallbackMessage: 'x' }), rules, text: 'harga' })).toBeNull();
  });
  it('KEYWORD: aturan pertama yang cocok, cooldown keyword', () => {
    const r = pickReply({ config: cfg({ mode: 'KEYWORD', cooldownMinutes: 5 }), rules, text: 'cek harga' });
    expect(r).toEqual({ template: 'Daftar harga…', key: 'rule:7', cooldownMinutes: 5, ruleId: 7 });
  });
  it('KEYWORD: template mengalahkan response', () => {
    expect(pickReply({ config: cfg({}), rules, text: 'promo' }).template).toBe('Dari template');
  });
  it('KEYWORD: tanpa kecocokan → balasan default bila diisi (juga untuk pesan tanpa teks)', () => {
    expect(pickReply({ config: cfg({}), rules, text: 'apa kabar' })).toBeNull();
    const c = cfg({ fallbackMessage: 'Ketik MENU', noticeCooldownMinutes: 30 });
    expect(pickReply({ config: c, rules, text: 'apa kabar' })).toEqual({ template: 'Ketik MENU', key: 'fallback', cooldownMinutes: 30 });
    expect(pickReply({ config: c, rules, text: '' }).key).toBe('fallback');
  });
  it('KEYWORD: aturan cocok dengan response kosong = pengecualian (tanpa balasan default)', () => {
    const silent = [{ id: 1, keyword: 'inspeksi perangkat', matchType: 'CONTAINS', response: '' }, ...rules];
    const c = cfg({ fallbackMessage: 'Ketik MENU' });
    expect(pickReply({ config: c, rules: silent, text: '✅ INSPEKSI PERANGKAT: Kondisi Baik, cek harga' })).toBeNull();
    expect(pickReply({ config: c, rules: silent, text: 'cek harga' }).key).toBe('rule:7');
  });
  it('AWAY: hanya di luar jam kerja, keyword diabaikan', () => {
    const c = cfg({ mode: 'AWAY', awayMessage: 'Kami tutup' });
    expect(pickReply({ config: c, rules, text: 'harga', withinHours: true })).toBeNull();
    expect(pickReply({ config: c, rules, text: 'harga', withinHours: false })).toEqual({ template: 'Kami tutup', key: 'away', cooldownMinutes: 60 });
  });
  it('WEBHOOK: pakai reply dari aplikasi luar, abaikan yang kosong / bukan string', () => {
    const c = cfg({ mode: 'WEBHOOK' });
    expect(pickReply({ config: c, rules, text: 'harga', webhookReply: '  Halo  ' })).toEqual({ template: 'Halo', key: 'webhook', cooldownMinutes: 0 });
    expect(pickReply({ config: c, rules, text: 'harga', webhookReply: '   ' })).toBeNull();
    expect(pickReply({ config: c, rules, text: 'harga', webhookReply: { a: 1 } })).toBeNull();
    expect(pickReply({ config: c, rules, text: 'harga' })).toBeNull();
  });
});

describe('appendSignature', () => {
  it('ditempel di akhir dengan satu baris kosong; kosong / spasi = tanpa penanda', () => {
    expect(appendSignature('Halo  \n', ' _sys_\n*GW* ')).toBe('Halo\n\n_sys_\n*GW*');
    expect(appendSignature('Halo', '')).toBe('Halo');
    expect(appendSignature('Halo', '   ')).toBe('Halo');
    expect(appendSignature('', '_sys_')).toBe('');
  });
  it('profil lama tanpa field signature ikut default; string kosong dipertahankan', () => {
    expect(normalizeAutoReply({ mode: 'KEYWORD' }).signature).toBe(DEFAULT_SIGNATURE);
    expect(normalizeAutoReply({ mode: 'KEYWORD', signature: '' }).signature).toBe('');
    expect(normalizeAutoReply({ signature: 'x'.repeat(600) }).signature).toHaveLength(500);
  });
});

describe('pickCallReply', () => {
  const cfg = (over) => normalizeAutoReply(over);
  const rules = [
    { id: 3, response: '' },
    { id: 4, response: 'Maaf, telepon belum terangkat' },
    { id: 5, response: 'lain' },
  ];

  it('OFF tidak membalas; mode lain memakai aturan pertama yang punya isi', () => {
    expect(pickCallReply({ config: cfg({ mode: 'OFF' }), rules })).toBeNull();
    for (const mode of ['KEYWORD', 'AWAY', 'WEBHOOK']) {
      expect(pickCallReply({ config: cfg({ mode, awayMessage: 'x', noticeCooldownMinutes: 15 }), rules })).toEqual({
        template: 'Maaf, telepon belum terangkat', key: 'call:4', cooldownMinutes: 15, ruleId: 4,
      });
    }
  });
  it('template mengalahkan response; tanpa aturan → null', () => {
    expect(pickCallReply({ config: cfg({}), rules: [{ id: 1, response: 'a', template: { body: 'T' } }] }).template).toBe('T');
    expect(pickCallReply({ config: cfg({}), rules: [] })).toBeNull();
  });
});

describe('learnedKeyword', () => {
  const kw = (t) => learnedKeyword(t);
  const hit = (t, msg) => isMatch({ keyword: kw(t), matchType: 'REGEX' }, msg);
  it('1–2 kata: harus seluruh pesan, tanda baca bebas', () => {
    expect(hit('Ok', 'ok!')).toBe(true);
    expect(hit('Ok', 'oke, besok saya ke sana')).toBe(false);
    expect(hit('harga berapa?', 'Harga  berapa')).toBe(true);
    expect(hit('harga berapa?', 'harga berapa kak')).toBe(false);
  });
  it('3+ kata: cukup terkandung, per kata utuh', () => {
    expect(hit('kantor buka jam berapa', 'Pak, kantor buka jam berapa ya?')).toBe(true);
    expect(hit('kantor buka jam berapa', 'kantornya buka jam berapa')).toBe(false);
  });
  it('pesan kosong / emoji / terlalu panjang → null', () => {
    expect(kw('')).toBeNull();
    expect(kw('👍')).toBeNull();
    expect(kw('a')).toBeNull();
    expect(kw('satu dua tiga empat lima enam tujuh delapan sembilan')).toBeNull();
  });
});

describe('personalizeReply', () => {
  it('nama kontak → {{nama}}', () => {
    expect(personalizeReply('Siap Pak Budi, besok ya', 'budi')).toBe('Siap Pak {{nama}}, besok ya');
  });
  it('nama pendek / kosong tidak diganti', () => {
    expect(personalizeReply(' oke ', 'Al')).toBe('oke');
    expect(personalizeReply('oke (1)', '')).toBe('oke (1)');
  });
});

describe('nomor dikecualikan', () => {
  it('dinormalisasi & dicocokkan dengan nomor/LID/grup', () => {
    expect(normalizeNumbers(['0812-3456-7890', '6281234567890', '', 'abc', 120363012345])).toEqual(['6281234567890', '120363012345']);
    const config = normalizeAutoReply({ excludedNumbers: ['081234567890'] });
    expect(isExcluded(config, ['6281234567890'])).toBe(true);
    expect(isExcluded(config, ['6289999999999', undefined])).toBe(false);
  });
});

describe('pickReply kemiripan', () => {
  const config = normalizeAutoReply({ mode: 'KEYWORD', fallbackMessage: 'default' });
  const rules = [{ id: 7, keyword: '^\W*harga\W+berapa\W*$', matchType: 'REGEX', response: 'Rp50rb', sample: 'harga berapa?' }];
  it('pesan mirip dijawab aturan, bukan balasan default', () => {
    expect(pickReply({ config, rules, text: 'brp harganya kak?' })?.ruleId).toBe(7);
  });
  it('tidak mirip → balasan default; kemiripan 0 = hanya keyword', () => {
    expect(pickReply({ config, rules, text: 'kapan buka?' })?.key).toBe('fallback');
    expect(pickReply({ config: { ...config, similarityPercent: 0 }, rules, text: 'brp harganya kak?' })?.key).toBe('fallback');
  });
  it('default jeda setelah dibalas manual 30 menit', () => {
    expect(normalizeAutoReply(null).pauseAfterManualMinutes).toBe(30);
  });
});
