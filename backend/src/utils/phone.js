import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Normalisasi nomor ke format internasional tanpa '+'. IDEMPOTEN:
// memanggilnya berkali-kali pada hasilnya sendiri tidak menambah kode negara lagi.
export function normalizePhone(input, defaultCountry = 'ID') {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  const hadPlus = s.startsWith('+');
  let digits = s.replace(/\D/g, '');
  if (!digits) return null;

  if (!hadPlus) {
    // Asumsi lokal (defaultCountry). Jika sudah diawali kode negara, biarkan.
    if (digits.startsWith('0')) {
      digits = '62' + digits.slice(1); // 08xx -> 628xx
    } else if (defaultCountry === 'ID' && digits.startsWith('8')) {
      digits = '62' + digits; // 8xx (mobile ID tanpa 0) -> 628xx
    }
    // selain itu (mis. sudah '62...', atau kode negara lain) -> apa adanya
  }

  const parsed = parsePhoneNumberFromString('+' + digits);
  if (parsed && parsed.isValid()) return parsed.number.replace('+', '');
  return digits; // fallback: tetap kembalikan digit (sudah tanpa dobel kode negara)
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
