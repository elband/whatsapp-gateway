import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { clusterEnabled, isApi } from '../cluster/clusterConfig.js';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins.length
        ? env.corsOrigins
        : ['http://localhost:5173', 'http://localhost:4000'],
      credentials: true,
    },
    path: '/socket.io',
  });

  // Autentikasi koneksi socket dengan JWT access token.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      const decoded = verifyAccessToken(token);
      socket.user = { id: decoded.sub, role: decoded.role };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    logger.debug({ user: socket.user?.id }, 'Socket connected');

    socket.on('subscribe:device', (deviceId) => {
      socket.join(`device:${deviceId}`);
    });
    socket.on('unsubscribe:device', (deviceId) => {
      socket.leave(`device:${deviceId}`);
    });
    socket.on('disconnect', () => {
      logger.debug({ user: socket.user?.id }, 'Socket disconnected');
    });
  });

  // F1: dukungan multi-node (hanya aktif bila cluster dipisah; mode 'all' = no-op).
  if (clusterEnabled) {
    import('../cluster/socketAdapter.js')
      .then((m) => m.attachRedisAdapter(io))
      .catch((err) => logger.warn({ err: err.message }, 'attachRedisAdapter gagal'));

    if (isApi) {
      // API tier menerima event dari WA-worker lalu meneruskan ke klien.
      import('../cluster/eventBus.js')
        .then((m) =>
          m.subscribeEvents((event, data, room) => {
            if (room) io.to(room).emit(event, data);
            else io.emit(event, data);
          }),
        )
        .then(() => logger.info('Berlangganan event WA-worker (cluster)'))
        .catch((err) => logger.warn({ err: err.message }, 'subscribeEvents gagal'));
    }
  }

  logger.info('Socket.IO initialized');
  return io;
}

export function getIO() {
  return io;
}

// Emit ke semua client dashboard.
export function emit(event, payload) {
  if (io) io.emit(event, payload);
}

// Emit ke room device tertentu.
export function emitToDevice(deviceId, event, payload) {
  if (io) io.to(`device:${deviceId}`).emit(event, payload);
}

export default { initSocket, getIO, emit, emitToDevice };
