import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadRoot = path.resolve(__dirname, '../../', env.upload.dir);

fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(uploadRoot, day);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
    cb(null, `${base}-${nanoid(8)}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.upload.maxMb * 1024 * 1024 },
});

export default upload;
