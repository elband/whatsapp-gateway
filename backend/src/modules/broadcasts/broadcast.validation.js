import Joi from 'joi';

export const createBroadcastSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    deviceId: Joi.number().integer().required(),
    templateId: Joi.number().integer().optional().allow(null),
    messageType: Joi.string().valid('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT').default('TEXT'),
    body: Joi.string().optional().allow('', null),
    caption: Joi.string().optional().allow('', null),
    mediaPath: Joi.string().optional().allow('', null),
    minDelayMs: Joi.number().integer().min(0).optional(),
    maxDelayMs: Joi.number().integer().min(0).optional(),
    batchSize: Joi.number().integer().min(0).optional(),
    batchRestMinMs: Joi.number().integer().min(0).optional(),
    batchRestMaxMs: Joi.number().integer().min(0).optional(),
    scheduledAt: Joi.date().iso().optional().allow(null),
    recipients: Joi.array().items(
      Joi.object({
        phone: Joi.string().required(),
        name: Joi.string().optional().allow('', null),
        contactId: Joi.number().integer().optional(),
        variables: Joi.object().optional(),
      }),
    ).optional(),
    contactGroupId: Joi.number().integer().optional().allow(null),
    contactIds: Joi.array().items(Joi.number().integer()).optional(),
  }),
};

export const idParam = { params: Joi.object({ id: Joi.number().integer().required() }) };
