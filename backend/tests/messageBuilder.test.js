import { describe, it, expect } from 'vitest';
import { buildContent, renderTemplate, extractVariables } from '../src/services/messageBuilder.js';

describe('template helpers', () => {
  it('renderTemplate mengganti variabel', () => {
    expect(renderTemplate('Hi {{nama}}, tiket {{no}}', { nama: 'Budi', no: 'T1' })).toBe('Hi Budi, tiket T1');
  });
  it('variabel kosong -> string kosong', () => {
    expect(renderTemplate('Hi {{nama}}', {})).toBe('Hi ');
  });
  it('extractVariables mendeteksi placeholder unik', () => {
    expect(extractVariables('{{a}} {{b}} {{a}}').sort()).toEqual(['a', 'b']);
  });
});

describe('buildContent', () => {
  it('TEXT', () => {
    expect(buildContent({ type: 'TEXT', body: 'halo' })).toEqual({ text: 'halo' });
  });
  it('LOCATION', () => {
    const c = buildContent({ type: 'LOCATION', location: { latitude: -6.2, longitude: 106.8, name: 'X' } });
    expect(c.location.degreesLatitude).toBe(-6.2);
    expect(c.location.degreesLongitude).toBe(106.8);
  });
  it('BUTTON membentuk tombol', () => {
    const c = buildContent({ type: 'BUTTON', body: 'pilih', buttons: { items: [{ id: 'a', text: 'A' }] } });
    expect(c.buttons[0].buttonId).toBe('a');
    expect(c.buttons[0].buttonText.displayText).toBe('A');
  });
});
