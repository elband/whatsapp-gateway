import { writeLog } from '../services/logService.js';

// Middleware audit: catat request API yang mengubah data (non-GET) ke tabel logs.
export const auditApi = (req, res, next) => {
  if (req.method === 'GET') return next();

  res.on('finish', () => {
    // Lewati error 5xx (sudah dicatat error handler) & static
    const action = `${req.method} ${req.baseUrl}${req.route?.path || req.path}`;
    writeLog({
      type: 'API',
      level: res.statusCode >= 400 ? 'WARN' : 'INFO',
      action,
      message: `${res.statusCode}`,
      userId: req.user?.id,
      apiKeyId: req.apiKey?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      meta: { status: res.statusCode, query: req.query, requestId: req.id },
    });
  });

  next();
};

export default auditApi;
