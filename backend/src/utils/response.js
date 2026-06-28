// Format respons API yang konsisten.
export const ok = (res, data = null, message = 'OK', meta = undefined) => {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.json(body);
};

export const created = (res, data = null, message = 'Created') =>
  res.status(201).json({ success: true, message, data });

export const paginated = (res, items, { page, limit, total }, message = 'OK') =>
  res.json({
    success: true,
    message,
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });

// Helper parsing query pagination.
export const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export default { ok, created, paginated, getPagination };
