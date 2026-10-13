-- Data awal autoresponder untuk pemakaian WhatsApp pribadi
-- (balasan panggilan tak terjawab + beberapa keyword).
-- Jalankan SETELAH migrasi (butuh kolom autoresponders.triggerType):
--   mysql -u <user> -p <database> < scripts/seed-autoresponders.sql
-- Aman dijalankan berulang: aturan dengan nama yang sama milik pemilik yang sama dilewati.
-- Semua aturan berlaku untuk "Semua device" (deviceId NULL) milik user di bawah ini.

SET NAMES utf8mb4;

-- Pemilik aturan: ganti email-nya bila perlu. Bila tidak ditemukan, dipakai user pertama.
SET @owner_email := 'admin@example.com';
SET @owner := COALESCE(
  (SELECT id FROM users WHERE email = @owner_email COLLATE utf8mb4_unicode_ci LIMIT 1),
  (SELECT id FROM users ORDER BY id LIMIT 1)
);

INSERT INTO autoresponders (name, deviceId, triggerType, keyword, matchType, response, isActive, priority, ownerId, updatedAt)
SELECT s.name, NULL, s.triggerType, s.keyword, s.matchType, s.response, s.isActive, s.priority, @owner, NOW(3)
FROM (
  SELECT 'Panggilan tak terjawab' AS name, 'MISSED_CALL' AS triggerType, '' AS keyword, 'CONTAINS' AS matchType,
         'Halo {{nama}}, maaf saya belum bisa angkat telepon. Ada perlu apa? Tulis saja di sini, nanti saya balas.' AS response,
         1 AS isActive, 10 AS priority
  UNION ALL SELECT 'Penting', 'MESSAGE', 'penting', 'CONTAINS', 'Baik {{nama}}, pesannya saya tandai penting. Saya balas secepatnya.', 1, 5
  UNION ALL SELECT 'Terima kasih', 'MESSAGE', 'terima kasih', 'CONTAINS', 'Sama-sama {{nama}}.', 1, 0
) AS s
WHERE @owner IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM autoresponders a WHERE a.name = s.name COLLATE utf8mb4_unicode_ci AND a.ownerId <=> @owner
  );

SELECT id, name, triggerType, keyword, matchType, isActive, ownerId FROM autoresponders ORDER BY id;
