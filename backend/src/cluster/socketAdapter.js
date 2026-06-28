import { createRedisConnection } from '../config/redis.js';
import { logger } from '../config/logger.js';

// Aktifkan Socket.IO Redis adapter agar emit menjangkau klien di SEMUA API node.
// Butuh dependency: npm i @socket.io/redis-adapter  (dynamic import → aman bila belum terpasang).
export async function attachRedisAdapter(io) {
  try {
    const { createAdapter } = await import('@socket.io/redis-adapter');
    const pubClient = createRedisConnection();
    const subClient = createRedisConnection();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter aktif (multi-node realtime)');
  } catch (err) {
    logger.warn({ err: err.message }, 'Redis adapter dilewati — install @socket.io/redis-adapter untuk multi-node');
  }
}

export default { attachRedisAdapter };
