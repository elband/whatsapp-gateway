import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { sha256, randomToken } from '../../utils/crypto.js';
import { env } from '../../config/env.js';
import { writeLog } from '../../services/logService.js';

function expiryDate(str) {
  const m = /^(\d+)([smhd])$/.exec(str);
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const ms = m ? parseInt(m[1], 10) * map[m[2]] : 7 * 86400000;
  return new Date(Date.now() + ms);
}

async function issueTokens(user, ctx = {}) {
  const payload = { sub: user.id, role: user.role?.name || user.role };
  const accessToken = signAccessToken(payload);
  // refresh token unik (jti) agar bisa di-revoke per-sesi
  const jti = randomToken(24);
  const refreshToken = signRefreshToken({ sub: user.id, jti });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      userAgent: ctx.userAgent,
      ip: ctx.ip,
      expiresAt: expiryDate(env.jwt.refreshExpires),
    },
  });

  return { accessToken, refreshToken };
}

export async function login(email, password, ctx = {}) {
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (!user || !user.isActive) {
    writeLog({ type: 'LOGIN', level: 'WARN', action: 'login.failed', message: email, ip: ctx.ip });
    throw ApiError.unauthorized('Email atau password salah');
  }
  const valid = await comparePassword(password, user.password);
  if (!valid) {
    writeLog({ type: 'LOGIN', level: 'WARN', action: 'login.failed', message: email, ip: ctx.ip });
    throw ApiError.unauthorized('Email atau password salah');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const tokens = await issueTokens(user, ctx);
  writeLog({ type: 'LOGIN', action: 'login.success', userId: user.id, ip: ctx.ip, userAgent: ctx.userAgent });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role.name },
    ...tokens,
  };
}

export async function refresh(token, ctx = {}) {
  if (!token) throw ApiError.unauthorized('Refresh token tidak ada');
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized('Refresh token tidak valid');
  }

  const stored = await prisma.refreshToken.findFirst({
    where: { userId: decoded.sub, tokenHash: sha256(token), revoked: false },
  });
  if (!stored || stored.expiresAt < new Date()) throw ApiError.unauthorized('Sesi kedaluwarsa, login ulang');

  const user = await prisma.user.findUnique({ where: { id: decoded.sub }, include: { role: true } });
  if (!user || !user.isActive) throw ApiError.unauthorized('Akun tidak aktif');

  // Rotasi: cabut token lama, terbitkan baru.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  const tokens = await issueTokens(user, ctx);
  return tokens;
}

export async function logout(token) {
  if (!token) return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: sha256(token) }, data: { revoked: true } });
}

export async function me(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  if (!user) throw ApiError.notFound('User tidak ditemukan');
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    role: user.role.name,
    permissions: user.role.rolePermissions.map((rp) => rp.permission.name),
  };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const valid = await comparePassword(currentPassword, user.password);
  if (!valid) throw ApiError.badRequest('Password saat ini salah');
  await prisma.user.update({ where: { id: userId }, data: { password: await hashPassword(newPassword) } });
  // cabut semua sesi
  await prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
}

export default { login, refresh, logout, me, changePassword };
