import Joi from 'joi';

export const createApiKeySchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    scopes: Joi.array().items(Joi.string()).optional(),
    defaultDeviceId: Joi.number().integer().optional(),
    rateLimit: Joi.number().integer().min(0).optional(),
    expiresAt: Joi.date().iso().optional(),
  }),
};

export const updateApiKeySchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    scopes: Joi.array().items(Joi.string()).optional().allow(null),
    defaultDeviceId: Joi.number().integer().optional().allow(null),
    rateLimit: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional(),
    expiresAt: Joi.date().iso().optional().allow(null),
  }),
};

export const idParam = {
  params: Joi.object({ id: Joi.number().integer().required() }),
};
