import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Normalisasi nomor ke format internasional tanpa '+', default region ID.
export function normalizePhone(input, defaultCountry = 'ID') {
  if (!input) return null;
  let raw = String(input).trim();
  // Tangani format lokal Indonesia: 08xxxx -> +628xxxx
  if (/^0\d+$/.test(raw)) {
    raw = raw.replace(/^0/, '+62');
  }
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  if (parsed && parsed.isValid()) {
    return parsed.number.replace('+', '');
  }
  // fallback: buang karakter non-digit
  const digits = raw.replace(/\D/g, '');
  return digits || null;
}

// Ubah nomor menjadi JID WhatsApp.
export function toJid(input) {
  const phone = normalizePhone(input);
  if (!phone) return null;
  return `${phone}@s.whatsapp.net`;
}

// Ekstrak nomor dari JID.
export function fromJid(jid) {
  if (!jid) return null;
  return String(jid).split('@')[0].split(':')[0];
}

export default { normalizePhone, toJid, fromJid };
