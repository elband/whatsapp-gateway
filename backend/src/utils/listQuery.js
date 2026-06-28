// M12: parsing sort/order yang aman & seragam untuk endpoint list.
// Hanya mengizinkan kolom pada `allowed` (cegah injeksi orderBy sembarang).
export function parseSort(query = {}, allowed = [], def = 'createdAt', defOrder = 'desc') {
  let field = String(query.sort || def);
  if (!allowed.includes(field)) field = def;
  const order = String(query.order || defOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';
  return { [field]: order };
}

export default { parseSort };
