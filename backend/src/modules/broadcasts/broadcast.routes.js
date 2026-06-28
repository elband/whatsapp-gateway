import { Router } from 'express';
import * as ctrl from './broadcast.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { upload } from '../../middlewares/upload.js';
import { parseJsonFields } from '../../middlewares/parseJson.js';
import { createBroadcastSchema, idParam } from './broadcast.validation.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /broadcasts:
 *   post:
 *     tags: [Broadcast]
 *     summary: Buat broadcast (opsional media + penjadwalan)
 *     security: [{ bearerAuth: [] }]
 *   get:
 *     tags: [Broadcast]
 *     summary: Daftar broadcast
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  requirePermission('broadcast.create'),
  upload.single('file'),
  parseJsonFields('recipients', 'contactIds'),
  validate(createBroadcastSchema),
  ctrl.create,
);
router.get('/', requirePermission('broadcast.read'), ctrl.list);
router.get('/:id', requirePermission('broadcast.read'), validate(idParam), ctrl.get);
router.get('/:id/items', requirePermission('broadcast.read'), validate(idParam), ctrl.items);

router.post('/:id/pause', requirePermission('broadcast.update'), validate(idParam), ctrl.pause);
router.post('/:id/resume', requirePermission('broadcast.update'), validate(idParam), ctrl.resume);
router.post('/:id/cancel', requirePermission('broadcast.update'), validate(idParam), ctrl.cancel);
router.post('/:id/retry', requirePermission('broadcast.update'), validate(idParam), ctrl.retry);

export default router;
