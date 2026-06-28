import fs from 'node:fs';

// Bangun konten pesan Baileys dari tipe + data.
// mediaPath = path absolut file di server.
export function buildContent({ type, body, caption, mediaPath, fileName, mimeType, location, contact, buttons, list }) {
  switch (type) {
    case 'TEXT':
      return { text: body || '' };

    case 'BUTTON': {
      // Catatan: dukungan tombol interaktif WhatsApp terbatas tergantung versi/akun.
      const btns = (buttons?.items || buttons || []).map((b, i) => ({
        buttonId: b.id || `btn_${i + 1}`,
        buttonText: { displayText: b.text || b.displayText || `Tombol ${i + 1}` },
        type: 1,
      }));
      return { text: body || '', footer: buttons?.footer || undefined, buttons: btns, headerType: 1 };
    }

    case 'LIST': {
      const l = list || {};
      return {
        text: body || l.text || '',
        footer: l.footer || undefined,
        title: l.title || undefined,
        buttonText: l.buttonText || 'Pilih',
        sections: (l.sections || []).map((s) => ({
          title: s.title || '',
          rows: (s.rows || []).map((r, i) => ({
            title: r.title || `Item ${i + 1}`,
            rowId: r.rowId || r.id || `row_${i + 1}`,
            description: r.description || undefined,
          })),
        })),
      };
    }

    case 'IMAGE':
      return { image: fs.readFileSync(mediaPath), caption: caption || body || '' };

    case 'VIDEO':
      return { video: fs.readFileSync(mediaPath), caption: caption || body || '' };

    case 'AUDIO':
      return { audio: fs.readFileSync(mediaPath), mimetype: mimeType || 'audio/mp4', ptt: false };

    case 'DOCUMENT':
      return {
        document: fs.readFileSync(mediaPath),
        mimetype: mimeType || 'application/octet-stream',
        fileName: fileName || 'document',
        caption: caption || body || undefined,
      };

    case 'LOCATION':
      return {
        location: {
          degreesLatitude: Number(location?.latitude),
          degreesLongitude: Number(location?.longitude),
          name: location?.name,
          address: location?.address,
        },
      };

    case 'CONTACT': {
      const c = contact || {};
      const vcard =
        'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        `FN:${c.name || ''}\n` +
        `TEL;type=CELL;type=VOICE;waid=${(c.phone || '').replace(/\D/g, '')}:${c.phone || ''}\n` +
        'END:VCARD';
      return { contacts: { displayName: c.name || '', contacts: [{ vcard }] } };
    }

    default:
      return { text: body || '' };
  }
}

// Render variabel template: ganti {{nama}} dengan nilai dari data.
export function renderTemplate(text, variables = {}) {
  if (!text) return text;
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const val = variables[key];
    return val !== undefined && val !== null ? String(val) : '';
  });
}

// Deteksi nama variabel dari teks template.
export function extractVariables(text) {
  if (!text) return [];
  const set = new Set();
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(text))) set.add(m[1]);
  return [...set];
}

export default { buildContent, renderTemplate, extractVariables };
