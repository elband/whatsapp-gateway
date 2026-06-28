import dns from 'node:dns/promises';
import net from 'node:net';
import { ApiError } from './ApiError.js';

// Cek apakah IP termasuk rentang privat/loopback/link-local/metadata cloud.
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const o = ip.split('.').map(Number);
    if (o[0] === 0 || o[0] === 10 || o[0] === 127) return true;
    if (o[0] === 169 && o[1] === 254) return true;          // link-local + metadata (169.254.169.254)
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
    if (o[0] === 192 && o[1] === 168) return true;
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true; // CGNAT
    return false;
  }
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('::ffff:')) return isPrivateIp(v.replace('::ffff:', ''));
  if (v.startsWith('fc') || v.startsWith('fd')) return true; // ULA
  if (v.startsWith('fe80')) return true;                     // link-local
  return false;
}

// Lempar error bila URL tidak aman untuk di-fetch (proteksi SSRF).
// Catatan: ada celah TOCTOU/DNS-rebinding kecil; untuk proteksi maksimal,
// pin IP hasil resolve saat fetch (lihat roadmap).
export async function assertSafeUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw ApiError.badRequest('URL webhook tidak valid');
  }
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw ApiError.badRequest('Skema URL webhook harus http atau https');
  }
  const host = u.hostname.toLowerCase();
  if (['localhost', 'metadata.google.internal', 'metadata'].includes(host)) {
    throw ApiError.badRequest('Host internal diblokir');
  }
  // Jika host berupa IP literal, langsung cek
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw ApiError.badRequest('URL menunjuk ke jaringan internal (diblokir)');
    return true;
  }
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw ApiError.badRequest('Host webhook tidak dapat di-resolve');
  }
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw ApiError.badRequest('URL menunjuk ke jaringan internal (diblokir)');
    }
  }
  return true;
}

export default { assertSafeUrl };
