import { Router } from 'express';
import * as ctrl from './apikey.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { createApiKeySchema, updateApiKeySchema, idParam } from './apikey.validation.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /apikeys:
 *   get:
 *     tags: [ApiKeys]
 *     summary: Daftar API key
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [ApiKeys]
 *     summary: Buat API key baru (plaintext key ditampilkan sekali)
 *     security: [{ bearerAuth: [] }]
 */

router.get('/', requirePermission('apikey.read'), ctrl.list);
router.post('/', requirePermission('apikey.create'), validate(createApiKeySchema), ctrl.create);
router.get('/:id', requirePermission('apikey.read'), validate(idParam), ctrl.get);
router.put('/:id', requirePermission('apikey.update'), validate(idParam), validate(updateApiKeySchema), ctrl.update);
router.delete('/:id', requirePermission('apikey.delete'), validate(idParam), ctrl.remove);
router.post('/:id/regenerate', requirePermission('apikey.update'), validate(idParam), ctrl.regenerate);

export default router;
