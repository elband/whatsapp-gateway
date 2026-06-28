import fs from 'node:fs';
import { validateFile } from '../utils/fileMagic.js';
import { ApiError } from '../utils/ApiError.js';

// M8: validasi isi file (magic bytes) vs tipe yang dideklarasikan; tolak file berbahaya.
export const validateUpload = (req, res, next) => {
  if (!req.file) return next();
  const result = validateFile(req.file.path, req.body.type);
  if (!result.ok) {
    fs.unlink(req.file.path, () => {}); // hapus file yang ditolak
    return next(ApiError.badRequest(result.reason));
  }
  next();
};

export default validateUpload;
