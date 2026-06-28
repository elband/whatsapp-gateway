import crypto from 'node:crypto';
import { env } from '../config/env.js';

// AES-256-GCM untuk enkripsi session Baileys & data sensitif.
const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = env.sessionEncryptionKey;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'SESSION_ENCRYPTION_KEY harus 64 karakter hex (32 byte). Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: iv:tag:ciphertext (semua base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(payload) {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// SHA-256 hash (untuk refresh token & api key)
export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('hex');
}

export default { encrypt, decrypt, sha256, randomToken };
