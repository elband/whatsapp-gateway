import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';

// Proteksi akses file media (/uploads). Token boleh via:
//  - Header: Authorization: Bearer <accessToken>
//  - Query : ?token=<accessToken>   (agar bisa dipakai di <img src> / unduhan browser)
//  - Cookie: token
export const mediaAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : req.query.token || req.cookies?.token;

  if (!token) return next(ApiError.unauthorized('Token diperlukan untuk mengakses media'));
  try {
    verifyAccessToken(token);
    return next();
  } catch {
    return next(ApiError.unauthorized('Token tidak valid untuk akses media'));
  }
};

export default mediaAuth;
