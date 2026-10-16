// Kebijakan auto-balas per device (fungsi murni, tanpa I/O). Konfigurasinya
// disimpan di Device.autoReply (JSON); penegakan cooldown/jeda ada di
// services/autoresponderService.js (Redis).
//
// Mode:
// - OFF     : device tidak pernah membalas otomatis (mis. device OTP/notifikasi).
// - KEYWORD : aturan keyword (tabel autoresponders) + balasan default opsional.
// - AWAY    : diam saat jam kerja, kirim pesan "di luar jam kerja" di luar itu.
// - WEBHOOK : balasan ditentukan aplikasi luar lewat respons webhook message.incoming.
//
// Di luar mode: aturan ber-triggerType MISSED_CALL membalas panggilan yang tidak
// terangkat pada semua mode selain OFF (lihat pickCallReply).

import { normalizePhone } from '../utils/phone.js';
import { findMostSimilar } from './textSimilarity.js';

export const AUTO_REPLY_MODES = ['OFF', 'KEYWORD', 'AWAY', 'WEBHOOK'];
export const AUTO_REPLY_TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']; // WIB, WITA, WIT
export const MAX_REPLY_LENGTH = 4096;
export const MAX_SIGNATURE_LENGTH = 500;
// Batas jeda tunggu; harus jauh di bawah umur maksimal balasan di antrean (worker: 15 mnt).
export const MAX_REPLY_DELAY_S = 600;
// Penanda di akhir setiap balasan otomatis (format WhatsApp: _miring_, *tebal*).
export const MAX_EXCLUDED_NUMBERS = 500;
export const DEFAULT_SIGNATURE = '_Ini adalah Pesan dari System:_\n*WhatsApp Gateway Enterprise*';

// Default = perilaku sebelum fitur ini ada (keyword + aturan global), kecuali
// grup yang kini tidak dibalas. Device lama (autoReply NULL) memakai nilai ini.
export const DEFAULT_AUTO_REPLY = Object.freeze({
  mode: 'KEYWORD',
  replyInGroups: false,
  useGlobalRules: true, // ikut aturan "semua device" milik pemilik
  cooldownMinutes: 0, // jeda keyword yang sama per kontak (0 = selalu balas)
  noticeCooldownMinutes: 60, // jeda balasan default / di luar jam kerja per kontak
  pauseAfterManualMinutes: 30, // diam ke kontak yang sedang dibalas manusia (0 = nonaktif)
  replyDelaySeconds: 120, // tunggu dulu; batal bila manusia membalas dalam jeda ini (0 = langsung)
  learnFromReplies: false, // balasan manual atas pesan tanpa aturan dijadikan aturan baru
  learnAutoActivate: false, // aturan hasil belajar langsung aktif (false = menunggu ditinjau)
  similarityPercent: 80, // kemiripan minimum pesan vs contoh pertanyaan aturan (0 = hanya keyword)
  excludedNumbers: Object.freeze([]), // nomor / id grup yang tidak pernah dibalas otomatis
  fallbackMessage: '',
  awayMessage: '',
  signature: DEFAULT_SIGNATURE, // ditempel di akhir balasan otomatis ('' = tanpa penanda)
  schedule: Object.freeze({ days: Object.freeze([1, 2, 3, 4, 5]), start: '08:00', end: '17:00', timeZone: 'Asia/Jakarta' }),
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const intIn = (v, min, max, def) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
};
const str = (v) => (typeof v === 'string' ? v : '');

// Daftar nomor dikecualikan: dinormalisasi (08xx → 628xx), unik, dibatasi jumlahnya.
// Id grup (120363…) & LID ikut lewat normalizePhone apa adanya (hanya digit).
export function normalizeNumbers(list) {
  if (!Array.isArray(list)) return [];
  const out = new Set();
  for (const v of list) {
    const n = normalizePhone(typeof v === 'string' || typeof v === 'number' ? String(v) : '');
    if (n) out.add(n);
    if (out.size >= MAX_EXCLUDED_NUMBERS) break;
  }
  return [...out];
}

// Apakah salah satu `parties` (nomor / LID / id grup) ada di daftar pengecualian?
export function isExcluded(config, parties) {
  const list = config.excludedNumbers || [];
  return list.length > 0 && parties.some((p) => p && list.includes(String(p)));
}

// Lengkapi konfigurasi tersimpan dengan default; nilai tak valid diabaikan.
export function normalizeAutoReply(raw) {
  const d = DEFAULT_AUTO_REPLY;
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const s = r.schedule && typeof r.schedule === 'object' ? r.schedule : {};
  const days = Array.isArray(s.days)
    ? [...new Set(s.days.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))]
    : null;
  return {
    mode: AUTO_REPLY_MODES.includes(r.mode) ? r.mode : d.mode,
    replyInGroups: typeof r.replyInGroups === 'boolean' ? r.replyInGroups : d.replyInGroups,
    useGlobalRules: typeof r.useGlobalRules === 'boolean' ? r.useGlobalRules : d.useGlobalRules,
    cooldownMinutes: intIn(r.cooldownMinutes, 0, 1440, d.cooldownMinutes),
    noticeCooldownMinutes: intIn(r.noticeCooldownMinutes, 1, 1440, d.noticeCooldownMinutes),
    pauseAfterManualMinutes: intIn(r.pauseAfterManualMinutes, 0, 1440, d.pauseAfterManualMinutes),
    replyDelaySeconds: intIn(r.replyDelaySeconds, 0, MAX_REPLY_DELAY_S, d.replyDelaySeconds),
    learnFromReplies: typeof r.learnFromReplies === 'boolean' ? r.learnFromReplies : d.learnFromReplies,
    learnAutoActivate: typeof r.learnAutoActivate === 'boolean' ? r.learnAutoActivate : d.learnAutoActivate,
    similarityPercent: r.similarityPercent === 0 ? 0 : intIn(r.similarityPercent, 50, 100, d.similarityPercent),
    excludedNumbers: normalizeNumbers(r.excludedNumbers),
    fallbackMessage: str(r.fallbackMessage),
    awayMessage: str(r.awayMessage),
    // Profil lama (belum punya field ini) ikut default; string kosong = sengaja dimatikan.
    signature: typeof r.signature === 'string' ? r.signature.slice(0, MAX_SIGNATURE_LENGTH) : d.signature,
    schedule: {
      days: days && days.length ? days : [...d.schedule.days],
      start: HHMM.test(s.start) ? s.start : d.schedule.start,
      end: HHMM.test(s.end) ? s.end : d.schedule.end,
      timeZone: AUTO_REPLY_TIMEZONES.includes(s.timeZone) ? s.timeZone : d.schedule.timeZone,
    },
  };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// Apakah `date` berada di dalam jam kerja? days: 0 = Minggu … 6 = Sabtu.
// start == end berarti 24 jam; start > end berarti shift melewati tengah malam
// (hari dihitung dari hari shift dimulai).
export function isWithinSchedule(schedule, date = new Date()) {
  const { days, start, end, timeZone } = schedule;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const day = WEEKDAYS.indexOf(p.weekday);
  const now = Number(p.hour) * 60 + Number(p.minute);
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return days.includes(day);
  if (s < e) return days.includes(day) && now >= s && now < e;
  return (now >= s && days.includes(day)) || (now < e && days.includes((day + 6) % 7));
}

export function isMatch(rule, text) {
  const t = (text || '').trim().toLowerCase();
  const k = (rule.keyword || '').trim().toLowerCase();
  if (!k) return false;
  switch (rule.matchType) {
    case 'EXACT':
      return t === k;
    case 'STARTS_WITH':
      return t.startsWith(k);
    case 'REGEX':
      // M10: batasi panjang pola & input untuk meredam ReDoS (regex katastrofik).
      // Untuk proteksi penuh, ganti ke library re2 (linear-time).
      if (!rule.keyword || rule.keyword.length > 200) return false;
      try {
        const sample = (text || '').slice(0, 1000);
        return new RegExp(rule.keyword, 'i').test(sample);
      } catch {
        return false;
      }
    case 'CONTAINS':
    default:
      return t.includes(k);
  }
}

// Tentukan balasan untuk satu pesan masuk. `rules` sudah terurut prioritas.
// Return null (tidak membalas) atau { template, key, cooldownMinutes, ruleId? }
// — `key` membedakan cooldown per jenis balasan.
export function pickReply({ config, rules = [], text, withinHours, webhookReply }) {
  switch (config.mode) {
    case 'KEYWORD': {
      let matched = text ? rules.find((r) => isMatch(r, text)) : null;
      // Tak ada keyword yang cocok: cari aturan dengan contoh pertanyaan yang paling mirip.
      if (!matched && text && config.similarityPercent > 0) {
        const withSample = rules.filter((r) => r.sample && (r.template?.body || r.response));
        matched = findMostSimilar(text, withSample, config.similarityPercent / 100)?.item || null;
      }
      if (matched) {
        // Aturan cocok tanpa isi = pengecualian: tidak dibalas, balasan default pun tidak.
        const template = matched.template?.body || matched.response || '';
        return template
          ? { template, key: `rule:${matched.id}`, cooldownMinutes: config.cooldownMinutes, ruleId: matched.id }
          : null;
      }
      return config.fallbackMessage.trim()
        ? { template: config.fallbackMessage, key: 'fallback', cooldownMinutes: config.noticeCooldownMinutes }
        : null;
    }
    case 'AWAY':
      return !withinHours && config.awayMessage.trim()
        ? { template: config.awayMessage, key: 'away', cooldownMinutes: config.noticeCooldownMinutes }
        : null;
    case 'WEBHOOK': {
      const reply = typeof webhookReply === 'string' ? webhookReply.trim().slice(0, MAX_REPLY_LENGTH) : '';
      return reply ? { template: reply, key: 'webhook', cooldownMinutes: 0 } : null;
    }
    default:
      return null;
  }
}

// Tempelkan penanda device di akhir balasan (dipisah satu baris kosong).
export function appendSignature(body, signature) {
  const sig = (signature || '').trim();
  if (!body || !sig) return body;
  return `${body.trimEnd()}\n\n${sig}`.slice(0, MAX_REPLY_LENGTH);
}

// Belajar dari balasan manual: pesan masuk pendek (maks LEARN_MAX_WORDS kata) dijadikan
// keyword REGEX per kata utuh, tanda baca & spasi bebas. 1–2 kata harus sama dengan
// seluruh pesan (agar "ok" tidak cocok dengan "oke, besok saya ke sana"); 3 kata atau
// lebih cukup terkandung di pesan. null = pesan tidak layak dijadikan keyword.
export const LEARN_MAX_WORDS = 8;
export function learnedKeyword(text) {
  const words = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  if (!words.length || words.length > LEARN_MAX_WORDS) return null;
  if (words.join('').length < 2) return null;
  const body = words.join('\\W+');
  return words.length <= 2 ? `^\\W*${body}\\W*$` : `\\b${body}\\b`;
}

// Nama kontak di balasan manual diganti {{nama}} agar aturan hasil belajar
// tidak menyapa kontak lain dengan nama orang pertama.
export function personalizeReply(reply, pushName) {
  const text = String(reply || '').trim().slice(0, MAX_REPLY_LENGTH);
  const name = String(pushName || '').trim();
  if (name.length < 3) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'gi'), '{{nama}}');
}

// Tentukan balasan untuk panggilan tak terjawab. `rules` = aturan ber-triggerType
// MISSED_CALL, sudah terurut prioritas. Berlaku di semua mode kecuali OFF, dan
// memakai jeda "notice" agar penelepon berulang tidak dibalas berkali-kali.
export function pickCallReply({ config, rules = [] }) {
  if (config.mode === 'OFF') return null;
  for (const rule of rules) {
    const template = rule.template?.body || rule.response || '';
    if (template) return { template, key: `call:${rule.id}`, cooldownMinutes: config.noticeCooldownMinutes, ruleId: rule.id };
  }
  return null;
}

export default {
  AUTO_REPLY_MODES, AUTO_REPLY_TIMEZONES, DEFAULT_AUTO_REPLY, MAX_REPLY_LENGTH, MAX_EXCLUDED_NUMBERS, MAX_SIGNATURE_LENGTH, MAX_REPLY_DELAY_S, DEFAULT_SIGNATURE,
  normalizeAutoReply, normalizeNumbers, isExcluded, isWithinSchedule, isMatch, pickReply, pickCallReply, appendSignature, learnedKeyword, personalizeReply,
};
