import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detect, validateFile } from '../src/utils/fileMagic.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 1, 2, 3, 4]);
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);

describe('fileMagic.detect', () => {
  it('mendeteksi png/exe/pdf', () => {
    expect(detect(PNG)).toBe('png');
    expect(detect(EXE)).toBe('exe');
    expect(detect(PDF)).toBe('pdf');
  });
});

describe('fileMagic.validateFile', () => {
  const tmp = (buf, name) => {
    const p = path.join(os.tmpdir(), `vt-${Date.now()}-${name}`);
    fs.writeFileSync(p, buf);
    return p;
  };
  it('PNG asli diterima sebagai IMAGE', () => {
    const p = tmp(PNG, 'a.png');
    expect(validateFile(p, 'IMAGE').ok).toBe(true);
    fs.unlinkSync(p);
  });
  it('EXE menyamar ditolak (berbahaya)', () => {
    const p = tmp(EXE, 'a.png');
    const r = validateFile(p, 'IMAGE');
    expect(r.ok).toBe(false);
    fs.unlinkSync(p);
  });
  it('PDF ditolak untuk tipe IMAGE (mismatch)', () => {
    const p = tmp(PDF, 'a.pdf');
    expect(validateFile(p, 'IMAGE').ok).toBe(false);
    expect(validateFile(p, 'DOCUMENT').ok).toBe(true);
    fs.unlinkSync(p);
  });
});
