import { Router } from 'express';
import * as ctrl from './contact.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { upload } from '../../middlewares/upload.js';
import {
  createContactSchema, updateContactSchema, groupSchema, idParam,
} from './contact.validation.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /contacts/groups:
 *   get:
 *     tags: [Contacts]
 *     summary: Daftar grup kontak
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [Contacts]
 *     summary: Buat grup kontak
 *     security: [{ bearerAuth: [] }]
 */
router.get('/groups', requirePermission('contact.read'), ctrl.listGroups);
router.post('/groups', requirePermission('contact.create'), validate(groupSchema), ctrl.createGroup);
router.put('/groups/:id', requirePermission('contact.update'), validate(idParam), validate(groupSchema), ctrl.updateGroup);
router.delete('/groups/:id', requirePermission('contact.delete'), validate(idParam), ctrl.removeGroup);

/**
 * @openapi
 * /contacts/import:
 *   post:
 *     tags: [Contacts]
 *     summary: Impor kontak dari Excel/CSV
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               groupId: { type: integer }
 *     responses: { 201: { description: Impor selesai } }
 */
router.post('/import', requirePermission('contact.create'), upload.single('file'), ctrl.importContacts);

/**
 * @openapi
 * /contacts:
 *   get:
 *     tags: [Contacts]
 *     summary: Daftar kontak
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [Contacts]
 *     summary: Tambah kontak
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', requirePermission('contact.read'), ctrl.list);
router.post('/', requirePermission('contact.create'), validate(createContactSchema), ctrl.create);
router.get('/:id', requirePermission('contact.read'), validate(idParam), ctrl.get);
router.put('/:id', requirePermission('contact.update'), validate(idParam), validate(updateContactSchema), ctrl.update);
router.delete('/:id', requirePermission('contact.delete'), validate(idParam), ctrl.remove);

export default router;
