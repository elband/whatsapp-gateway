// Untuk request multipart/form-data: ubah field tertentu yang berupa string JSON menjadi objek/array.
export const parseJsonFields = (...fields) => (req, res, next) => {
  for (const f of fields) {
    if (typeof req.body[f] === 'string' && req.body[f].trim().startsWith('[')) {
      try {
        req.body[f] = JSON.parse(req.body[f]);
      } catch {
        // biarkan validasi yang menolak
      }
    } else if (typeof req.body[f] === 'string' && req.body[f].trim().startsWith('{')) {
      try {
        req.body[f] = JSON.parse(req.body[f]);
      } catch {
        // ignore
      }
    }
  }
  next();
};

export default parseJsonFields;
