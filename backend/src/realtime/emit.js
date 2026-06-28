import * as socket from '../socket/index.js';
import { clusterEnabled, isWorker } from '../cluster/clusterConfig.js';

// Indireksi event realtime (F1).
//  - Mode 'all' / 'api' (clusterEnabled=false): emit langsung ke Socket.IO lokal.
//  - Mode 'worker' (cluster): publish ke eventBus → diteruskan API tier ke klien.
// Di mode 'all' perilaku identik dengan sebelumnya (nol perubahan fungsional).

let _publish = null;
async function ensurePublisher() {
  if (_publish) return _publish;
  const mod = await import('../cluster/eventBus.js');
  _publish = mod.publishEvent;
  return _publish;
}

export function emit(event, data) {
  if (clusterEnabled && isWorker) {
    ensurePublisher().then((p) => p(event, data, null)).catch(() => {});
    return;
  }
  socket.emit(event, data);
}

export function emitToDevice(deviceId, event, data) {
  if (clusterEnabled && isWorker) {
    ensurePublisher().then((p) => p(event, data, `device:${deviceId}`)).catch(() => {});
    return;
  }
  socket.emitToDevice(deviceId, event, data);
}

export default { emit, emitToDevice };
