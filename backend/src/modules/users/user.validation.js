import Joi from 'joi';

export const createUserSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    roleId: Joi.number().integer().required(),
    phone: Joi.string().optional().allow(null, ''),
  }),
};

export const updateUserSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(8).optional(),
    roleId: Joi.number().integer().optional(),
    phone: Joi.string().optional().allow(null, ''),
    isActive: Joi.boolean().optional(),
  }),
};

export const idParam = {
  params: Joi.object({ id: Joi.number().integer().required() }),
};
