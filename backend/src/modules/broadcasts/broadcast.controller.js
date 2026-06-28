import * as service from './broadcast.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok, created, paginated, getPagination } from '../../utils/response.js';

export const create = catchAsync(async (req, res) =>
  created(res, await service.create(req.body, req.file, req.user.id), 'Broadcast dibuat'),
);

export const list = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { items, total } = await service.list({ ...req.query, skip, limit });
  return paginated(res, items, { page, limit, total });
});

export const get = catchAsync(async (req, res) => ok(res, await service.get(Number(req.params.id))));

export const items = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { items: data, total } = await service.getItems(Number(req.params.id), { ...req.query, skip, limit });
  return paginated(res, data, { page, limit, total });
});

export const pause = catchAsync(async (req, res) => ok(res, await service.pause(Number(req.params.id)), 'Broadcast dijeda'));
export const resume = catchAsync(async (req, res) => ok(res, await service.resume(Number(req.params.id)), 'Broadcast dilanjutkan'));
export const cancel = catchAsync(async (req, res) => ok(res, await service.cancel(Number(req.params.id)), 'Broadcast dibatalkan'));
export const retry = catchAsync(async (req, res) => ok(res, await service.retryFailed(Number(req.params.id)), 'Pesan gagal dikirim ulang'));
