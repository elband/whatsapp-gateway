import * as service from './role.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok, created } from '../../utils/response.js';

export const list = catchAsync(async (req, res) => ok(res, await service.list()));

export const listPermissions = catchAsync(async (req, res) => ok(res, await service.listPermissions()));

export const get = catchAsync(async (req, res) => ok(res, await service.get(Number(req.params.id))));

export const create = catchAsync(async (req, res) =>
  created(res, await service.create(req.body, req.user.id), 'Role dibuat'),
);

export const update = catchAsync(async (req, res) =>
  ok(res, await service.update(Number(req.params.id), req.body, req.user.id), 'Role diperbarui'),
);

export const remove = catchAsync(async (req, res) => {
  await service.remove(Number(req.params.id), req.user.id);
  return ok(res, null, 'Role dihapus');
});

export const assignPermissions = catchAsync(async (req, res) =>
  ok(res, await service.assignPermissions(Number(req.params.id), req.body.permissionIds, req.user.id), 'Permission diperbarui'),
);
