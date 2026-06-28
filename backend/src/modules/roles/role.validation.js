import Joi from 'joi';

export const createRoleSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().optional().allow(null, ''),
    permissionIds: Joi.array().items(Joi.number().integer()).default([]),
  }),
};

export const updateRoleSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    description: Joi.string().optional().allow(null, ''),
    permissionIds: Joi.array().items(Joi.number().integer()).optional(),
  }),
};

export const assignPermissionsSchema = {
  body: Joi.object({
    permissionIds: Joi.array().items(Joi.number().integer()).default([]),
  }),
};

export const idParam = {
  params: Joi.object({ id: Joi.number().integer().required() }),
};
