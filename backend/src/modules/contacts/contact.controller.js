import * as service from './contact.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok, created, paginated, getPagination } from '../../utils/response.js';

export const list = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { items, total } = await service.list({ ...req.query, skip, limit }, req.user);
  return paginated(res, items, { page, limit, total });
});

export const get = catchAsync(async (req, res) => ok(res, await service.get(Number(req.params.id), req.user)));

export const create = catchAsync(async (req, res) =>
  created(res, await service.create(req.body, req.user), 'Kontak dibuat'),
);

export const update = catchAsync(async (req, res) =>
  ok(res, await service.update(Number(req.params.id), req.body, req.user), 'Kontak diperbarui'),
);

export const remove = catchAsync(async (req, res) => {
  await service.remove(Number(req.params.id), req.user);
  return ok(res, null, 'Kontak dihapus');
});

export const importContacts = catchAsync(async (req, res) =>
  created(res, await service.importFile(req.file, req.body?.groupId, req.user), 'Impor kontak selesai'),
);

// groups
export const listGroups = catchAsync(async (req, res) => ok(res, await service.listGroups(req.user)));
export const createGroup = catchAsync(async (req, res) => created(res, await service.createGroup(req.body, req.user), 'Grup dibuat'));
export const updateGroup = catchAsync(async (req, res) =>
  ok(res, await service.updateGroup(Number(req.params.id), req.body, req.user), 'Grup diperbarui'),
);
export const removeGroup = catchAsync(async (req, res) => {
  await service.removeGroup(Number(req.params.id), req.user);
  return ok(res, null, 'Grup dihapus');
});
