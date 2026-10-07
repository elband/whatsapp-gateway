-- Anti-ban: tier harian penerima unik per device (meniru tier portofolio Meta).
-- 0 = tanpa batas. Device lama ikut default 250.
ALTER TABLE `devices`
  ADD COLUMN `dailyRecipientLimit` INTEGER NOT NULL DEFAULT 250;
