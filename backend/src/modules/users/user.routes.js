import { Router } from 'express';
import * as ctrl from './user.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { createUserSchema, updateUserSchema, idParam } from './user.validation.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Daftar user
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [Users]
 *     summary: Tambah user baru
 *     security: [{ bearerAuth: [] }]
 */

router.get('/', requirePermission('user.read'), ctrl.list);
router.post('/', requirePermission('user.create'), validate(createUserSchema), ctrl.create);
router.get('/:id', requirePermission('user.read'), validate(idParam), ctrl.get);
router.put('/:id', requirePermission('user.update'), validate(idParam), validate(updateUserSchema), ctrl.update);
router.delete('/:id', requirePermission('user.delete'), validate(idParam), ctrl.remove);

export default router;
