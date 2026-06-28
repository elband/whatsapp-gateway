import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import roleRoutes from '../modules/roles/role.routes.js';
import apiKeyRoutes from '../modules/apikeys/apikey.routes.js';
import deviceRoutes from '../modules/devices/device.routes.js';
import messageRoutes from '../modules/messages/message.routes.js';
import broadcastRoutes from '../modules/broadcasts/broadcast.routes.js';
import contactRoutes from '../modules/contacts/contact.routes.js';
import templateRoutes from '../modules/templates/template.routes.js';
import autoresponderRoutes from '../modules/autoresponders/autoresponder.routes.js';
import otpRoutes from '../modules/otp/otp.routes.js';
import chatRoutes from '../modules/chats/chat.routes.js';
import webhookRoutes from '../modules/webhooks/webhook.routes.js';
import logRoutes from '../modules/logs/log.routes.js';
import monitoringRoutes from '../modules/monitoring/monitoring.routes.js';
import settingRoutes from '../modules/settings/setting.routes.js';

const router = Router();

router.get('/', (req, res) =>
  res.json({ success: true, message: 'WhatsApp Gateway API v1', docs: '/api/docs' }),
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/devices', deviceRoutes);
router.use('/messages', messageRoutes);
router.use('/broadcasts', broadcastRoutes);
router.use('/contacts', contactRoutes);
router.use('/templates', templateRoutes);
router.use('/autoresponders', autoresponderRoutes);
router.use('/otp', otpRoutes);
router.use('/chats', chatRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/logs', logRoutes);
router.use('/monitoring', monitoringRoutes);
router.use('/settings', settingRoutes);

export default router;
