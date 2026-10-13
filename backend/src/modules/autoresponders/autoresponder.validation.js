import Joi from 'joi';

const matchTypes = ['EXACT', 'CONTAINS', 'STARTS_WITH', 'REGEX'];

const triggerTypes = ['MESSAGE', 'MISSED_CALL'];

export const createSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    deviceId: Joi.number().integer().optional().allow(null),
    triggerType: Joi.string().valid(...triggerTypes).default('MESSAGE'),
    // Aturan panggilan tak terjawab tidak memakai keyword.
    keyword: Joi.when('triggerType', {
      is: 'MISSED_CALL',
      then: Joi.string().max(200).allow('').default(''),
      otherwise: Joi.string().max(200).required(),
    }),
    matchType: Joi.string().valid(...matchTypes).default('CONTAINS'),
    // Kosong = pengecualian: pesan yang cocok TIDAK dibalas (juga tanpa balasan default).
    response: Joi.string().allow('').required(),
    templateId: Joi.number().integer().optional().allow(null),
    isActive: Joi.boolean().optional(),
    priority: Joi.number().integer().optional(),
  }),
};

export const updateSchema = {
  body: Joi.object({
    name: Joi.string().optional(),
    deviceId: Joi.number().integer().optional().allow(null),
    triggerType: Joi.string().valid(...triggerTypes).optional(),
    keyword: Joi.string().max(200).allow('').optional(),
    matchType: Joi.string().valid(...matchTypes).optional(),
    response: Joi.string().allow('').optional(),
    templateId: Joi.number().integer().optional().allow(null),
    isActive: Joi.boolean().optional(),
    priority: Joi.number().integer().optional(),
  }),
};

export const idParam = { params: Joi.object({ id: Joi.number().integer().required() }) };
