import Joi from 'joi';

export const sendTextSchema = {
  body: Joi.object({
    deviceId: Joi.number().integer().optional(),
    to: Joi.string().required(),
    body: Joi.string().required(),
  }),
};

export const sendMediaSchema = {
  body: Joi.object({
    deviceId: Joi.number().integer().optional(),
    to: Joi.string().required(),
    type: Joi.string().valid('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT').required(),
    caption: Joi.string().optional().allow(''),
  }),
};

export const sendLocationSchema = {
  body: Joi.object({
    deviceId: Joi.number().integer().optional(),
    to: Joi.string().required(),
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    name: Joi.string().optional().allow(''),
    address: Joi.string().optional().allow(''),
  }),
};

export const sendButtonsSchema = {
  body: Joi.object({
    deviceId: Joi.number().integer().optional(),
    to: Joi.string().required(),
    body: Joi.string().required(),
    footer: Joi.string().optional().allow(''),
    buttons: Joi.array().items(
      Joi.object({ id: Joi.string().optional(), text: Joi.string().required() }),
    ).min(1).max(3).required(),
  }),
};

export const sendListSchema = {
  body: Joi.object({
    deviceId: Joi.number().integer().optional(),
    to: Joi.string().required(),
    body: Joi.string().required(),
    footer: Joi.string().optional().allow(''),
    title: Joi.string().optional().allow(''),
    buttonText: Joi.string().optional().allow(''),
    sections: Joi.array().items(
      Joi.object({
        title: Joi.string().optional().allow(''),
        rows: Joi.array().items(
          Joi.object({
            id: Joi.string().optional(),
            title: Joi.string().required(),
            description: Joi.string().optional().allow(''),
          }),
        ).min(1).required(),
      }),
    ).min(1).required(),
  }),
};

export const checkNumbersSchema = {
  body: Joi.object({
    deviceId: Joi.number().integer().optional(),
    numbers: Joi.alternatives().try(
      Joi.array().items(Joi.string()).min(1),
      Joi.string(),
    ).required(),
  }),
};

export const sendContactSchema = {
  body: Joi.object({
    deviceId: Joi.number().integer().optional(),
    to: Joi.string().required(),
    contactName: Joi.string().required(),
    contactPhone: Joi.string().required(),
  }),
};
