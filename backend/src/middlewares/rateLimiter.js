import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';

// Setiap limiter WAJIB punya instance store sendiri dengan prefix unik.
const makeStore = (prefix) =>
  new RedisStore({ prefix, sendCommand: (...args) => redis.call(...args) });

// Rate limiter umum untuk seluruh API.
export const globalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('rl:global:'),
  keyGenerator: (req) =>
    req.apiKey ? `ak:${req.apiKey.id}` : req.user ? `u:${req.user.id}` : `ip:${req.ip}`,
  message: { success: false, message: 'Terlalu banyak request, coba lagi nanti.' },
});

// Limiter ketat untuk login (anti brute-force).
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('rl:login:'),
  keyGenerator: (req) => `login:${req.ip}:${req.body?.email || ''}`,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

export default globalLimiter;
