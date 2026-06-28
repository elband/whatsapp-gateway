import { Router } from 'express';
import * as ctrl from './log.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { listQuery, clearSchema } from './log.validation.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /logs:
 *   get:
 *     tags: [Logs]
 *     summary: Daftar log/audit (paginated, dengan filter)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 */
router.get('/', requirePermission('log.read'), validate(listQuery), ctrl.list);

/**
 * @openapi
 * /logs/stats:
 *   get:
 *     tags: [Logs]
 *     summary: Statistik log per tipe & level
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 */
router.get('/stats', requirePermission('log.read'), ctrl.stats);

/**
 * @openapi
 * /logs/old:
 *   delete:
 *     tags: [Logs]
 *     summary: Hapus log lebih lama dari N hari
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 */
router.delete('/old', requirePermission('log.delete'), validate(clearSchema), ctrl.clearOld);

export default router;
