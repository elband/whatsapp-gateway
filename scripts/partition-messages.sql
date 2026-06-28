-- ==========================================================
-- F4 (LANJUTAN/MANUAL) — Partisi tabel `messages` by RANGE(createdAt)
-- untuk skala besar (jutaan baris). JALANKAN SAAT MAINTENANCE + BACKUP DULU.
--
-- Catatan penting:
--  * MySQL/MariaDB mensyaratkan kolom partisi masuk ke SEMUA PRIMARY/UNIQUE key.
--    Karena itu PK diubah menjadi (id, createdAt) dan unique broadcastItemId
--    menjadi (broadcastItemId, createdAt). Prisma tidak mengelola partisi —
--    perlakukan ini sebagai operasi DBA manual (di luar `prisma migrate`).
--  * Setelah ini, JANGAN `prisma migrate dev` di prod (akan mendeteksi drift).
--    Kelola perubahan skema messages secara manual / via shadow table.
-- ==========================================================

-- 1) Sesuaikan key agar kompatibel partisi
ALTER TABLE `messages` DROP PRIMARY KEY, ADD PRIMARY KEY (`id`, `createdAt`);
-- Jika ada unique pada broadcastItemId:
ALTER TABLE `messages` DROP INDEX `messages_broadcastItemId_key`;
ALTER TABLE `messages` ADD UNIQUE INDEX `messages_broadcastItemId_createdAt_key` (`broadcastItemId`, `createdAt`);

-- 2) Terapkan partisi RANGE per bulan (contoh 2026; tambah partisi rutin)
ALTER TABLE `messages` PARTITION BY RANGE (TO_DAYS(`createdAt`)) (
  PARTITION p2026_01 VALUES LESS THAN (TO_DAYS('2026-02-01')),
  PARTITION p2026_02 VALUES LESS THAN (TO_DAYS('2026-03-01')),
  PARTITION p2026_03 VALUES LESS THAN (TO_DAYS('2026-04-01')),
  PARTITION p2026_04 VALUES LESS THAN (TO_DAYS('2026-05-01')),
  PARTITION p2026_05 VALUES LESS THAN (TO_DAYS('2026-06-01')),
  PARTITION p2026_06 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 3) Maintenance bulanan: pecah p_future menjadi bulan baru (jalankan via cron)
--    contoh menambah Juli 2026:
-- ALTER TABLE `messages` REORGANIZE PARTITION p_future INTO (
--   PARTITION p2026_07 VALUES LESS THAN (TO_DAYS('2026-08-01')),
--   PARTITION p_future VALUES LESS THAN MAXVALUE
-- );

-- 4) Pruning data lama (hapus cepat per-partisi, bukan DELETE baris):
-- ALTER TABLE `messages` DROP PARTITION p2026_01;
