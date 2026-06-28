import { Router } from 'express';
import * as ctrl from './autoresponder.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { createSchema, updateSchema, idParam } from './autoresponder.validation.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /autoresponders:
 *   get:
 *     tags: [Autoresponder]
 *     summary: Daftar auto-reply keyword
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Autoresponder]
 *     summary: Buat auto-reply keyword
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', requirePermission('autoresponder.read'), ctrl.list);
router.post('/', requirePermission('autoresponder.create'), validate(createSchema), ctrl.create);
router.get('/:id', requirePermission('autoresponder.read'), validate(idParam), ctrl.get);
router.put('/:id', requirePermission('autoresponder.update'), validate(idParam), validate(updateSchema), ctrl.update);
router.delete('/:id', requirePermission('autoresponder.delete'), validate(idParam), ctrl.remove);

export default router;
