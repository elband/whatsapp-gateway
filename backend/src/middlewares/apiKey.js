import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sha256 } from '../utils/crypto.js';
import { logger } from '../config/logger.js';

// Autentikasi via API Key untuk integrasi aplikasi eksternal (ERP, Helpdesk, dll).
// Key dikirim lewat header: X-API-Key: wag_<prefix>.<secret>
export const apiKeyAuth = catchAsync(async (req, res, next) => {
  const raw = req.headers['x-api-key'] || req.query.api_key;
  if (!raw) throw ApiError.unauthorized('API Key tidak ditemukan (header X-API-Key)');

  const prefix = String(raw).split('.')[0];
  const record = await prisma.apiKey.findUnique({
    where: { keyPrefix: prefix },
    include: { createdBy: { select: { id: true, isActive: true, role: { select: { name: true } } } } },
  });
  if (!record || !record.isActive) throw ApiError.unauthorized('API Key tidak valid');
  if (record.expiresAt && record.expiresAt < new Date())
    throw ApiError.unauthorized('API Key kedaluwarsa');
  if (record.keyHash !== sha256(String(raw))) throw ApiError.unauthorized('API Key tidak valid');
  // Key mewarisi kepemilikan pembuatnya: tanpa pemilik aktif (user dihapus/nonaktif) = ditolak.
  if (!record.createdBy || !record.createdBy.isActive) throw ApiError.unauthorized('API Key tidak valid');

  // update lastUsedAt tanpa menunggu
  prisma.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch((err) => logger.warn({ err: err.message, apiKeyId: record.id }, 'Gagal update lastUsedAt API key'));

  req.apiKey = {
    id: record.id,
    name: record.name,
    scopes: record.scopes || [],
    defaultDeviceId: record.defaultDeviceId,
    rateLimit: record.rateLimit,
    // Pemilik key — dipakai layer service untuk isolasi device (lihat utils/ownerScope.js).
    owner: { id: record.createdBy.id, isSuperAdmin: record.createdBy.role.name === 'super_admin' },
  };
  req.authType = 'apikey';
  next();
});

// Cek scope untuk API Key. No-op untuk user JWT (req.apiKey undefined).
export const requireScope = (scope) => (req, res, next) => {
  if (!req.apiKey) return next(); // user dashboard (JWT) diatur RBAC, bukan scope
  const scopes = req.apiKey.scopes || [];
  if (scopes.length === 0 || scopes.includes('*') || scopes.includes(scope)) return next();
  return next(ApiError.forbidden(`API Key tidak memiliki scope: ${scope}`));
};

// Batasi API Key hanya boleh memakai device-nya (H4: cegah lateral access).
// - Bila key punya defaultDeviceId: paksa ke device itu, tolak deviceId lain.
// - Bila tidak: deviceId wajib disertakan pada request.
// No-op untuk user JWT (otorisasi via RBAC).
export const enforceApiKeyDevice = (req, res, next) => {
  if (!req.apiKey) return next();
  const def = req.apiKey.defaultDeviceId;
  const requested = req.body?.deviceId;
  if (def) {
    if (requested && Number(requested) !== def) {
      return next(ApiError.forbidden('API Key tidak diizinkan memakai device lain'));
    }
    req.body.deviceId = def; // pin ke device milik key
  } else if (!requested) {
    return next(ApiError.badRequest('deviceId wajib diisi untuk API Key tanpa default device'));
  }
  next();
};

export default apiKeyAuth;
