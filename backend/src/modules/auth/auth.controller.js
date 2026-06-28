import * as authService from './auth.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok } from '../../utils/response.js';

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 3600 * 1000,
  path: '/api/v1/auth',
};

export const login = catchAsync(async (req, res) => {
  const ctx = { ip: req.ip, userAgent: req.headers['user-agent'] };
  const result = await authService.login(req.body.email, req.body.password, ctx);
  res.cookie('refreshToken', result.refreshToken, cookieOpts);
  return ok(res, result, 'Login berhasil');
});

export const refresh = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  const ctx = { ip: req.ip, userAgent: req.headers['user-agent'] };
  const tokens = await authService.refresh(token, ctx);
  res.cookie('refreshToken', tokens.refreshToken, cookieOpts);
  return ok(res, tokens, 'Token diperbarui');
});

export const logout = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  await authService.logout(token);
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  return ok(res, null, 'Logout berhasil');
});

export const me = catchAsync(async (req, res) => {
  return ok(res, await authService.me(req.user.id));
});

export const changePassword = catchAsync(async (req, res) => {
  await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  return ok(res, null, 'Password berhasil diubah');
});
