// Deteksi panggilan WhatsApp yang tidak terangkat (fungsi murni, tanpa I/O).
// Sumbernya node mentah `CB:call` — event 'call' Baileys 6.x tidak membawa
// `caller_pn` (nomor asli saat pemanggil beralamat LID) maupun alasan `terminate`
// (dijawab di HP vs pemanggil menutup), padahal keduanya dibutuhkan di sini.

const CALL_TTL_MS = 5 * 60000; // sama dengan cache offer Baileys
// Dijawab dari HP / perangkat lain akun yang sama → bukan panggilan tak terjawab.
const ANSWERED_REASONS = ['accepted_elsewhere'];

// Ringkas node <call> menjadi objek datar; null bila bukan node panggilan yang dikenali.
export function parseCallNode(node) {
  const info = Array.isArray(node?.content) ? node.content[0] : null;
  const id = info?.attrs?.['call-id'];
  if (!id) return null;
  const a = info.attrs;
  return {
    id,
    tag: info.tag,
    from: a.from || a['call-creator'] || null,
    callerPn: a.caller_pn || null,
    reason: a.reason || null,
    isGroup: a.type === 'group' || Boolean(a['group-jid']),
    isVideo: Array.isArray(info.content) && info.content.some((c) => c?.tag === 'video'),
    offline: Boolean(node.attrs?.offline),
  };
}

// Melacak panggilan masuk per device. `track(call)` mengembalikan
// { id, from, callerPn, isVideo, reason } saat sebuah panggilan berakhir tanpa
// diangkat (timeout, pemanggil menutup, atau ditolak), selain itu null.
export function createCallTracker({ ttlMs = CALL_TTL_MS, now = Date.now } = {}) {
  const calls = new Map();

  return {
    track(call) {
      if (!call) return null;
      const t = now();
      for (const [id, c] of calls) if (t - c.at > ttlMs) calls.delete(id);

      switch (call.tag) {
        case 'offer':
        case 'offer_notice':
          // Panggilan yang terkirim saat device offline sudah basi — jangan dibalas.
          if (!call.offline && call.from) {
            calls.set(call.id, { from: call.from, callerPn: call.callerPn, isGroup: call.isGroup, isVideo: call.isVideo, answered: false, at: t });
          }
          return null;
        case 'accept': {
          const c = calls.get(call.id);
          if (c) c.answered = true;
          return null;
        }
        case 'terminate':
        case 'reject': {
          const c = calls.get(call.id);
          if (!c) return null; // offer tidak terlihat (mis. proses baru restart)
          calls.delete(call.id);
          if (c.answered || c.isGroup || ANSWERED_REASONS.includes(call.reason)) return null;
          return {
            id: call.id,
            from: c.from,
            callerPn: c.callerPn,
            isVideo: c.isVideo,
            reason: call.tag === 'reject' ? 'reject' : call.reason || 'terminate',
          };
        }
        default:
          return null; // ringing, relaylatency, transport, dst.
      }
    },
    size: () => calls.size,
  };
}

export default { parseCallNode, createCallTracker };
