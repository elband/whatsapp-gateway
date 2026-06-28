import { Router } from 'express';
import * as ctrl from './device.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { createDeviceSchema, updateDeviceSchema, idParam, groupSchema } from './device.validation.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /devices:
 *   get:
 *     tags: [Devices]
 *     summary: Daftar device WhatsApp
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [Devices]
 *     summary: Tambah device baru (mulai sesi & QR)
 *     security: [{ bearerAuth: [] }]
 */

// device groups
router.get('/groups', ctrl.listGroups);
router.post('/groups', requirePermission('device.create'), validate(groupSchema), ctrl.createGroup);
router.delete('/groups/:id', requirePermission('device.delete'), validate(idParam), ctrl.removeGroup);

router.get('/', requirePermission('device.read'), ctrl.list);
router.post('/', requirePermission('device.create'), validate(createDeviceSchema), ctrl.create);
router.get('/:id', requirePermission('device.read'), validate(idParam), ctrl.get);
router.put('/:id', requirePermission('device.update'), validate(idParam), validate(updateDeviceSchema), ctrl.update);
router.delete('/:id', requirePermission('device.delete'), validate(idParam), ctrl.remove);

router.post('/:id/connect', requirePermission('device.update'), validate(idParam), ctrl.connect);
router.get('/:id/qr', requirePermission('device.read'), validate(idParam), ctrl.qr);
router.post('/:id/logout', requirePermission('device.update'), validate(idParam), ctrl.logout);
router.post('/:id/restart', requirePermission('device.update'), validate(idParam), ctrl.restart);

export default router;
