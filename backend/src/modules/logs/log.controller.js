import * as service from './log.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok, paginated, getPagination } from '../../utils/response.js';

export const list = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { type, level, action, userId, from, to, search } = req.query;
  const { items, total } = await service.list({ skip, limit, type, level, action, userId, from, to, search }, req.user);
  return paginated(res, items, { page, limit, total });
});

export const stats = catchAsync(async (req, res) => ok(res, await service.stats()));

export const clearOld = catchAsync(async (req, res) =>
  ok(res, await service.clearOld(req.body.days, req.user.id), 'Log lama dihapus'),
);
