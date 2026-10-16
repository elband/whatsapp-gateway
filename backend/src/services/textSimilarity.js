// Kemiripan teks untuk mencocokkan pesan masuk dengan pertanyaan yang sudah
// dipelajari (lihat autoLearnService). Tanpa AI: kata dinormalisasi (singkatan
// chat umum → kata baku, kata sapaan/pengisi dibuang), lalu tiap kata dipasangkan
// dengan kata paling mirip di sisi lain — salah ketik ringan masih dihitung.

const SLANG = {
  brp: 'berapa', brapa: 'berapa', gmn: 'bagaimana', gmna: 'bagaimana', gimana: 'bagaimana', bgmn: 'bagaimana',
  kpn: 'kapan', dmn: 'mana', dimana: 'mana', knp: 'kenapa', napa: 'kenapa', mengapa: 'kenapa',
  gk: 'tidak', ga: 'tidak', gak: 'tidak', nggak: 'tidak', enggak: 'tidak', engga: 'tidak', tdk: 'tidak', ndak: 'tidak',
  sy: 'saya', aku: 'saya', gw: 'saya', gue: 'saya', yg: 'yang', utk: 'untuk', buat: 'untuk', bs: 'bisa', bsa: 'bisa',
  sdh: 'sudah', udah: 'sudah', udh: 'sudah', dah: 'sudah', blm: 'belum', blum: 'belum', tgl: 'tanggal', jg: 'juga',
  dgn: 'dengan', sm: 'sama', krn: 'karena', karna: 'karena', trs: 'terus', lg: 'lagi', bln: 'bulan', thn: 'tahun',
  hr: 'hari', jm: 'jam', mnt: 'menit', org: 'orang', ad: 'ada', tau: 'tahu', tw: 'tahu', mau: 'ingin', pengen: 'ingin',
  pingin: 'ingin', kirain: 'kira', tlg: 'tolong', mhn: 'mohon', makasih: 'terima', makasi: 'terima', thx: 'terima',
  thanks: 'terima', trims: 'terima', info: 'informasi', hrg: 'harga', hrga: 'harga', nyampe: 'sampai', nyampai: 'sampai',
  sampe: 'sampai', ok: 'oke', okay: 'oke', okey: 'oke', okee: 'oke', siap: 'oke', sip: 'oke', td: 'tadi', skrg: 'sekarang',
  skr: 'sekarang', bsk: 'besok', besuk: 'besok', ntar: 'nanti', nnti: 'nanti', msh: 'masih', mash: 'masih',
};

// Kata yang tidak membawa makna pertanyaan (sapaan, panggilan, partikel).
const STOPWORDS = new Set([
  'ya', 'yaa', 'iya', 'dong', 'sih', 'kah', 'nih', 'deh', 'kok', 'loh', 'lho', 'nya', 'tuh', 'aja', 'saja', 'yah', 'kak',
  'kakak', 'pak', 'bapak', 'bu', 'ibu', 'mas', 'mbak', 'mba', 'bang', 'abang', 'min', 'admin', 'om', 'tante', 'gan', 'sis',
  'bro', 'halo', 'hallo', 'hai', 'hi', 'hello', 'permisi', 'maaf', 'mohon', 'tolong', 'apakah', 'ini', 'itu', 'the', 'a',
]);

export function tokens(text) {
  const words = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  // Akhiran -nya dibuang (harganya → harga, alamatnya → alamat) sebelum kamus singkatan.
  const base = (w) => (w.length > 5 && w.endsWith('nya') ? w.slice(0, -3) : w);
  return [...new Set(words.map((w) => SLANG[w] || SLANG[base(w)] || base(w)).filter((w) => !STOPWORDS.has(w)))];
}

function trigrams(word) {
  const s = `  ${word} `;
  const out = new Set();
  for (let i = 0; i < s.length - 2; i++) out.add(s.slice(i, i + 3));
  return out;
}

// Kemiripan dua kata 0..1 (Dice atas trigram huruf); di bawah 0.6 dianggap beda kata.
function wordSimilarity(a, b) {
  if (a === b) return 1;
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return 0; // angka harus persis
  const ta = trigrams(a);
  const tb = trigrams(b);
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  const d = (2 * common) / (ta.size + tb.size);
  return d >= 0.6 ? d : 0;
}

const bestMatchSum = (from, to) =>
  from.reduce((sum, w) => sum + Math.max(0, ...to.map((x) => wordSimilarity(w, x))), 0);

// Kemiripan dua teks 0..1 (simetris).
export function textSimilarity(a, b) {
  const ta = Array.isArray(a) ? a : tokens(a);
  const tb = Array.isArray(b) ? b : tokens(b);
  if (!ta.length || !tb.length) return 0;
  return (bestMatchSum(ta, tb) + bestMatchSum(tb, ta)) / (ta.length + tb.length);
}

// Item `items` (punya field `sample`) yang paling mirip dengan `text`, bila skornya
// ≥ threshold (0..1). Seri: item lebih awal (urutan prioritas) menang.
export function findMostSimilar(text, items, threshold) {
  const t = tokens(text);
  if (!t.length) return null;
  let best = null;
  for (const item of items) {
    const score = textSimilarity(t, item.sample);
    if (score >= threshold && (!best || score > best.score)) best = { item, score };
  }
  return best;
}

export default { tokens, textSimilarity, findMostSimilar };
