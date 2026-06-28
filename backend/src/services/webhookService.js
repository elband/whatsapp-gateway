import { logger } from '../config/logger.js';
import { writeLog } from './logService.js';
import { assertSafeUrl } from '../utils/ssrfGuard.js';

// Kirim event ke webhook URL device (best-effort, dengan retry sederhana).
export async function dispatchWebhook(device, event, payload) {
  if (!device?.webhookUrl) return;
  const events = device.webhookEvents;
  // Jika daftar event di-set, hanya kirim yang di-subscribe.
  if (Array.isArray(events) && events.length > 0 && !events.includes(event)) return;

  const body = JSON.stringify({
    event,
    deviceId: device.deviceId,
    device: { id: device.id, name: device.name, phoneNumber: device.phoneNumber },
    timestamp: new Date().toISOString(),
    data: payload,
  });

  // Proteksi SSRF: tolak URL yang menunjuk ke jaringan internal.
  try {
    await assertSafeUrl(device.webhookUrl);
  } catch (err) {
    logger.warn({ url: device.webhookUrl, deviceId: device.id }, 'Webhook diblokir (SSRF guard)');
    writeLog({
      type: 'WEBHOOK', level: 'WARN', action: `webhook.${event}`,
      message: `URL diblokir SSRF guard: ${err.message}`, deviceId: device.id,
    });
    return;
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(device.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'User-Agent': 'WhatsApp-Gateway-Webhook/1.0',
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(t);
      if (res.ok) return;
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === maxAttempts) {
        logger.warn({ err: err.message, url: device.webhookUrl, event }, 'Webhook gagal');
        writeLog({
          type: 'WEBHOOK',
          level: 'WARN',
          action: `webhook.${event}`,
          message: `Gagal kirim webhook: ${err.message}`,
          deviceId: device.id,
          meta: { url: device.webhookUrl },
        });
      } else {
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }
}

export default { dispatchWebhook };
