import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

// 404 handler
export const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Route tidak ditemukan: ${req.method} ${req.originalUrl}` });
};

// Error handler global
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      message = `Data sudah ada (unik): ${err.meta?.target}`;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Data tidak ditemukan';
    } else {
      statusCode = 400;
      message = 'Kesalahan database';
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Data tidak valid';
  }

  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Ukuran payload terlalu besar';
  }

  if (statusCode >= 500) {
    logger.error({ err, path: req.originalUrl, method: req.method, requestId: req.id }, 'Unhandled error');
  } else {
    logger.warn({ msg: message, path: req.originalUrl, requestId: req.id }, 'Request error');
  }

  const body = { success: false, message };
  if (details) body.errors = details;
  if (!env.isProd && statusCode >= 500) body.stack = err.stack;

  res.status(statusCode).json(body);
};

export default errorHandler;
