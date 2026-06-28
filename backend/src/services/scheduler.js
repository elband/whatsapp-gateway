import cron from 'node-cron';
import { logger } from '../config/logger.js';
import { redis } from '../config/redis.js';
import * as broadcastService from '../modules/broadcasts/broadcast.service.js';

const LOCK_KEY = 'lock:broadcast-scheduler';

// Penjadwal internal: jalankan broadcast terjadwal yang sudah waktunya.
// M7: lock Redis (SET NX EX) agar aman bila kelak ada >1 instance (tidak double-run).
export function startScheduler() {
  cron.schedule('* * * * *', async () => {
    let locked = false;
    try {
      locked = (await redis.set(LOCK_KEY, process.pid.toString(), 'NX', 'EX', 55)) === 'OK';
      if (!locked) return; // instance lain sedang menjalankan
      const n = await broadcastService.runDueScheduled();
      if (n > 0) logger.info(`Scheduler: memulai ${n} broadcast terjadwal`);
    } catch (err) {
      logger.error({ err }, 'Scheduler error');
    } finally {
      if (locked) await redis.del(LOCK_KEY).catch(() => {});
    }
  });
  logger.info('Scheduler started');
}

export default startScheduler;
