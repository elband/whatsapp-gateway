// Pratinjau normalisasi nomor di sisi klien (mirror logika backend, tanpa dependency).
// Dipakai untuk memberi peringatan dini & menampilkan nomor yang akan benar-benar dikirim.
export function normalizePhonePreview(input) {
  if (input == null) return { ok: false, e164: '', display: '' }
  const s = String(input).trim()
  const hadPlus = s.startsWith('+')
  let digits = s.replace(/\D/g, '')
  if (!digits) return { ok: false, e164: '', display: '' }
  if (!hadPlus) {
    if (digits.startsWith('0')) digits = '62' + digits.slice(1)
    else if (digits.startsWith('8')) digits = '62' + digits // mobile ID tanpa 0
    // selain itu (sudah '62...' / kode negara lain) → apa adanya
  }
  const ok = digits.length >= 8 && digits.length <= 15
  return { ok, e164: digits, display: '+' + digits }
}

export default { normalizePhonePreview }
