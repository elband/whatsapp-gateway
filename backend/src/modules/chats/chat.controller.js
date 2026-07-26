import * as service from './chat.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok, created, getPagination } from '../../utils/response.js';

export const conversations = catchAsync(async (req, res) => {
  const { skip, limit } = getPagination(req.query);
  return ok(res, await service.conversations({ deviceId: req.query.deviceId, skip, limit }, req.user));
});

export const thread = catchAsync(async (req, res) => {
  const { skip, limit } = getPagination(req.query);
  return ok(res, await service.thread({ deviceId: req.query.deviceId, phone: req.params.phone, skip, limit }, req.user));
});

export const markSeen = catchAsync(async (req, res) =>
  ok(res, await service.markSeen({ deviceId: req.body.deviceId, phone: req.params.phone }, req.user), 'Ditandai dibaca'),
);

export const reply = catchAsync(async (req, res) =>
  created(res, await service.reply({ deviceId: req.body.deviceId, phone: req.params.phone, body: req.body.body }, req.user), 'Balasan dikirim'),
);
