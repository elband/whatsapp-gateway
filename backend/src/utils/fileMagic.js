import fs from 'node:fs';

function readHead(path, n = 16) {
  const fd = fs.openSync(path, 'r');
  const b = Buffer.alloc(n);
  const read = fs.readSync(fd, b, 0, n, 0);
  fs.closeSync(fd);
  return b.subarray(0, read);
}

const hex = (b, a, z) => [...b.subarray(a, z)].map((x) => x.toString(16).padStart(2, '0')).join('');

// Deteksi tipe file dari signature (magic bytes).
export function detect(buf) {
  const h = hex(buf, 0, 12);
  if (h.startsWith('89504e47')) return 'png';
  if (h.startsWith('ffd8ff')) return 'jpg';
  if (h.startsWith('47494638')) return 'gif';
  if (h.startsWith('25504446')) return 'pdf';
  if (h.startsWith('504b0304')) return 'zip'; // docx/xlsx/pptx
  if (h.startsWith('d0cf11e0')) return 'ole'; // office legacy
  if (h.startsWith('494433') || /^fff[b23]/.test(h)) return 'mp3';
  if (h.startsWith('4f676753')) return 'ogg';
  if (h.startsWith('1a45dfa3')) return 'webm';
  if (h.startsWith('52494646')) {
    const t = hex(buf, 8, 12);
    if (t === '57454250') return 'webp';
    if (t === '57415645') return 'wav';
    if (t === '41564920') return 'avi';
    return 'riff';
  }
  if (hex(buf, 4, 8) === '66747970') return 'mp4'; // mp4/m4a/3gp
  // berbahaya
  if (h.startsWith('4d5a')) return 'exe';
  if (h.startsWith('7f454c46')) return 'elf';
  if (h.startsWith('2321')) return 'script';
  return 'unknown';
}

const ALLOW = {
  IMAGE: ['png', 'jpg', 'gif', 'webp'],
  VIDEO: ['mp4', 'webm', 'avi', 'riff'],
  AUDIO: ['mp3', 'ogg', 'wav', 'mp4'],
  DOCUMENT: ['pdf', 'zip', 'ole', 'png', 'jpg', 'gif', 'webp', 'mp4', 'mp3'],
};
const DANGEROUS = ['exe', 'elf', 'script'];

export function validateFile(path, declaredType) {
  let kind;
  try {
    kind = detect(readHead(path));
  } catch {
    return { ok: false, reason: 'Gagal membaca file' };
  }
  if (DANGEROUS.includes(kind)) return { ok: false, kind, reason: 'Jenis file berbahaya ditolak' };
  const allow = ALLOW[declaredType] || [];
  if (!allow.includes(kind)) {
    return { ok: false, kind, reason: `Isi file (${kind}) tidak sesuai tipe ${declaredType}` };
  }
  return { ok: true, kind };
}

export default { detect, validateFile };
