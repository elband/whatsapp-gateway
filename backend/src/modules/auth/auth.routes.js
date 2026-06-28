import { Router } from 'express';
import * as ctrl from './auth.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authJwt } from '../../middlewares/auth.js';
import { loginLimiter } from '../../middlewares/rateLimiter.js';
import { loginSchema, refreshSchema, changePasswordSchema } from './auth.validation.js';

const router = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login admin/user dashboard
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: admin@example.com }
 *               password: { type: string, example: Admin@12345 }
 *     responses:
 *       200: { description: Berhasil login, mengembalikan accessToken & refreshToken }
 */
router.post('/login', loginLimiter, validate(loginSchema), ctrl.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Perbarui access token memakai refresh token
 *     responses:
 *       200: { description: Token baru }
 */
router.post('/refresh', validate(refreshSchema), ctrl.refresh);

router.post('/logout', ctrl.logout);
router.get('/me', authJwt, ctrl.me);
router.post('/change-password', authJwt, validate(changePasswordSchema), ctrl.changePassword);

export default router;
