import Joi from 'joi';

export const upsertSchema = {
  body: Joi.object({
    value: Joi.any().required(),
    group: Joi.string().optional(),
  }),
};

export const bulkSchema = {
  body: Joi.object({
    settings: Joi.array()
      .items(
        Joi.object({
          key: Joi.string().required(),
          value: Joi.any().required(),
          group: Joi.string().optional(),
        }),
      )
      .required(),
  }),
};

export const keyParam = {
  params: Joi.object({ key: Joi.string().required() }),
};
