import { Router } from 'express';
import * as ctrl from './message.controller.js';
import { authAny } from '../../middlewares/authAny.js';
import { requireScope, enforceApiKeyDevice } from '../../middlewares/apiKey.js';
import { idempotency } from '../../middlewares/idempotency.js';
import { validateUpload } from '../../middlewares/validateUpload.js';
import { validate } from '../../middlewares/validate.js';
import { upload } from '../../middlewares/upload.js';
import {
  sendTextSchema, sendMediaSchema, sendLocationSchema, sendContactSchema,
  sendButtonsSchema, sendListSchema, checkNumbersSchema,
} from './message.validation.js';

const router = Router();
router.use(authAny); // JWT atau API Key

/**
 * @openapi
 * /messages/send:
 *   post:
 *     tags: [Messages]
 *     summary: Kirim pesan teks
 *     description: Dapat diakses dengan Bearer JWT atau header X-API-Key.
 *     security: [{ bearerAuth: [] }, { apiKey: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, body]
 *             properties:
 *               deviceId: { type: integer, example: 1 }
 *               to: { type: string, example: "08123456789" }
 *               body: { type: string, example: "Halo dari WhatsApp Gateway" }
 *     responses: { 201: { description: Masuk antrean } }
 */
router.post('/send', requireScope('message.send'), enforceApiKeyDevice, idempotency(), validate(sendTextSchema), ctrl.sendText);

/**
 * @openapi
 * /messages/send-media:
 *   post:
 *     tags: [Messages]
 *     summary: Kirim media (gambar/video/audio/dokumen) multipart
 *     security: [{ bearerAuth: [] }, { apiKey: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               to: { type: string }
 *               type: { type: string, enum: [IMAGE, VIDEO, AUDIO, DOCUMENT] }
 *               caption: { type: string }
 *               deviceId: { type: integer }
 *     responses: { 201: { description: Masuk antrean } }
 */
router.post('/send-media', upload.single('file'), requireScope('message.send'), enforceApiKeyDevice, idempotency(), validate(sendMediaSchema), validateUpload, ctrl.sendMedia);
router.post('/send-location', requireScope('message.send'), enforceApiKeyDevice, idempotency(), validate(sendLocationSchema), ctrl.sendLocation);
router.post('/send-contact', requireScope('message.send'), enforceApiKeyDevice, idempotency(), validate(sendContactSchema), ctrl.sendContact);

/**
 * @openapi
 * /messages/send-buttons:
 *   post:
 *     tags: [Messages]
 *     summary: Kirim pesan dengan tombol (interaktif)
 *     security: [{ bearerAuth: [] }, { apiKey: [] }]
 */
router.post('/send-buttons', requireScope('message.send'), enforceApiKeyDevice, idempotency(), validate(sendButtonsSchema), ctrl.sendButtons);
router.post('/send-list', requireScope('message.send'), enforceApiKeyDevice, idempotency(), validate(sendListSchema), ctrl.sendList);

/**
 * @openapi
 * /messages/check:
 *   post:
 *     tags: [Messages]
 *     summary: Cek nomor terdaftar WhatsApp (satu/banyak)
 *     security: [{ bearerAuth: [] }, { apiKey: [] }]
 */
router.post('/check', requireScope('message.read'), enforceApiKeyDevice, validate(checkNumbersSchema), ctrl.checkNumbers);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/:id/resend', ctrl.resend);

export default router;
