import { Router } from 'express';
import * as ctrl from './chat.controller.js';
import { authJwt } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';

const router = Router();
router.use(authJwt);

/**
 * @openapi
 * /chats:
 *   get:
 *     tags: [Chats]
 *     summary: Daftar percakapan (inbox) per device
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         required: true
 *         schema: { type: integer }
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', requirePermission('message.read'), ctrl.conversations);
router.get('/:phone', requirePermission('message.read'), ctrl.thread);
router.post('/:phone/seen', requirePermission('message.read'), ctrl.markSeen);
router.post('/:phone/reply', requirePermission('message.send'), ctrl.reply);

export default router;
