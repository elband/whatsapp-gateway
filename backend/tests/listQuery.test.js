import { describe, it, expect } from 'vitest';
import { parseSort } from '../src/utils/listQuery.js';

describe('parseSort', () => {
  const allowed = ['createdAt', 'name', 'status'];
  it('default desc createdAt', () => {
    expect(parseSort({}, allowed)).toEqual({ createdAt: 'desc' });
  });
  it('honor sort & order valid', () => {
    expect(parseSort({ sort: 'name', order: 'asc' }, allowed)).toEqual({ name: 'asc' });
  });
  it('kolom tidak diizinkan -> fallback (anti-injeksi)', () => {
    expect(parseSort({ sort: 'password; DROP TABLE' }, allowed)).toEqual({ createdAt: 'desc' });
  });
  it('order tidak valid -> desc', () => {
    expect(parseSort({ sort: 'status', order: 'xxx' }, allowed)).toEqual({ status: 'desc' });
  });
});
