-- Contoh pertanyaan per aturan autoresponder: bila tidak ada keyword yang cocok,
-- pesan masuk yang MIRIP dengan contoh ini ikut dijawab (services/textSimilarity.js).
ALTER TABLE `autoresponders`
  ADD COLUMN `sample` TEXT NULL AFTER `learned`;

-- Aturan hasil belajar yang sudah ada: contoh pertanyaannya diambil dari nama aturan.
UPDATE `autoresponders`
SET `sample` = TRIM(SUBSTRING(`name`, LENGTH('Dipelajari: ') + 1))
WHERE `learned` = true AND `sample` IS NULL AND `name` LIKE 'Dipelajari: %';
