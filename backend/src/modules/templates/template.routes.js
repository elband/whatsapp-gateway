import { Router } from 'express';
import * as ctrl from './template.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import {
  createTemplateSchema, updateTemplateSchema, previewSchema, idParam,
} from './template.validation.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /templates:
 *   get:
 *     tags: [Templates]
 *     summary: Daftar template pesan
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [Templates]
 *     summary: Buat template (variabel {{var}} terdeteksi otomatis)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', requirePermission('template.read'), ctrl.list);
router.post('/', requirePermission('template.create'), validate(createTemplateSchema), ctrl.create);
router.get('/:id', requirePermission('template.read'), validate(idParam), ctrl.get);
router.put('/:id', requirePermission('template.update'), validate(idParam), validate(updateTemplateSchema), ctrl.update);
router.delete('/:id', requirePermission('template.delete'), validate(idParam), ctrl.remove);

/**
 * @openapi
 * /templates/{id}/preview:
 *   post:
 *     tags: [Templates]
 *     summary: Pratinjau template dengan variabel
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               variables: { type: object }
 *     responses: { 200: { description: OK } }
 */
router.post('/:id/preview', requirePermission('template.read'), validate(idParam), validate(previewSchema), ctrl.preview);

export default router;
