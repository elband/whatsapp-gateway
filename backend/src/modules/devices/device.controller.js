import * as service from './device.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok, created, paginated, getPagination } from '../../utils/response.js';

export const list = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { items, total } = await service.list({ ...req.query, skip, limit }, req.user);
  return paginated(res, items, { page, limit, total });
});

export const get = catchAsync(async (req, res) => ok(res, await service.get(Number(req.params.id), req.user)));

export const create = catchAsync(async (req, res) =>
  created(res, await service.create(req.body, req.user), 'Device dibuat, scan QR untuk menghubungkan'),
);

export const update = catchAsync(async (req, res) =>
  ok(res, await service.update(Number(req.params.id), req.body, req.user), 'Device diperbarui'),
);

export const reassign = catchAsync(async (req, res) =>
  ok(res, await service.reassign(Number(req.params.id), req.body.ownerId, req.user), 'Kepemilikan device dipindahkan'),
);

export const remove = catchAsync(async (req, res) => {
  await service.remove(Number(req.params.id), req.user);
  return ok(res, null, 'Device dihapus');
});

export const connect = catchAsync(async (req, res) =>
  ok(res, await service.connect(Number(req.params.id), req.user), 'Menghubungkan device'),
);

export const qr = catchAsync(async (req, res) => ok(res, await service.getQr(Number(req.params.id), req.user)));

export const logout = catchAsync(async (req, res) =>
  ok(res, await service.logout(Number(req.params.id), req.user), 'Device logout'),
);

export const restart = catchAsync(async (req, res) =>
  ok(res, await service.restart(Number(req.params.id), req.user), 'Device direstart'),
);

// groups
export const listGroups = catchAsync(async (req, res) => ok(res, await service.listGroups()));
export const createGroup = catchAsync(async (req, res) => created(res, await service.createGroup(req.body)));
export const removeGroup = catchAsync(async (req, res) => {
  await service.removeGroup(Number(req.params.id));
  return ok(res, null, 'Grup dihapus');
});
