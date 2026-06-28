import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, '../../', env.log.dir);

try {
  fs.mkdirSync(logDir, { recursive: true });
} catch {
  // ignore
}

const targets = [
  {
    target: 'pino/file',
    level: env.log.level,
    options: { destination: path.join(logDir, 'app.log'), mkdir: true },
  },
];

if (!env.isProd) {
  targets.push({
    target: 'pino-pretty',
    level: env.log.level,
    options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
  });
}

export const logger = pino(
  { level: env.log.level },
  pino.transport({ targets }),
);

export default logger;
