import * as service from './otp.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok, created } from '../../utils/response.js';

const ctx = (req) => ({ apiKey: req.apiKey, apiKeyId: req.apiKey?.id, user: req.authType === 'jwt' ? req.user : null });

export const send = catchAsync(async (req, res) =>
  created(res, await service.send({ ...req.body, ...ctx(req) }), 'OTP dikirim'),
);

export const verify = catchAsync(async (req, res) => {
  const result = await service.verify(req.body);
  return ok(res, result, result.valid ? 'OTP valid' : 'OTP tidak valid');
});
