import { ApiError } from './ApiError.js';

// Helper isolasi data multi-user. Super admin melihat semua; role lain hanya
// data dengan ownerId = dirinya. Semua fungsi murni (tanpa efek samping) kecuali
// assert* yang melempar error.

// Untuk entitas ber-ownerId langsung: Device, Contact, ContactGroup, Template,
// Autoresponder. Menghasilkan potongan klausa `where` untuk di-spread.
export function ownerWhere(user) {
  return user?.isSuperAdmin ? {} : { ownerId: user.id };
}

// Untuk entitas turunan yang kepemilikannya lewat relasi device:
// Message, Broadcast. Menghasilkan `{ device: { ownerId } }` untuk di-spread.
export function deviceOwnerWhere(user) {
  return user?.isSuperAdmin ? {} : { device: { ownerId: user.id } };
}

// Data ownerId untuk disisipkan saat create. Super admin yang membuat data tetap
// menjadi pemiliknya sendiri (bisa di-reassign kemudian).
export function ownerData(user) {
  return { ownerId: user.id };
}

// Guard kepemilikan entitas ber-ownerId. Melempar 404 (bukan 403) agar tidak
// membocorkan keberadaan resource milik user lain (anti-IDOR).
export function assertOwned(entity, user, msg = 'Data tidak ditemukan') {
  if (!entity) throw ApiError.notFound(msg);
  if (!user?.isSuperAdmin && entity.ownerId !== user.id) throw ApiError.notFound(msg);
  return entity;
}

// Guard untuk entitas yang kepemilikannya lewat relasi device (entity.device.ownerId).
export function assertDeviceOwned(entity, user, msg = 'Data tidak ditemukan') {
  if (!entity) throw ApiError.notFound(msg);
  if (!user?.isSuperAdmin && entity.device?.ownerId !== user.id) throw ApiError.notFound(msg);
  return entity;
}

export default { ownerWhere, deviceOwnerWhere, ownerData, assertOwned, assertDeviceOwned };
