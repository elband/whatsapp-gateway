// Kebijakan auto-balas per device (fungsi murni, tanpa I/O). Konfigurasinya
// disimpan di Device.autoReply (JSON); penegakan cooldown/jeda ada di
// services/autoresponderService.js (Redis).
//
// Mode:
// - OFF     : device tidak pernah membalas otomatis (mis. device OTP/notifikasi).
// - KEYWORD : aturan keyword (tabel autoresponders) + balasan default opsional.
// - AWAY    : diam saat jam kerja, kirim pesan "di luar jam kerja" di luar itu.
// - WEBHOOK : balasan ditentukan aplikasi luar lewat respons webhook message.incoming.

export const AUTO_REPLY_MODES = ['OFF', 'KEYWORD', 'AWAY', 'WEBHOOK'];
export const AUTO_REPLY_TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']; // WIB, WITA, WIT
export const MAX_REPLY_LENGTH = 4096;

// Default = perilaku sebelum fitur ini ada (keyword + aturan global), kecuali
// grup yang kini tidak dibalas. Device lama (autoReply NULL) memakai nilai ini.
export const DEFAULT_AUTO_REPLY = Object.freeze({
  mode: 'KEYWORD',
  replyInGroups: false,
  useGlobalRules: true, // ikut aturan "semua device" milik pemilik
  cooldownMinutes: 0, // jeda keyword yang sama per kontak (0 = selalu balas)
  noticeCooldownMinutes: 60, // jeda balasan default / di luar jam kerja per kontak
  pauseAfterManualMinutes: 0, // diam setelah manusia membalas (0 = nonaktif)
  fallbackMessage: '',
  awayMessage: '',
  schedule: Object.freeze({ days: Object.freeze([1, 2, 3, 4, 5]), start: '08:00', end: '17:00', timeZone: 'Asia/Jakarta' }),
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const intIn = (v, min, max, def) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
};
const str = (v) => (typeof v === 'string' ? v : '');

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
    fallbackMessage: str(r.fallbackMessage),
    awayMessage: str(r.awayMessage),
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
      const matched = text ? rules.find((r) => isMatch(r, text)) : null;
      if (matched) {
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

export default {
  AUTO_REPLY_MODES, AUTO_REPLY_TIMEZONES, DEFAULT_AUTO_REPLY, MAX_REPLY_LENGTH,
  normalizeAutoReply, isWithinSchedule, isMatch, pickReply,
};
