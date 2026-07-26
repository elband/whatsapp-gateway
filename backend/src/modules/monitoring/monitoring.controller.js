import * as service from './monitoring.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok } from '../../utils/response.js';

export const dashboard = catchAsync(async (req, res) => ok(res, await service.dashboard(req.user)));

export const system = catchAsync(async (req, res) => ok(res, await service.system()));

export const activity = catchAsync(async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  return ok(res, await service.recentActivity(limit, req.user));
});

export const chart = catchAsync(async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
  return ok(res, await service.messageChart(days, req.user));
});
