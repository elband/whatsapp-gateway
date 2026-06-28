import * as service from './device.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok, created, paginated, getPagination } from '../../utils/response.js';

export const list = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { items, total } = await service.list({ ...req.query, skip, limit });
  return paginated(res, items, { page, limit, total });
});

export const get = catchAsync(async (req, res) => ok(res, await service.get(Number(req.params.id))));

export const create = catchAsync(async (req, res) =>
  created(res, await service.create(req.body, req.user.id), 'Device dibuat, scan QR untuk menghubungkan'),
);

export const update = catchAsync(async (req, res) =>
  ok(res, await service.update(Number(req.params.id), req.body, req.user.id), 'Device diperbarui'),
);

export const remove = catchAsync(async (req, res) => {
  await service.remove(Number(req.params.id), req.user.id);
  return ok(res, null, 'Device dihapus');
});

export const connect = catchAsync(async (req, res) =>
  ok(res, await service.connect(Number(req.params.id)), 'Menghubungkan device'),
);

export const qr = catchAsync(async (req, res) => ok(res, await service.getQr(Number(req.params.id))));

export const logout = catchAsync(async (req, res) =>
  ok(res, await service.logout(Number(req.params.id), req.user.id), 'Device logout'),
);

export const restart = catchAsync(async (req, res) =>
  ok(res, await service.restart(Number(req.params.id)), 'Device direstart'),
);

// groups
export const listGroups = catchAsync(async (req, res) => ok(res, await service.listGroups()));
export const createGroup = catchAsync(async (req, res) => created(res, await service.createGroup(req.body)));
export const removeGroup = catchAsync(async (req, res) => {
  await service.removeGroup(Number(req.params.id));
  return ok(res, null, 'Grup dihapus');
});
