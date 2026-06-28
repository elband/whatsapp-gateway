import * as service from './template.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok, created, paginated, getPagination } from '../../utils/response.js';

export const list = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { items, total } = await service.list({ ...req.query, skip, limit });
  return paginated(res, items, { page, limit, total });
});

export const get = catchAsync(async (req, res) => ok(res, await service.get(Number(req.params.id))));

export const create = catchAsync(async (req, res) =>
  created(res, await service.create(req.body, req.user.id), 'Template dibuat'),
);

export const update = catchAsync(async (req, res) =>
  ok(res, await service.update(Number(req.params.id), req.body, req.user.id), 'Template diperbarui'),
);

export const remove = catchAsync(async (req, res) => {
  await service.remove(Number(req.params.id), req.user.id);
  return ok(res, null, 'Template dihapus');
});

export const preview = catchAsync(async (req, res) =>
  ok(res, await service.preview(Number(req.params.id), req.body.variables)),
);
