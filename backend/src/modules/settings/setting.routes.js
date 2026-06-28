import { Router } from 'express';
import * as ctrl from './setting.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { upsertSchema, bulkSchema, keyParam } from './setting.validation.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /settings:
 *   get:
 *     tags: [Settings]
 *     summary: Daftar setting (opsional filter ?group=)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 *   put:
 *     tags: [Settings]
 *     summary: Simpan banyak setting sekaligus
 *     security: [{ bearerAuth: [] }]
 */

router.get('/', requirePermission('setting.read'), ctrl.getAll);
router.put('/', requirePermission('setting.update'), validate(bulkSchema), ctrl.bulkUpsert);
router.get('/:key', requirePermission('setting.read'), validate(keyParam), ctrl.get);
router.put('/:key', requirePermission('setting.update'), validate(keyParam), validate(upsertSchema), ctrl.upsert);

export default router;
