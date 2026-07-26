import { ApiError } from '../utils/ApiError.js';

// Role-Based Access Control: butuh salah satu/ semua permission.
// Hanya super_admin (atau pemilik '*') yang bypass permission. Role lain
// (admin/operator/viewer) mengikuti daftar permission role-nya; isolasi datanya
// ditangani terpisah di layer service (lihat utils/ownerScope.js).
export const requirePermission = (...needed) => (req, res, next) => {
  const user = req.user;
  if (!user) return next(ApiError.unauthorized());
  if (user.isSuperAdmin || user.permissions.includes('*')) return next();

  const has = needed.every((p) => user.permissions.includes(p));
  if (!has) return next(ApiError.forbidden('Anda tidak memiliki izin untuk aksi ini'));
  next();
};

export const requireAnyPermission = (...needed) => (req, res, next) => {
  const user = req.user;
  if (!user) return next(ApiError.unauthorized());
  if (user.isSuperAdmin || user.permissions.includes('*')) return next();

  const has = needed.some((p) => user.permissions.includes(p));
  if (!has) return next(ApiError.forbidden('Anda tidak memiliki izin untuk aksi ini'));
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

export default requirePermission;
