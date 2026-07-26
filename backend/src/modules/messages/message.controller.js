import * as service from './message.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { ok, created, paginated, getPagination } from '../../utils/response.js';

// Sertakan user hanya bila akses via JWT dashboard; via API key user = null
// (kredensial mesin) sehingga isolasi owner tidak diberlakukan pada jalur API key.
const ctx = (req) => ({ apiKey: req.apiKey, apiKeyId: req.apiKey?.id, user: req.authType === 'jwt' ? req.user : null });

export const sendText = catchAsync(async (req, res) =>
  created(res, await service.sendText({ ...req.body, ...ctx(req) }), 'Pesan dimasukkan ke antrean'),
);

export const sendMedia = catchAsync(async (req, res) =>
  created(res, await service.sendMedia({ ...req.body, file: req.file, ...ctx(req) }), 'Media dimasukkan ke antrean'),
);

export const sendLocation = catchAsync(async (req, res) =>
  created(res, await service.sendLocation({ ...req.body, ...ctx(req) }), 'Lokasi dimasukkan ke antrean'),
);

export const sendContact = catchAsync(async (req, res) =>
  created(res, await service.sendContact({ ...req.body, ...ctx(req) }), 'Kontak dimasukkan ke antrean'),
);

export const sendButtons = catchAsync(async (req, res) =>
  created(res, await service.sendButtons({ ...req.body, ...ctx(req) }), 'Pesan tombol dimasukkan ke antrean'),
);

export const sendList = catchAsync(async (req, res) =>
  created(res, await service.sendList({ ...req.body, ...ctx(req) }), 'Pesan list dimasukkan ke antrean'),
);

export const checkNumbers = catchAsync(async (req, res) =>
  ok(res, await service.checkNumbers({ ...req.body, ...ctx(req) }), 'Hasil pengecekan nomor'),
);

export const list = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { items, total } = await service.list({ ...req.query, skip, limit }, ctx(req).user);
  return paginated(res, items, { page, limit, total });
});

export const get = catchAsync(async (req, res) => ok(res, await service.get(Number(req.params.id), ctx(req).user)));

export const resend = catchAsync(async (req, res) =>
  ok(res, await service.resend(Number(req.params.id), ctx(req).user), 'Pesan dikirim ulang'),
);
