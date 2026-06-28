import Joi from 'joi';

export const sendSchema = {
  body: Joi.object({
    deviceId: Joi.number().integer().optional(),
    to: Joi.string().required(),
    length: Joi.number().integer().min(4).max(8).optional(),
    purpose: Joi.string().optional().allow(''),
    expiresMinutes: Joi.number().integer().min(1).max(60).optional(),
    template: Joi.string().optional().allow(''),
  }),
};

export const verifySchema = {
  body: Joi.object({
    to: Joi.string().required(),
    code: Joi.string().required(),
    purpose: Joi.string().optional().allow(''),
  }),
};
