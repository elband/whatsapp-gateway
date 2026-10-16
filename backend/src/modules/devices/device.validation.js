import Joi from 'joi';
import { AUTO_REPLY_MODES, AUTO_REPLY_TIMEZONES, DEFAULT_AUTO_REPLY, MAX_REPLY_LENGTH, MAX_SIGNATURE_LENGTH, MAX_REPLY_DELAY_S } from '../../services/autoReplyPolicy.js';

const hhmm = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).messages({ 'string.pattern.base': 'Format jam harus HH:mm' });
const D = DEFAULT_AUTO_REPLY;

// Profil auto-balas per device; selalu disimpan utuh (default diisi di sini).
const autoReplySchema = Joi.object({
  mode: Joi.string().valid(...AUTO_REPLY_MODES).required(),
  replyInGroups: Joi.boolean().default(D.replyInGroups),
  useGlobalRules: Joi.boolean().default(D.useGlobalRules),
  cooldownMinutes: Joi.number().integer().min(0).max(1440).default(D.cooldownMinutes),
  noticeCooldownMinutes: Joi.number().integer().min(1).max(1440).default(D.noticeCooldownMinutes),
  pauseAfterManualMinutes: Joi.number().integer().min(0).max(1440).default(D.pauseAfterManualMinutes),
  replyDelaySeconds: Joi.number().integer().min(0).max(MAX_REPLY_DELAY_S).default(D.replyDelaySeconds),
  fallbackMessage: Joi.string().max(MAX_REPLY_LENGTH).allow('').default(''),
  // Penanda di akhir setiap balasan otomatis; '' = dimatikan.
  signature: Joi.string().max(MAX_SIGNATURE_LENGTH).allow('').default(D.signature),
  awayMessage: Joi.when('mode', {
    is: 'AWAY',
    then: Joi.string().trim().min(1).max(MAX_REPLY_LENGTH).required()
      .messages({ 'any.required': 'Pesan di luar jam kerja wajib diisi', 'string.empty': 'Pesan di luar jam kerja wajib diisi' }),
    otherwise: Joi.string().max(MAX_REPLY_LENGTH).allow('').default(''),
  }),
  schedule: Joi.object({
    days: Joi.array().items(Joi.number().integer().min(0).max(6)).unique().min(1).default([...D.schedule.days]),
    start: hhmm.default(D.schedule.start),
    end: hhmm.default(D.schedule.end),
    timeZone: Joi.string().valid(...AUTO_REPLY_TIMEZONES).default(D.schedule.timeZone),
  }).default({ ...D.schedule, days: [...D.schedule.days] }),
});

export const createDeviceSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    groupId: Joi.number().integer().optional().allow(null),
    webhookUrl: Joi.string().uri().optional().allow(null, ''),
    webhookEvents: Joi.array().items(Joi.string()).optional().allow(null),
    autoReconnect: Joi.boolean().optional(),
  }),
};

export const updateDeviceSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    groupId: Joi.number().integer().optional().allow(null),
    webhookUrl: Joi.string().uri().optional().allow(null, ''),
    webhookEvents: Joi.array().items(Joi.string()).optional().allow(null),
    autoReconnect: Joi.boolean().optional(),
    quota: Joi.number().integer().min(0).optional(),
    quotaUsed: Joi.number().integer().min(0).optional(),
    // Tier harian penerima unik (0 = tanpa batas) — hanya diterapkan untuk super admin.
    dailyRecipientLimit: Joi.number().integer().min(0).optional(),
    autoReply: autoReplySchema.optional(),
  }),
};

export const reassignSchema = {
  body: Joi.object({
    ownerId: Joi.number().integer().required(),
  }),
};

export const idParam = {
  params: Joi.object({ id: Joi.number().integer().required() }),
};

export const groupSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    color: Joi.string().optional().allow(null, ''),
  }),
};
