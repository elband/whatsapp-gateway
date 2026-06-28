import * as service from './setting.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok } from '../../utils/response.js';

export const getAll = catchAsync(async (req, res) => ok(res, await service.getAll(req.query.group)));

export const get = catchAsync(async (req, res) => ok(res, await service.get(req.params.key)));

export const upsert = catchAsync(async (req, res) =>
  ok(res, await service.upsert(req.params.key, req.body.value, req.body.group, req.user.id), 'Setting disimpan'),
);

export const bulkUpsert = catchAsync(async (req, res) =>
  ok(res, await service.bulkUpsert(req.body.settings, req.user.id), 'Setting disimpan'),
);
