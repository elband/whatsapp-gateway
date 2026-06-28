import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { prisma } from '../config/prisma.js';
import { catchAsync } from '../utils/catchAsync.js';

// Autentikasi JWT untuk endpoint admin/dashboard.
// Memuat user + role + permissions ke req.user.
export const authJwt = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Token tidak ditemukan');

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Token tidak valid atau kedaluwarsa');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    include: {
      role: {
        include: { rolePermissions: { include: { permission: true } } },
      },
    },
  });

  if (!user || !user.isActive) throw ApiError.unauthorized('Akun tidak aktif');

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    role: user.role.name,
    permissions: user.role.rolePermissions.map((rp) => rp.permission.name),
  };
  req.authType = 'jwt';
  next();
});

export default authJwt;
