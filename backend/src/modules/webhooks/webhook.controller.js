import * as service from './webhook.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok, paginated, getPagination } from '../../utils/response.js';

export const events = catchAsync(async (req, res) => ok(res, service.events()));

export const deliveries = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { items, total } = await service.deliveries({ skip, limit, deviceId: req.query.deviceId });
  return paginated(res, items, { page, limit, total });
});

export const test = catchAsync(async (req, res) =>
  ok(res, await service.test(req.body.url, req.body.event), 'Webhook diuji'),
);
