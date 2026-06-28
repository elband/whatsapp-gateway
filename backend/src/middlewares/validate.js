import { ApiError } from '../utils/ApiError.js';

// Validasi request memakai skema Joi: { body, query, params }
export const validate = (schema) => (req, res, next) => {
  const toValidate = {};
  if (schema.body) toValidate.body = req.body;
  if (schema.query) toValidate.query = req.query;
  if (schema.params) toValidate.params = req.params;

  const errors = [];
  for (const key of Object.keys(toValidate)) {
    const { error, value } = schema[key].validate(toValidate[key], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      errors.push(...error.details.map((d) => ({ field: d.path.join('.'), message: d.message })));
    } else {
      // query bersifat read-only di Express 5 — gunakan defineProperty bila perlu
      if (key === 'query') {
        Object.keys(value).forEach((k) => {
          req.query[k] = value[k];
        });
      } else {
        req[key] = value;
      }
    }
  }

  if (errors.length) return next(ApiError.badRequest('Validasi gagal', errors));
  next();
};

export default validate;
