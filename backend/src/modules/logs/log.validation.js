import Joi from 'joi';

export const listQuery = {
  query: Joi.object({
    page: Joi.number().integer().optional(),
    limit: Joi.number().integer().optional(),
    type: Joi.string().optional(),
    level: Joi.string().optional(),
    action: Joi.string().optional(),
    userId: Joi.number().integer().optional(),
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional(),
    search: Joi.string().optional(),
  }).unknown(true),
};

export const clearSchema = {
  body: Joi.object({
    days: Joi.number().integer().min(1).default(30),
  }),
};
