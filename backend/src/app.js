import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import apiRoutes from './routes/index.js';
import { globalLimiter } from './middlewares/rateLimiter.js';
import { auditApi } from './middlewares/audit.js';
import { notFoundHandler, errorHandler } from './middlewares/error.js';
import { uploadRoot } from './middlewares/upload.js';
import { mediaAuth } from './middlewares/mediaAuth.js';
import { requestId } from './middlewares/requestId.js';
import { prisma } from './config/prisma.js';
import { redis } from './config/redis.js';

// L2: Basic-auth sederhana untuk proteksi Swagger di produksi.
function basicAuth(user, pass) {
  return (req, res, next) => {
    const [, b64] = (req.headers.authorization || '').split(' ');
    const [u, p] = Buffer.from(b64 || '', 'base64').toString().split(':');
    if (u === user && p === pass) return next();
    res.set('WWW-Authenticate', 'Basic realm="docs"');
    return res.status(401).send('Authentication required');
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.set('trust proxy', env.trustProxy); // L8: konfigurasi sesuai topologi proxy

  app.use(requestId); // L3: X-Request-Id korelasi

  // CSP ketat secara global (H6). Swagger di-relaks khusus path-nya di bawah.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-origin' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'], // QR code = data URL
          connectSrc: ["'self'", 'ws:', 'wss:'], // Socket.IO
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          baseUri: ["'self'"],
        },
      },
    }),
  );

  // CORS fail-closed (H1): hanya origin yang diizinkan; di dev fallback ke localhost.
  const corsOrigins = env.corsOrigins.length
    ? env.corsOrigins
    : ['http://localhost:5173', 'http://localhost:4000'];
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use(cookieParser());

  // Health check mendalam (DB + Redis) — untuk PM2/monitor/uptime probe.
  app.get('/health', async (req, res) => {
    const out = { status: 'ok', uptime: process.uptime(), db: 'up', redis: 'up' };
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      out.db = 'down';
      out.status = 'degraded';
    }
    try {
      const pong = await redis.ping();
      if (pong !== 'PONG') throw new Error('no pong');
    } catch {
      out.redis = 'down';
      out.status = 'degraded';
    }
    res.status(out.status === 'ok' ? 200 : 503).json({ success: out.status === 'ok', ...out });
  });

  // Swagger / OpenAPI (L2): di produksi wajib basic-auth (DOCS_USER/DOCS_PASS);
  // bila kredensial tidak diset di produksi, dokumentasi dimatikan.
  const docsUser = process.env.DOCS_USER;
  const docsPass = process.env.DOCS_PASS;
  const docsGuard = env.isProd ? basicAuth(docsUser, docsPass) : (req, res, next) => next();
  if (!env.isProd || (docsUser && docsPass)) {
    app.use(
      '/api/docs',
      docsGuard,
      helmet({ contentSecurityPolicy: false }),
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, { customSiteTitle: 'WA Gateway API' }),
    );
    app.get('/api/docs.json', docsGuard, (req, res) => res.json(swaggerSpec));
  }

  // File media (C2): wajib autentikasi — token via header/query/cookie.
  app.use('/uploads', mediaAuth, express.static(uploadRoot));

  // Rate limit global + audit, lalu API v1
  app.use('/api/v1', globalLimiter, auditApi, apiRoutes);

  // Sajikan build frontend (mode single-port) bila tersedia.
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist));
    // SPA fallback: semua route non-API dikembalikan ke index.html
    app.get(/^\/(?!api\/|uploads\/|socket\.io\/|health$).*/, (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  // 404 & error handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
