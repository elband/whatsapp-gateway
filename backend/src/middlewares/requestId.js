import { nanoid } from 'nanoid';

// L3: ID korelasi per-request untuk tracing antar log/komponen.
export const requestId = (req, res, next) => {
  const id = req.headers['x-request-id'] || nanoid(12);
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};

export default requestId;
