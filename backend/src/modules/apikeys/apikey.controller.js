import * as service from './apikey.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok, created, paginated, getPagination } from '../../utils/response.js';

export const list = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { items, total } = await service.list({ skip, limit, search: req.query.search });
  return paginated(res, items, { page, limit, total });
});

export const get = catchAsync(async (req, res) => ok(res, await service.get(Number(req.params.id))));

export const create = catchAsync(async (req, res) =>
  created(res, await service.create(req.body, req.user.id), 'API key dibuat, simpan key ini sekarang'),
);

export const update = catchAsync(async (req, res) =>
  ok(res, await service.update(Number(req.params.id), req.body, req.user.id), 'API key diperbarui'),
);

export const remove = catchAsync(async (req, res) => {
  await service.remove(Number(req.params.id), req.user.id);
  return ok(res, null, 'API key dihapus');
});

export const regenerate = catchAsync(async (req, res) =>
  ok(res, await service.regenerate(Number(req.params.id), req.user.id), 'API key dibuat ulang, simpan key baru ini'),
);
