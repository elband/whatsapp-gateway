import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, sha256, randomToken } from '../src/utils/crypto.js';

describe('crypto util', () => {
  it('encrypt → decrypt roundtrip', () => {
    const plain = JSON.stringify({ hello: 'dunia', n: 123 });
    const enc = encrypt(plain);
    expect(enc).not.toBe(plain);
    expect(enc.split(':')).toHaveLength(3); // iv:tag:cipher
    expect(decrypt(enc)).toBe(plain);
  });
  it('ciphertext yang dirusak gagal didekripsi (GCM auth)', () => {
    const enc = encrypt('rahasia');
    const tampered = enc.slice(0, -2) + (enc.endsWith('a') ? 'b' : 'a');
    expect(() => decrypt(tampered)).toThrow();
  });
  it('sha256 deterministik & 64 hex', () => {
    const a = sha256('x');
    expect(a).toBe(sha256('x'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it('randomToken berbeda tiap panggilan', () => {
    expect(randomToken(16)).not.toBe(randomToken(16));
  });
});
