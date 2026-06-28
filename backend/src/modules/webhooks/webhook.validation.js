import Joi from 'joi';

export const testSchema = {
  body: Joi.object({
    url: Joi.string().uri().required(),
    event: Joi.string().optional(),
  }),
};
