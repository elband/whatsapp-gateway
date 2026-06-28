import { authJwt } from './auth.js';
import { apiKeyAuth } from './apiKey.js';
import { ApiError } from '../utils/ApiError.js';

// Terima JWT (dashboard) ATAU API Key (integrasi aplikasi).
export const authAny = (req, res, next) => {
  const hasBearer = (req.headers.authorization || '').startsWith('Bearer ');
  const hasApiKey = Boolean(req.headers['x-api-key'] || req.query.api_key);

  if (hasBearer) return authJwt(req, res, next);
  if (hasApiKey) return apiKeyAuth(req, res, next);
  return next(ApiError.unauthorized('Sertakan Bearer token atau header X-API-Key'));
};

export default authAny;
