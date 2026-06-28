import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';

// H7: cegah pengiriman ganda saat klien retry.
// Klien mengirim header `Idempotency-Key`. Request pertama dieksekusi & responsnya
// di-cache; request berikutnya dengan key sama mengembalikan respons yang sama.
export const idempotency = (ttlSec = 86400) => async (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key) return next();

  const scope = req.apiKey?.id ? `ak${req.apiKey.id}` : req.user?.id ? `u${req.user.id}` : req.ip;
  const id = `idem:${scope}:${req.baseUrl}${req.path}:${key}`;

  let acquired = false;
  try {
    acquired = (await redis.set(id, 'PENDING', 'NX', 'EX', ttlSec)) === 'OK';
  } catch (e) {
    logger.warn({ e: e.message }, 'idempotency redis error — fail-open');
    return next();
  }

  if (!acquired) {
    let cached;
    try { cached = await redis.get(id); } catch { /* ignore */ }
    if (cached && cached !== 'PENDING') {
      const o = JSON.parse(cached);
      res.set('Idempotent-Replay', 'true');
      return res.status(o.s).json(o.b);
    }
    return res
      .status(409)
      .json({ success: false, message: 'Permintaan dengan Idempotency-Key ini sedang diproses' });
  }

  const orig = res.json.bind(res);
  res.json = (body) => {
    const sc = res.statusCode;
    if (sc >= 200 && sc < 300) {
      redis.set(id, JSON.stringify({ s: sc, b: body }), 'EX', ttlSec).catch(() => {});
    } else {
      redis.del(id).catch(() => {}); // non-2xx → izinkan retry
    }
    return orig(body);
  };
  next();
};

export default idempotency;
