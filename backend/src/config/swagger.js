import swaggerJSDoc from 'swagger-jsdoc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'WhatsApp Gateway Enterprise API',
      version: '1.0.0',
      description:
        'REST API untuk integrasi notifikasi WhatsApp ke aplikasi enterprise (ERP, Helpdesk, Monitoring, FIDS, HR, dll).\n\n' +
        'Autentikasi: gunakan **Bearer JWT** (dashboard) atau **X-API-Key** (integrasi aplikasi).',
    },
    servers: [{ url: `${env.appUrl}/api/v1`, description: env.nodeEnv }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
    },
    tags: [
      { name: 'Auth' },
      { name: 'Devices' },
      { name: 'Messages' },
      { name: 'Broadcast' },
      { name: 'Contacts' },
      { name: 'Templates' },
      { name: 'Autoresponder' },
      { name: 'OTP' },
      { name: 'Chats' },
      { name: 'Webhooks' },
      { name: 'Logs' },
      { name: 'Monitoring' },
    ],
  },
  // Gunakan forward slash agar glob cocok di Windows maupun Linux.
  apis: [path.join(__dirname, '../modules/**/*.routes.js').replace(/\\/g, '/')],
};

export const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;
