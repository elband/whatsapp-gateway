import { Router } from 'express';
import * as ctrl from './webhook.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import { testSchema } from './webhook.validation.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /webhooks/events:
 *   get:
 *     tags: [Webhooks]
 *     summary: Daftar event webhook yang didukung
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 */
router.get('/events', requirePermission('webhook.read'), ctrl.events);

/**
 * @openapi
 * /webhooks/deliveries:
 *   get:
 *     tags: [Webhooks]
 *     summary: Log pengiriman webhook (paginated)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 */
router.get('/deliveries', requirePermission('webhook.read'), ctrl.deliveries);

/**
 * @openapi
 * /webhooks/test:
 *   post:
 *     tags: [Webhooks]
 *     summary: Kirim payload uji ke URL webhook
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: OK } }
 */
router.post('/test', requirePermission('webhook.read'), validate(testSchema), ctrl.test);

export default router;
