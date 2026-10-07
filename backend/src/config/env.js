import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    // eslint-disable-next-line no-console
    console.error(`[env] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const toInt = (v, def) => (v !== undefined && v !== '' ? parseInt(v, 10) : def);
const toList = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  appName: process.env.APP_NAME || 'WhatsApp Gateway',
  port: toInt(process.env.PORT, 4000),
  appUrl: process.env.APP_URL || 'http://localhost:4000',
  corsOrigins: toList(process.env.CORS_ORIGINS),
  // L8: jumlah hop proxy tepercaya (angka), atau string seperti 'loopback'.
  trustProxy: /^\d+$/.test(process.env.TRUST_PROXY || '')
    ? parseInt(process.env.TRUST_PROXY, 10)
    : process.env.TRUST_PROXY || 1,

  databaseUrl: process.env.DATABASE_URL,
  // F4: read replica(s) opsional (pisahkan dengan koma). Kosong = single DB.
  replicaUrls: toList(process.env.DATABASE_REPLICA_URL),

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: toInt(process.env.REDIS_DB, 0),
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  sessionEncryptionKey: process.env.SESSION_ENCRYPTION_KEY || '',

  upload: {
    dir: process.env.UPLOAD_DIR || '../uploads',
    maxMb: toInt(process.env.MAX_UPLOAD_MB, 50),
  },

  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
    max: toInt(process.env.RATE_LIMIT_MAX, 120),
  },

  broadcast: {
    minDelayMs: toInt(process.env.BROADCAST_MIN_DELAY_MS, 3000),
    maxDelayMs: toInt(process.env.BROADCAST_MAX_DELAY_MS, 8000),
    // Anti-ban: setiap `batchSize` pesan, sisipkan istirahat panjang acak
    // (batchRestMin..Max) sebelum lanjut. Mengikuti batas forward WhatsApp,
    // batchSize dibatasi 1..5 (lihat services/sendPolicy.js).
    batchSize: toInt(process.env.BROADCAST_BATCH_SIZE, 5),
    batchRestMinMs: toInt(process.env.BROADCAST_BATCH_REST_MIN_MS, 60000), // 1 menit
    batchRestMaxMs: toInt(process.env.BROADCAST_BATCH_REST_MAX_MS, 180000), // 3 menit
  },

  // Aturan pengiriman anti-ban untuk SEMUA pesan keluar (lihat services/sendPolicy.js).
  sendPolicy: {
    // Simulasi mengetik: jeda = jumlah karakter × msPerChar, dibatasi min..max.
    typingMsPerChar: toInt(process.env.TYPING_MS_PER_CHAR, 150),
    typingMinMs: toInt(process.env.TYPING_MIN_MS, 2000),
    typingMaxMs: toInt(process.env.TYPING_MAX_MS, 20000),
    otpTypingMaxMs: toInt(process.env.OTP_TYPING_MAX_MS, 3000), // OTP tetap cepat
    // Jeda tambahan antar pesan tunggal (API/dashboard) setelah jeda mengetik.
    gapMinMs: toInt(process.env.SEND_GAP_MIN_MS, 2000),
    gapMaxMs: toInt(process.env.SEND_GAP_MAX_MS, 5000),
    // Zona waktu pergantian hari untuk tier harian penerima unik.
    timeZone: process.env.SEND_DAY_TZ || 'Asia/Jakarta',
  },

  // Concurrency worker queue (tunable; mitigasi parsial throughput - H5).
  queueConcurrency: toInt(process.env.QUEUE_CONCURRENCY, 5),

  log: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || '../logs',
  },

  seed: {
    name: process.env.SEED_ADMIN_NAME || 'Super Admin',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
  },
};

// ── Guard konfigurasi PRODUKSI (fail-closed) ──
// Mencegah boot dengan secret lemah/placeholder atau CORS terbuka.
if (env.isProd) {
  const weak = (s) => !s || s.length < 32 || /change|generate|example|secret-to-a/i.test(s);
  const problems = [];
  if (!env.corsOrigins.length) problems.push('CORS_ORIGINS wajib diisi (tidak boleh kosong/`*`)');
  if (weak(env.jwt.accessSecret)) problems.push('JWT_ACCESS_SECRET lemah atau placeholder');
  if (weak(env.jwt.refreshSecret)) problems.push('JWT_REFRESH_SECRET lemah atau placeholder');
  if (env.jwt.accessSecret === env.jwt.refreshSecret) problems.push('JWT access & refresh secret tidak boleh sama');
  if (!/^[0-9a-fA-F]{64}$/.test(env.sessionEncryptionKey)) problems.push('SESSION_ENCRYPTION_KEY harus 64 karakter hex');
  if (problems.length) {
    // eslint-disable-next-line no-console
    console.error('[env] Konfigurasi produksi tidak aman:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
}

export default env;
