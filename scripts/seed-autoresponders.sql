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
         'Mohon maaf {{nama}}, saya belum dapat mengangkat telepon Bapak/Ibu. Jika berkenan, silakan sampaikan keperluan melalui pesan ini, akan segera saya sampaikan kepada pemilik akun ini. Terima kasih.' AS response,
         1 AS isActive, 10 AS priority
  UNION ALL SELECT 'Penting', 'MESSAGE', 'penting', 'CONTAINS', 'Baik {{nama}}, terima kasih atas pesan Bapak/Ibu. Akan segera saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 5
  UNION ALL SELECT 'Terima kasih', 'MESSAGE', 'terima kasih', 'CONTAINS', 'Sama-sama {{nama}}, terima kasih kembali kepada Bapak/Ibu.', 1, 0
  -- Keyword REGEX (tidak peka huruf besar): satu aturan mencakup banyak kata. Backslash
  -- ditulis ganda karena MySQL memakainya sebagai karakter escape.
  UNION ALL SELECT 'Ucapan selamat', 'MESSAGE', '\\bselamat\\s+(ulang\\s+tahun|hari\\s+raya|idul|lebaran|natal|tahun\\s+baru)|\\bhbd\\b|maaf\\s+lahir', 'REGEX', 'Terima kasih banyak atas ucapan dan doa Bapak/Ibu, {{nama}}. Akan saya sampaikan kepada pemilik akun ini.', 1, 8
  UNION ALL SELECT 'Mendesak', 'MESSAGE', '\\b(urgent|darurat|mendesak|segera|asap)\\b', 'REGEX', 'Baik {{nama}}, terima kasih atas pesan Bapak/Ibu. Akan segera saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 5
  UNION ALL SELECT 'Minta dihubungi kembali', 'MESSAGE', '\\b(telp|telpon|telepon|telfon|call)\\s*(balik|kembali)\\b|\\bhubungi\\s+(saya|kembali|balik)\\b|\\bangkat\\b', 'REGEX', 'Baik {{nama}}, permintaan Bapak/Ibu untuk dihubungi kembali akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 4
  UNION ALL SELECT 'Janji temu', 'MESSAGE', '\\b(ketemu|bertemu|janji|jadwal|meeting|rapat)\\b', 'REGEX', 'Baik {{nama}}, perihal jadwal dan pertemuan akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu konfirmasi.', 1, 3
  UNION ALL SELECT 'Undangan', 'MESSAGE', '\\b(undangan|mengundang|diundang)\\b', 'REGEX', 'Terima kasih atas undangan Bapak/Ibu, {{nama}}. Akan saya sampaikan kepada pemilik akun ini.', 1, 3
  UNION ALL SELECT 'Pembayaran', 'MESSAGE', '\\b(transfer|tf|bayar|pembayaran|rekening|invoice|tagihan)\\b', 'REGEX', 'Baik {{nama}}, perihal pembayaran akan saya sampaikan kepada pemilik akun ini untuk ditindaklanjuti. Terima kasih.', 1, 3
  UNION ALL SELECT 'Lokasi', 'MESSAGE', '\\b(shareloc|share\\s+loc|lokasi|alamat)\\b', 'REGEX', 'Baik {{nama}}, permintaan lokasi atau alamat akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Tanya kabar', 'MESSAGE', '\\b(apa|gimana|bagaimana)\\s+kabar', 'REGEX', 'Terima kasih atas perhatian Bapak/Ibu, {{nama}}. Pesan ini akan saya sampaikan kepada pemilik akun ini.', 1, 2
  UNION ALL SELECT 'Tanya kesibukan', 'MESSAGE', '\\b(lagi|sedang)\\s+(apa|sibuk|di\\s*mana)\\b|\\bsibuk\\b|\\bada\\s+waktu\\b|\\bbisa\\s+(bicara|ngobrol|telp|telpon|telepon)\\b', 'REGEX', 'Mohon maaf {{nama}}, pemilik akun ini belum dapat membalas saat ini. Pesan Bapak/Ibu akan segera saya sampaikan. Terima kasih.', 1, 2
  UNION ALL SELECT 'Salam pembuka', 'MESSAGE', '\\bass?alam', 'REGEX', 'Waalaikumsalam {{nama}}. Terima kasih telah menghubungi. Silakan sampaikan keperluan Bapak/Ibu, akan segera saya sampaikan kepada pemilik akun ini.', 1, 2
  UNION ALL SELECT 'Selamat pagi-malam', 'MESSAGE', '^\\s*(selamat\\s+)?(pagi|siang|sore|malam)\\b', 'REGEX', 'Salam hormat {{nama}}, terima kasih telah menghubungi. Silakan sampaikan keperluan Bapak/Ibu, akan segera saya sampaikan kepada pemilik akun ini.', 1, 1
  UNION ALL SELECT 'Sapaan', 'MESSAGE', '^\\s*(halo|hallo|helo|hai|hi|hello|permisi|punten|p)\\b', 'REGEX', 'Halo {{nama}}, terima kasih telah menghubungi. Silakan sampaikan keperluan Bapak/Ibu, akan segera saya sampaikan kepada pemilik akun ini.', 1, 1
  UNION ALL SELECT 'Makasih', 'MESSAGE', '\\b(makasih|terimakasih|trims|thanks|thank\\s+you|tq|thx|suwun)\\b', 'REGEX', 'Sama-sama {{nama}}, terima kasih kembali kepada Bapak/Ibu.', 1, 0
  UNION ALL SELECT 'Permohonan maaf', 'MESSAGE', '\\b(maaf|sorry)\\b', 'REGEX', 'Tidak apa-apa {{nama}}. Silakan sampaikan keperluan Bapak/Ibu, akan saya sampaikan kepada pemilik akun ini.', 1, 0
  UNION ALL SELECT 'Tes pesan', 'MESSAGE', '^\\s*(tes|test|cek)\\b[\\s.!?]*$', 'REGEX', 'Pesan Bapak/Ibu sudah diterima, {{nama}}. Terima kasih.', 1, 0
) AS s
WHERE @owner IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM autoresponders a WHERE a.name = s.name COLLATE utf8mb4_unicode_ci AND a.ownerId <=> @owner
  );

SELECT id, name, triggerType, keyword, matchType, isActive, ownerId FROM autoresponders ORDER BY id;
