import { Router } from 'express';
import * as ctrl from './role.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { createRoleSchema, updateRoleSchema, assignPermissionsSchema, idParam } from './role.validation.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /roles:
 *   get:
 *     tags: [Roles]
 *     summary: Daftar role beserta permission
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [Roles]
 *     summary: Tambah role baru
 *     security: [{ bearerAuth: [] }]
 */

router.get('/permissions', requirePermission('role.read'), ctrl.listPermissions);

router.get('/', requirePermission('role.read'), ctrl.list);
router.post('/', requirePermission('role.create'), validate(createRoleSchema), ctrl.create);
router.get('/:id', requirePermission('role.read'), validate(idParam), ctrl.get);
router.put('/:id', requirePermission('role.update'), validate(idParam), validate(updateRoleSchema), ctrl.update);
router.delete('/:id', requirePermission('role.delete'), validate(idParam), ctrl.remove);
router.put('/:id/permissions', requirePermission('role.update'), validate(idParam), validate(assignPermissionsSchema), ctrl.assignPermissions);

export default router;
