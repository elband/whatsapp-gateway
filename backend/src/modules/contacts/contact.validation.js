import Joi from 'joi';

export const createContactSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    email: Joi.string().email().optional().allow('', null),
    tags: Joi.array().items(Joi.string()).optional(),
    meta: Joi.object().optional(),
    groupIds: Joi.array().items(Joi.number().integer()).optional(),
  }),
};

export const updateContactSchema = {
  body: Joi.object({
    name: Joi.string().optional(),
    phone: Joi.string().optional(),
    email: Joi.string().email().optional().allow('', null),
    tags: Joi.array().items(Joi.string()).optional(),
    meta: Joi.object().optional(),
    groupIds: Joi.array().items(Joi.number().integer()).optional(),
  }),
};

export const groupSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    color: Joi.string().optional().allow(null, ''),
  }),
};

export const idParam = {
  params: Joi.object({ id: Joi.number().integer().required() }),
};
