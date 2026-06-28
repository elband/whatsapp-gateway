import { createRedisConnection } from '../config/redis.js';
import { EVENT_CHANNEL } from './deviceRouter.js';

// Event lintas-proses: WA-worker mem-publish event (incoming, status, qr, dll),
// API tier men-subscribe lalu meneruskan ke klien via Socket.IO.
const pub = createRedisConnection();

export function publishEvent(event, data, room = null) {
  return pub.publish(EVENT_CHANNEL, JSON.stringify({ event, data, room }));
}

export async function subscribeEvents(cb) {
  const sub = createRedisConnection();
  await sub.subscribe(EVENT_CHANNEL);
  sub.on('message', (_channel, message) => {
    try {
      const { event, data, room } = JSON.parse(message);
      cb(event, data, room);
    } catch {
      /* ignore */
    }
  });
  return sub;
}

export default { publishEvent, subscribeEvents };
