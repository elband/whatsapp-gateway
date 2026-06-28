import Joi from 'joi';

export const createTemplateSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    type: Joi.string().valid('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT').optional(),
    body: Joi.string().required(),
    caption: Joi.string().optional().allow('', null),
    mediaPath: Joi.string().optional().allow('', null),
    description: Joi.string().optional().allow('', null),
  }),
};

export const updateTemplateSchema = {
  body: Joi.object({
    name: Joi.string().optional(),
    type: Joi.string().valid('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT').optional(),
    body: Joi.string().optional(),
    caption: Joi.string().optional().allow('', null),
    mediaPath: Joi.string().optional().allow('', null),
    description: Joi.string().optional().allow('', null),
  }),
};

export const previewSchema = {
  body: Joi.object({
    variables: Joi.object().default({}),
  }),
};

export const idParam = {
  params: Joi.object({ id: Joi.number().integer().required() }),
};
