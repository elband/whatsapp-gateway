import { Router } from 'express';
import * as ctrl from './otp.controller.js';
import { authAny } from '../../middlewares/authAny.js';
import { requireScope, enforceApiKeyDevice } from '../../middlewares/apiKey.js';
import { idempotency } from '../../middlewares/idempotency.js';
import { validate } from '../../middlewares/validate.js';
import { sendSchema, verifySchema } from './otp.validation.js';

const router = Router();
router.use(authAny); // JWT atau API Key (agar bisa dipakai aplikasi eksternal)

/**
 * @openapi
 * /otp/send:
 *   post:
 *     tags: [OTP]
 *     summary: Generate & kirim OTP via WhatsApp
 *     security: [{ bearerAuth: [] }, { apiKey: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to]
 *             properties:
 *               to: { type: string, example: "08123456789" }
 *               deviceId: { type: integer }
 *               length: { type: integer, example: 6 }
 *               expiresMinutes: { type: integer, example: 5 }
 *               template: { type: string, example: "Kode Anda: {{code}}" }
 */
router.post('/send', requireScope('message.send'), enforceApiKeyDevice, idempotency(), validate(sendSchema), ctrl.send);

/**
 * @openapi
 * /otp/verify:
 *   post:
 *     tags: [OTP]
 *     summary: Verifikasi kode OTP
 *     security: [{ bearerAuth: [] }, { apiKey: [] }]
 */
router.post('/verify', validate(verifySchema), ctrl.verify);

export default router;
