import { describe, it, expect } from 'vitest';
import { assertSafeUrl } from '../src/utils/ssrfGuard.js';

describe('assertSafeUrl (SSRF guard)', () => {
  it('blokir loopback', async () => {
    await expect(assertSafeUrl('http://127.0.0.1/x')).rejects.toThrow();
  });
  it('blokir metadata cloud', async () => {
    await expect(assertSafeUrl('http://169.254.169.254/latest')).rejects.toThrow();
  });
  it('blokir rentang privat', async () => {
    await expect(assertSafeUrl('http://10.0.0.5')).rejects.toThrow();
    await expect(assertSafeUrl('http://192.168.1.1')).rejects.toThrow();
  });
  it('blokir skema non-http', async () => {
    await expect(assertSafeUrl('ftp://example.com')).rejects.toThrow();
  });
  it('izinkan IP publik', async () => {
    await expect(assertSafeUrl('http://8.8.8.8')).resolves.toBe(true);
  });
});
