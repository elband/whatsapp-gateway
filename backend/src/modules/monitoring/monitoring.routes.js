import { Router } from 'express';
import * as ctrl from './monitoring.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /monitoring/dashboard:
 *   get:
 *     tags: [Monitoring]
 *     summary: Ringkasan kartu dashboard
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 */
router.get('/dashboard', requirePermission('monitoring.read'), ctrl.dashboard);

/**
 * @openapi
 * /monitoring/system:
 *   get:
 *     tags: [Monitoring]
 *     summary: Info sistem (CPU, memori, disk, uptime, OS)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 */
router.get('/system', requirePermission('monitoring.read'), ctrl.system);

/**
 * @openapi
 * /monitoring/activity:
 *   get:
 *     tags: [Monitoring]
 *     summary: Aktivitas terbaru (log)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 */
router.get('/activity', requirePermission('monitoring.read'), ctrl.activity);

/**
 * @openapi
 * /monitoring/chart:
 *   get:
 *     tags: [Monitoring]
 *     summary: Grafik pesan N hari terakhir
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 */
router.get('/chart', requirePermission('monitoring.read'), ctrl.chart);

export default router;
