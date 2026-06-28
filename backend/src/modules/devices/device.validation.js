import Joi from 'joi';

export const createDeviceSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    groupId: Joi.number().integer().optional().allow(null),
    webhookUrl: Joi.string().uri().optional().allow(null, ''),
    webhookEvents: Joi.array().items(Joi.string()).optional().allow(null),
    autoReconnect: Joi.boolean().optional(),
  }),
};

export const updateDeviceSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    groupId: Joi.number().integer().optional().allow(null),
    webhookUrl: Joi.string().uri().optional().allow(null, ''),
    webhookEvents: Joi.array().items(Joi.string()).optional().allow(null),
    autoReconnect: Joi.boolean().optional(),
    quota: Joi.number().integer().min(0).optional(),
    quotaUsed: Joi.number().integer().min(0).optional(),
  }),
};

export const idParam = {
  params: Joi.object({ id: Joi.number().integer().required() }),
};

export const groupSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    color: Joi.string().optional().allow(null, ''),
  }),
};
