import { describe, it, expect } from 'vitest';
import { parseCallNode, createCallTracker } from '../src/services/missedCall.js';

const node = (tag, attrs = {}, content, outer = {}) => ({
  tag: 'call',
  attrs: { from: '628111@s.whatsapp.net', t: '1760000000', ...outer },
  content: [{ tag, attrs: { 'call-id': 'C1', 'call-creator': '628111@s.whatsapp.net', ...attrs }, content }],
});
const run = (tracker, ...nodes) => nodes.map((n) => tracker.track(parseCallNode(n)));

describe('parseCallNode', () => {
  it('membaca id, pemanggil, caller_pn, video, grup, offline', () => {
    const c = parseCallNode(node('offer', { from: '99@lid', caller_pn: '628222@s.whatsapp.net' }, [{ tag: 'video', attrs: {} }], { offline: '1' }));
    expect(c).toMatchObject({ id: 'C1', tag: 'offer', from: '99@lid', callerPn: '628222@s.whatsapp.net', isVideo: true, isGroup: false, offline: true });
    expect(parseCallNode(node('offer', { 'group-jid': '1@g.us' })).isGroup).toBe(true);
    expect(parseCallNode(node('offer')).from).toBe('628111@s.whatsapp.net'); // jatuh ke call-creator
  });
  it('node tanpa call-id / tanpa isi → null', () => {
    expect(parseCallNode({ tag: 'call', attrs: {}, content: [{ tag: 'offer', attrs: {} }] })).toBeNull();
    expect(parseCallNode({ tag: 'call', attrs: {} })).toBeNull();
    expect(parseCallNode(null)).toBeNull();
  });
});

describe('createCallTracker', () => {
  it('timeout / pemanggil menutup / ditolak = tak terjawab (sekali saja)', () => {
    for (const end of [node('terminate', { reason: 'timeout' }), node('terminate'), node('reject')]) {
      const [offer, missed, again] = run(createCallTracker(), node('offer'), end, end);
      expect(offer).toBeNull();
      expect(missed).toMatchObject({ id: 'C1', from: '628111@s.whatsapp.net', isVideo: false });
      expect(again).toBeNull();
    }
    expect(run(createCallTracker(), node('offer'), node('reject'))[1].reason).toBe('reject');
    expect(run(createCallTracker(), node('offer'), node('terminate', { reason: 'timeout' }))[1].reason).toBe('timeout');
  });
  it('diangkat (accept / accepted_elsewhere) bukan tak terjawab', () => {
    expect(run(createCallTracker(), node('offer'), node('accept'), node('terminate'))[2]).toBeNull();
    expect(run(createCallTracker(), node('offer'), node('terminate', { reason: 'accepted_elsewhere' }))[1]).toBeNull();
  });
  it('panggilan grup, offline, dan tanpa offer diabaikan', () => {
    expect(run(createCallTracker(), node('offer', { type: 'group' }), node('terminate'))[1]).toBeNull();
    expect(run(createCallTracker(), node('offer', {}, undefined, { offline: '1' }), node('terminate'))[1]).toBeNull();
    expect(run(createCallTracker(), node('terminate', { reason: 'timeout' }))[0]).toBeNull();
  });
  it('node lain (ringing/relaylatency) tidak mengubah status; caller_pn & video ikut dari offer', () => {
    const r = run(
      createCallTracker(),
      node('offer', { from: '99@lid', caller_pn: '628222@s.whatsapp.net' }, [{ tag: 'video', attrs: {} }]),
      node('relaylatency'),
      node('terminate'),
    );
    expect(r[1]).toBeNull();
    expect(r[2]).toMatchObject({ from: '99@lid', callerPn: '628222@s.whatsapp.net', isVideo: true });
  });
  it('offer kedaluwarsa dibuang', () => {
    let t = 0;
    const tracker = createCallTracker({ ttlMs: 1000, now: () => t });
    tracker.track(parseCallNode(node('offer')));
    t = 5000;
    expect(tracker.track(parseCallNode(node('terminate')))).toBeNull();
    expect(tracker.size()).toBe(0);
  });
});
