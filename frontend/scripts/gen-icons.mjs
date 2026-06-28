// Generate ikon PNG dari public/favicon.svg menggunakan sharp.
// Jalankan: npm run icons
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(dir, '../public');

const svg = await readFile(path.join(pub, 'favicon.svg'));

const targets = {
  'favicon-16.png': 16,
  'favicon-32.png': 32,
  'favicon-192.png': 192,
  'favicon-512.png': 512,
  'apple-touch-icon.png': 180,
};

for (const [name, size] of Object.entries(targets)) {
  await sharp(svg, { density: 512 })
    .resize(size, size)
    .png()
    .toFile(path.join(pub, name));
  console.log(`✓ ${name} (${size}x${size})`);
}

console.log('Selesai generate ikon.');
