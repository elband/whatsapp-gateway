-- Penanda aturan autoresponder yang dibuat otomatis dari balasan manual
-- (fitur "Pelajari dari balasan saya" per device).
ALTER TABLE `autoresponders`
  ADD COLUMN `learned` BOOLEAN NOT NULL DEFAULT false AFTER `hitCount`;
