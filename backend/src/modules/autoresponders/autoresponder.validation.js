import Joi from 'joi';

const matchTypes = ['EXACT', 'CONTAINS', 'STARTS_WITH', 'REGEX'];

export const createSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    deviceId: Joi.number().integer().optional().allow(null),
    keyword: Joi.string().max(200).required(),
    matchType: Joi.string().valid(...matchTypes).default('CONTAINS'),
    response: Joi.string().required(),
    templateId: Joi.number().integer().optional().allow(null),
    isActive: Joi.boolean().optional(),
    priority: Joi.number().integer().optional(),
  }),
};

export const updateSchema = {
  body: Joi.object({
    name: Joi.string().optional(),
    deviceId: Joi.number().integer().optional().allow(null),
    keyword: Joi.string().optional(),
    matchType: Joi.string().valid(...matchTypes).optional(),
    response: Joi.string().optional(),
    templateId: Joi.number().integer().optional().allow(null),
    isActive: Joi.boolean().optional(),
    priority: Joi.number().integer().optional(),
  }),
};

export const idParam = { params: Joi.object({ id: Joi.number().integer().required() }) };
