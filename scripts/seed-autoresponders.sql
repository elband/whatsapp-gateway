-- Data awal autoresponder untuk pemakaian WhatsApp pribadi
-- (balasan panggilan tak terjawab + sekitar 120 aturan keyword, termasuk pengecualian).
-- Dijalankan otomatis oleh scripts/deploy.sh dan scripts/update.sh. Manual, SETELAH migrasi (butuh kolom
-- autoresponders.triggerType):
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
  -- Pengecualian (response kosong = tidak dibalas); prioritas tertinggi agar menang dari keyword lain.
  UNION ALL SELECT 'Laporan inspeksi (tidak dibalas)', 'MESSAGE', 'inspeksi perangkat', 'CONTAINS', '', 1, 100
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
  UNION ALL SELECT 'Salam pembuka', 'MESSAGE', '\\bass?alam|^\\s*(ass|aslm|asw|askum|mikum|samlekum)\\b', 'REGEX', 'Waalaikumsalam {{nama}}. Terima kasih telah menghubungi. Silakan sampaikan keperluan Bapak/Ibu, akan segera saya sampaikan kepada pemilik akun ini.', 1, 2
  UNION ALL SELECT 'Selamat pagi-malam', 'MESSAGE', '^\\s*(selamat\\s+)?(pagi|siang|sore|malam)\\b', 'REGEX', 'Salam hormat {{nama}}, terima kasih telah menghubungi. Silakan sampaikan keperluan Bapak/Ibu, akan segera saya sampaikan kepada pemilik akun ini.', 1, 1
  UNION ALL SELECT 'Sapaan', 'MESSAGE', '^\\s*(halo|hallo|helo|hai|hi|hello|permisi|punten|p)\\b', 'REGEX', 'Halo {{nama}}, terima kasih telah menghubungi. Silakan sampaikan keperluan Bapak/Ibu, akan segera saya sampaikan kepada pemilik akun ini.', 1, 1
  UNION ALL SELECT 'Makasih', 'MESSAGE', '\\b(makasih|terimakasih|trims|thanks|thank\\s+you|tq|thx|suwun)\\b', 'REGEX', 'Sama-sama {{nama}}, terima kasih kembali kepada Bapak/Ibu.', 1, 0
  UNION ALL SELECT 'Permohonan maaf', 'MESSAGE', '\\b(maaf|sorry)\\b', 'REGEX', 'Tidak apa-apa {{nama}}. Silakan sampaikan keperluan Bapak/Ibu, akan saya sampaikan kepada pemilik akun ini.', 1, 0
  UNION ALL SELECT 'Tes pesan', 'MESSAGE', '^\\s*(tes|test|cek)\\b[\\s.!?]*$', 'REGEX', 'Pesan Bapak/Ibu sudah diterima, {{nama}}. Terima kasih.', 1, 0
  -- Tambahan 100 aturan (pekerjaan, jual beli, teknologi, perjalanan, urusan pribadi, basa-basi).
  UNION ALL SELECT 'Kode OTP otomatis (tidak dibalas)', 'MESSAGE', '\\bjangan\\s+(berikan|beritahu|bagikan|kasih)\\s+kode|\\bkode\\s+(otp|verifikasi)\\s+anda\\b|\\byour\\s+(otp|verification)\\s+code\\b', 'REGEX', '', 1, 95
  UNION ALL SELECT 'Penawaran judi atau pinjol (tidak dibalas)', 'MESSAGE', '\\b(pinjol|pinjaman\\s+online|judi|togel|slot\\s+gacor|gacor|maxwin)\\b', 'REGEX', '', 1, 90
  UNION ALL SELECT 'Undian palsu (tidak dibalas)', 'MESSAGE', '\\b(menang\\s+undian|selamat\\s+anda\\s+(menang|terpilih)|hadiah\\s+undian|klik\\s+link\\s+(ini|berikut))\\b', 'REGEX', '', 1, 90
  UNION ALL SELECT 'Kabar duka', 'MESSAGE', '\\b(meninggal|wafat|berpulang|innalillahi|takziah|tahlilan)(nya)?\\b|\\bduka\\s*cita\\b', 'REGEX', 'Turut berduka cita, {{nama}}. Kabar ini akan segera saya sampaikan kepada pemilik akun ini.', 1, 9
  UNION ALL SELECT 'Musibah', 'MESSAGE', '\\b(kecelakaan|tabrakan|musibah|kebakaran|kebanjiran|kemalingan)(nya)?\\b', 'REGEX', 'Turut prihatin atas kabar tersebut, {{nama}}. Akan segera saya sampaikan kepada pemilik akun ini.', 1, 9
  UNION ALL SELECT 'Rumah sakit', 'MESSAGE', '\\b(rumah\\s+sakit|igd|ugd|icu|opname|rawat\\s+inap|dirawat)\\b', 'REGEX', 'Semoga lekas membaik, {{nama}}. Kabar ini akan segera saya sampaikan kepada pemilik akun ini.', 1, 6
  UNION ALL SELECT 'Kabar sakit', 'MESSAGE', '\\b(sakit|demam|kurang\\s+sehat|tidak\\s+enak\\s+badan)(nya)?\\b', 'REGEX', 'Semoga lekas sembuh, {{nama}}. Kabar ini akan saya sampaikan kepada pemilik akun ini.', 1, 4
  UNION ALL SELECT 'Tanya balasan otomatis', 'MESSAGE', '\\b(bot|robot|balasan\\s+otomatis|auto\\s*reply|dibalas\\s+mesin)\\b', 'REGEX', 'Benar {{nama}}, ini adalah balasan otomatis. Pesan Bapak/Ibu tetap akan saya sampaikan kepada pemilik akun ini.', 1, 6
  UNION ALL SELECT 'Tanya siapa', 'MESSAGE', '\\b(ini\\s+siapa|dengan\\s+siapa|siapa\\s+ya|nomor\\s+siapa|ini\\s+nomor)\\b', 'REGEX', 'Mohon maaf {{nama}}, ini adalah balasan otomatis. Pesan Bapak/Ibu akan saya sampaikan kepada pemilik akun ini.', 1, 6
  UNION ALL SELECT 'Minta kode atau sandi', 'MESSAGE', '\\b(otp|kode\\s+verifikasi|password|kata\\s+sandi|pin\\s+atm)\\b', 'REGEX', 'Mohon maaf {{nama}}, kode maupun kata sandi tidak dapat diberikan melalui pesan ini. Pesan Bapak/Ibu akan saya sampaikan kepada pemilik akun ini.', 1, 6
  UNION ALL SELECT 'Belum dibalas', 'MESSAGE', '\\bbelum\\s+(dibalas|balas|dijawab|direspon|respon)\\b|\\bkok\\s+(ga|gak|nggak|tidak)\\s+(balas|dibalas|respon|jawab)\\b|\\bslow\\s+respon\\b', 'REGEX', 'Mohon maaf atas keterlambatan balasannya, {{nama}}. Pesan Bapak/Ibu akan segera saya sampaikan kepada pemilik akun ini.', 1, 5
  UNION ALL SELECT 'Sudah sampai', 'MESSAGE', '\\b(sudah|udah|sdh)\\s+(sampai|tiba|nyampe|di\\s+lokasi|di\\s+depan|di\\s+lobby|di\\s+lobi)\\b', 'REGEX', 'Baik {{nama}}, informasi kedatangan Bapak/Ibu akan segera saya sampaikan kepada pemilik akun ini.', 1, 5
  UNION ALL SELECT 'Pembatalan', 'MESSAGE', '\\b(batal|cancel|dibatalkan|membatalkan|tidak\\s+jadi|ga\\s+jadi|gak\\s+jadi)\\b', 'REGEX', 'Baik {{nama}}, informasi pembatalan Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 4
  UNION ALL SELECT 'Jadwal ulang', 'MESSAGE', '\\b(reschedule|jadwal\\s+ulang|diundur|ditunda|dimajukan|mundur|ganti\\s+(jadwal|hari|jam|tanggal))\\b', 'REGEX', 'Baik {{nama}}, permintaan perubahan jadwal Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 4
  UNION ALL SELECT 'Minta dikabari', 'MESSAGE', '\\bmohon\\s+(dibalas|balasannya|responnya|konfirmasinya|infonya|kabarnya)\\b|\\btolong\\s+(dibalas|balas)\\b|\\b(kabari|kabarin|info\\s+ya)\\b', 'REGEX', 'Baik {{nama}}, permintaan Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 4
  UNION ALL SELECT 'Sudah dikirim', 'MESSAGE', '\\b(sudah|udah|sdh|telah)\\s+(saya\\s+|kami\\s+|aku\\s+)?(kirim|dikirim|kirimkan|email|emailkan|share|bagikan)\\b', 'REGEX', 'Baik {{nama}}, terima kasih atas kirimannya. Akan saya sampaikan kepada pemilik akun ini.', 1, 4
  UNION ALL SELECT 'Izin bertanya', 'MESSAGE', '\\b(mau|ingin|izin|ijin|numpang|boleh)\\s+(tanya|bertanya|nanya)\\b|\\btanya\\s+(dong|ya)\\b', 'REGEX', 'Baik {{nama}}, pertanyaan Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 4
  UNION ALL SELECT 'Titip salam', 'MESSAGE', '\\btitip\\s+salam\\b|\\bsalam\\s+(untuk|buat|ke|kepada)\\b', 'REGEX', 'Baik {{nama}}, salam Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Terima kasih.', 1, 4
  UNION ALL SELECT 'Simpan nomor', 'MESSAGE', '\\b(save|simpan)\\s+(nomor|no|kontak|nomer)\\b|\\bsave\\s+(ya|balik)\\b', 'REGEX', 'Baik {{nama}}, permintaan menyimpan nomor Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 4
  UNION ALL SELECT 'Ambil barang', 'MESSAGE', '\\b(ambil|mengambil|diambil)\\s+(barang|paket|dokumen|pesanan|berkas|titipan)\\b', 'REGEX', 'Baik {{nama}}, perihal pengambilan barang akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 4
  UNION ALL SELECT 'Pinjam barang', 'MESSAGE', '\\b(pinjam|meminjam|pinjem)\\s+(mobil|motor|laptop|alat|barang|buku|proyektor|kamera)\\b', 'REGEX', 'Baik {{nama}}, permintaan peminjaman Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 4
  UNION ALL SELECT 'Konfirmasi', 'MESSAGE', '\\b(konfirmasi|confirm|memastikan|mengingatkan|reminder|pengingat)(nya)?\\b', 'REGEX', 'Baik {{nama}}, konfirmasi Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Tanya waktu', 'MESSAGE', '\\b(kapan|jam\\s+berapa|pukul\\s+berapa|tanggal\\s+berapa|hari\\s+apa)\\b', 'REGEX', 'Baik {{nama}}, perihal waktu dan jadwal akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Tenggat', 'MESSAGE', '\\b(deadline|tenggat|batas\\s+waktu|jatuh\\s+tempo)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal tenggat waktu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Menunggu', 'MESSAGE', '\\b(ditunggu|saya\\s+tunggu|kami\\s+tunggu|menunggu|nungguin)\\b', 'REGEX', 'Mohon maaf telah membuat Bapak/Ibu menunggu, {{nama}}. Akan segera saya sampaikan kepada pemilik akun ini.', 1, 3
  UNION ALL SELECT 'Dalam perjalanan', 'MESSAGE', '\\b(otw|on\\s+the\\s+way|dalam\\s+perjalanan|menuju\\s+ke|meluncur)\\b', 'REGEX', 'Baik {{nama}}, informasi perjalanan Bapak/Ibu akan saya sampaikan kepada pemilik akun ini.', 1, 3
  UNION ALL SELECT 'Tanya posisi', 'MESSAGE', '\\bposisi\\s+(di\\s*mana|sekarang)\\b|\\bdi\\s*mana\\s+(sekarang|posisi|ya)\\b|\\bada\\s+di\\s+(kantor|rumah|tempat|ruangan)\\b', 'REGEX', 'Mohon maaf {{nama}}, pemilik akun ini belum dapat membalas saat ini. Pertanyaan Bapak/Ibu akan segera saya sampaikan.', 1, 3
  UNION ALL SELECT 'Mau berbicara', 'MESSAGE', '\\b(mau|ingin|perlu|butuh)\\s+(bicara|ngobrol|diskusi|berdiskusi|konsultasi|curhat|cerita|ngomong)\\b', 'REGEX', 'Baik {{nama}}, permintaan untuk berbicara Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Terlambat', 'MESSAGE', '\\b(terlambat|telat|kena\\s+macet|macet)(nya)?\\b', 'REGEX', 'Baik {{nama}}, informasi keterlambatan Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Rapat daring', 'MESSAGE', '\\b(zoom|gmeet|google\\s+meet|ms\\s+teams|link\\s+meeting|vicon|video\\s+conference)\\b', 'REGEX', 'Baik {{nama}}, perihal rapat daring akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Dokumen', 'MESSAGE', '\\b(dokumen|berkas|file|lampiran|pdf|hasil\\s+scan)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal dokumen akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Tanda tangan', 'MESSAGE', '\\b(tanda\\s*tangan|ttd|paraf)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal tanda tangan akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Proposal', 'MESSAGE', '\\b(proposal|penawaran|quotation)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal proposal dan penawaran akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Kontrak', 'MESSAGE', '\\b(kontrak|perjanjian|mou|pks)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal kontrak dan perjanjian akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Revisi', 'MESSAGE', '\\b(revisi|koreksi|ralat)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal revisi akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Persetujuan', 'MESSAGE', '\\b(approve|approval|persetujuan|acc|disetujui)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal persetujuan akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Izin dan cuti', 'MESSAGE', '\\b(izin|ijin|cuti)(nya)?\\b', 'REGEX', 'Baik {{nama}}, permohonan izin Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Lembur dan shift', 'MESSAGE', '\\b(lembur|overtime|shift|tukar\\s+jadwal)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal lembur dan jadwal kerja akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Gaji', 'MESSAGE', '\\b(gaji|slip\\s+gaji|thr|bonus|honor|honorarium)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal gaji dan honor akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Lowongan', 'MESSAGE', '\\b(lowongan|loker|lamaran\\s+kerja|melamar|rekrutmen|cv)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal lowongan dan lamaran kerja akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Magang', 'MESSAGE', '\\b(magang|pkl|internship|praktik\\s+kerja)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal magang akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Wawancara', 'MESSAGE', '\\b(wawancara|interview)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal wawancara akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Presentasi', 'MESSAGE', '\\b(presentasi|paparan|slide|ppt)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal presentasi akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Proyek', 'MESSAGE', '\\b(proyek|project|tender|lelang)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal proyek akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Kuitansi', 'MESSAGE', '\\b(kuitansi|kwitansi|nota|struk|faktur)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal kuitansi dan nota akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Pajak', 'MESSAGE', '\\b(pajak|npwp|spt|pph|ppn)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal pajak akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Reimburse', 'MESSAGE', '\\b(reimburse|reimbursement|klaim|penggantian\\s+biaya)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal penggantian biaya akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Pinjaman', 'MESSAGE', '\\b(hutang|utang|pinjaman|cicilan|angsuran)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal pinjaman akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Kerja sama', 'MESSAGE', '\\b(kerja\\s*sama|kolaborasi|partnership|sponsor|sponsorship)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal kerja sama akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Perjalanan dinas', 'MESSAGE', '\\b(sppd|perjalanan\\s+dinas|dinas\\s+luar|tugas\\s+luar)\\b', 'REGEX', 'Baik {{nama}}, perihal perjalanan dinas akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Acara', 'MESSAGE', '\\b(acara|event|kegiatan|seminar|workshop|pelatihan|diklat|webinar)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal acara dan kegiatan akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Sertifikat', 'MESSAGE', '\\b(sertifikat|ijazah|piagam|legalisir|transkrip)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal sertifikat dan ijazah akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Saran dan masukan', 'MESSAGE', '\\b(rekomendasi|saran|masukan|usul|usulan|pendapat)(nya)?\\b', 'REGEX', 'Terima kasih atas saran dan masukan Bapak/Ibu, {{nama}}. Akan saya sampaikan kepada pemilik akun ini.', 1, 3
  UNION ALL SELECT 'Harga', 'MESSAGE', '\\b(harga|price|tarif|ongkos)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal harga akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Diskon', 'MESSAGE', '\\b(diskon|promo|potongan\\s+harga|voucher)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal diskon dan promo akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Pesanan', 'MESSAGE', '\\b(pesanan|order|pre\\s*order|memesan|beli|membeli)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal pesanan akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Pengiriman', 'MESSAGE', '\\b(paket|kurir|resi|ongkir|ekspedisi|pengiriman)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal pengiriman akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Stok', 'MESSAGE', '\\b(stok|stock|ketersediaan|ready\\s+stok)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal ketersediaan barang akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Keluhan', 'MESSAGE', '\\b(komplain|complain|keluhan|kecewa|protes)(nya)?\\b', 'REGEX', 'Mohon maaf atas ketidaknyamanannya, {{nama}}. Keluhan Bapak/Ibu akan segera saya sampaikan kepada pemilik akun ini.', 1, 5
  UNION ALL SELECT 'Garansi', 'MESSAGE', '\\b(garansi|retur|refund|pengembalian\\s+dana)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal garansi dan pengembalian akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Katering', 'MESSAGE', '\\b(catering|katering|nasi\\s+kotak|snack|konsumsi)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal konsumsi akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Nomor kontak', 'MESSAGE', '\\b(nomor|nomer|no)\\s+(hp|wa|telepon|telp|kontak)\\b|\\bminta\\s+kontak\\b', 'REGEX', 'Baik {{nama}}, permintaan nomor kontak Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Pulsa', 'MESSAGE', '\\b(pulsa|kuota|paket\\s+data|top\\s*up|isi\\s+ulang)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal pulsa dan kuota akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Jemput', 'MESSAGE', '\\b(jemput|dijemput|menjemput|antar|diantar|nebeng)(nya)?\\b', 'REGEX', 'Baik {{nama}}, permintaan antar jemput Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Tiket', 'MESSAGE', '\\b(tiket|ticket|booking|reservasi|kode\\s+booking)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal tiket dan reservasi akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Penerbangan', 'MESSAGE', '\\b(penerbangan|pesawat|flight|boarding|bandara|delay)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal penerbangan akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Hotel', 'MESSAGE', '\\b(hotel|penginapan|homestay|villa)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal penginapan akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Barang tertinggal', 'MESSAGE', '\\b(ketinggalan|tertinggal|kehilangan|hilang)(nya)?\\b', 'REGEX', 'Baik {{nama}}, informasi barang tertinggal atau hilang Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Servis kendaraan', 'MESSAGE', '\\b(servis|bengkel|stnk|pajak\\s+kendaraan)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal servis kendaraan akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Dokumen kependudukan', 'MESSAGE', '\\b(ktp|kartu\\s+keluarga|paspor|visa|akta|skck)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal dokumen kependudukan akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Asuransi', 'MESSAGE', '\\b(asuransi|bpjs|polis|premi)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal asuransi akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Perbankan', 'MESSAGE', '\\b(bank|atm|mbanking|m-banking|saldo|mutasi)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal perbankan akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Rumah', 'MESSAGE', '\\b(kontrakan|kos|kost|sewa|pindahan|renovasi)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal rumah dan sewa akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Listrik dan air', 'MESSAGE', '\\b(listrik|token|pln|pdam|mati\\s+lampu)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal listrik dan air akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Sekolah dan kuliah', 'MESSAGE', '\\b(sekolah|kuliah|kampus|skripsi|tesis|wisuda|ujian)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal sekolah dan kuliah akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Kesehatan', 'MESSAGE', '\\b(obat|vitamin|vaksin|periksa|check\\s*up|dokter|klinik)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal kesehatan akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Ibadah', 'MESSAGE', '\\b(sholat|shalat|solat|jumatan|pengajian|kajian|ibadah|misa|kebaktian)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal kegiatan ibadah akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Donasi', 'MESSAGE', '\\b(zakat|infaq|infak|sedekah|donasi|sumbangan|qurban|kurban)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal donasi akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Arisan dan iuran', 'MESSAGE', '\\b(arisan|iuran|patungan)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal arisan dan iuran akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Pernikahan', 'MESSAGE', '\\b(nikah|menikah|pernikahan|resepsi|akad|tunangan)(nya)?\\b', 'REGEX', 'Terima kasih atas kabar bahagia dari Bapak/Ibu, {{nama}}. Akan saya sampaikan kepada pemilik akun ini.', 1, 3
  UNION ALL SELECT 'Kelahiran', 'MESSAGE', '\\b(lahiran|melahirkan|kelahiran|aqiqah|akikah)(nya)?\\b', 'REGEX', 'Terima kasih atas kabar bahagia dari Bapak/Ibu, {{nama}}. Akan saya sampaikan kepada pemilik akun ini.', 1, 3
  UNION ALL SELECT 'Kumpul dan reuni', 'MESSAGE', '\\b(reuni|kumpul|silaturahmi|halal\\s*bihalal|bukber|buka\\s+bersama)(nya)?\\b', 'REGEX', 'Terima kasih atas ajakan Bapak/Ibu, {{nama}}. Akan saya sampaikan kepada pemilik akun ini.', 1, 3
  UNION ALL SELECT 'Ajakan makan', 'MESSAGE', '\\b(makan\\s+(siang|malam|bareng|bersama)|sarapan|ngopi|kopdar|nongkrong)\\b', 'REGEX', 'Terima kasih atas ajakan Bapak/Ibu, {{nama}}. Akan saya sampaikan kepada pemilik akun ini.', 1, 3
  UNION ALL SELECT 'Ajakan olahraga', 'MESSAGE', '\\b(futsal|badminton|bulutangkis|gowes|jogging|golf|tenis|mancing|olahraga)(nya)?\\b', 'REGEX', 'Terima kasih atas ajakan Bapak/Ibu, {{nama}}. Akan saya sampaikan kepada pemilik akun ini.', 1, 3
  UNION ALL SELECT 'Liburan', 'MESSAGE', '\\b(liburan|wisata|jalan-jalan|healing|piknik)(nya)?\\b', 'REGEX', 'Baik {{nama}}, perihal liburan akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Mudik', 'MESSAGE', '\\b(mudik|pulang\\s+kampung|balik\\s+kampung)\\b', 'REGEX', 'Baik {{nama}}, perihal mudik akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 3
  UNION ALL SELECT 'Mohon doa', 'MESSAGE', '\\b(doakan|mohon\\s+doa|minta\\s+doa|mohon\\s+doanya)\\b', 'REGEX', 'Baik {{nama}}, permohonan doa Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 2
  UNION ALL SELECT 'Minta tolong', 'MESSAGE', '\\b(tolong|mohon\\s+bantuan|minta\\s+tolong|bantu|bantuin|help)(nya)?\\b', 'REGEX', 'Baik {{nama}}, permintaan bantuan Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 2
  UNION ALL SELECT 'Tanya kesanggupan', 'MESSAGE', '\\b(apakah\\s+bisa|bisakah|bolehkah|bisa\\s+(tidak|nggak|ga|gak|kah)|boleh\\s+(tidak|nggak|ga|gak|kah))\\b', 'REGEX', 'Baik {{nama}}, pertanyaan Bapak/Ibu akan saya sampaikan kepada pemilik akun ini. Mohon kesediaannya menunggu.', 1, 1
  UNION ALL SELECT 'Ucapan umum', 'MESSAGE', '\\bselamat\\s+(ya|atas)\\b|\\b(congrats|congratulations|sukses\\s+selalu)\\b', 'REGEX', 'Terima kasih banyak atas ucapan Bapak/Ibu, {{nama}}. Akan saya sampaikan kepada pemilik akun ini.', 1, 2
  UNION ALL SELECT 'Perhatian', 'MESSAGE', '\\b(semangat|tetap\\s+sehat|jaga\\s+kesehatan|sehat\\s+selalu|lekas\\s+sembuh|cepat\\s+sembuh)\\b', 'REGEX', 'Terima kasih atas perhatian dan doa Bapak/Ibu, {{nama}}. Akan saya sampaikan kepada pemilik akun ini.', 1, 2
  UNION ALL SELECT 'Rindu', 'MESSAGE', '\\b(kangen|rindu|miss\\s+you)\\b', 'REGEX', 'Terima kasih {{nama}}, pesan Bapak/Ibu akan saya sampaikan kepada pemilik akun ini.', 1, 2
  UNION ALL SELECT 'Hati-hati di jalan', 'MESSAGE', '\\b(hati-hati|hati\\s+hati|safe\\s+flight|selamat\\s+jalan)\\b', 'REGEX', 'Terima kasih atas perhatian Bapak/Ibu, {{nama}}. Akan saya sampaikan kepada pemilik akun ini.', 1, 2
  UNION ALL SELECT 'Selamat beristirahat', 'MESSAGE', '\\bselamat\\s+(tidur|istirahat|beristirahat)\\b|\\bgood\\s+night\\b', 'REGEX', 'Terima kasih {{nama}}, selamat beristirahat juga untuk Bapak/Ibu.', 1, 2
  UNION ALL SELECT 'Selamat beraktivitas', 'MESSAGE', '\\bselamat\\s+(makan|berbuka|sahur|berpuasa|bekerja|beraktivitas|bertugas|berlibur)\\b', 'REGEX', 'Terima kasih {{nama}}, demikian juga untuk Bapak/Ibu.', 1, 2
  UNION ALL SELECT 'Pamit', 'MESSAGE', '\\b(pamit|undur\\s+diri|duluan\\s+ya|sampai\\s+jumpa|bye|dadah)\\b', 'REGEX', 'Baik {{nama}}, terima kasih telah menghubungi. Sampai jumpa kembali.', 1, 1
  UNION ALL SELECT 'Salam bahasa Inggris', 'MESSAGE', '^\\s*good\\s+(morning|afternoon|evening)\\b', 'REGEX', 'Salam hormat {{nama}}, terima kasih telah menghubungi. Silakan sampaikan keperluan Bapak/Ibu, akan segera saya sampaikan kepada pemilik akun ini.', 1, 1
  UNION ALL SELECT 'Panggilan singkat', 'MESSAGE', '^\\s*(woi|woy|oi|oy|bro|bos|boss|gan|kak|pak|bu|mas|mbak|bang|om|tante|bapak|ibu)\\b[\\s.!?]*$', 'REGEX', 'Halo {{nama}}, terima kasih telah menghubungi. Silakan sampaikan keperluan Bapak/Ibu, akan segera saya sampaikan kepada pemilik akun ini.', 1, 1
  UNION ALL SELECT 'Tanya ada orang', 'MESSAGE', '^\\s*(ada|ada\\s+orang|ada\\s+di\\s+tempat|online|aktif)\\s*\\??\\s*$', 'REGEX', 'Mohon maaf {{nama}}, pemilik akun ini belum dapat membalas saat ini. Silakan sampaikan keperluan Bapak/Ibu, akan segera saya sampaikan.', 1, 1
  UNION ALL SELECT 'Sapaan bahasa Inggris', 'MESSAGE', '\\b(how\\s+are\\s+you|can\\s+i\\s+call|are\\s+you\\s+free|please\\s+call|call\\s+me)\\b', 'REGEX', 'Thank you for your message, {{nama}}. I will pass it on to the owner of this account as soon as possible.', 1, 2
) AS s
WHERE @owner IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM autoresponders a WHERE a.name = s.name COLLATE utf8mb4_unicode_ci AND a.ownerId <=> @owner
  );

-- Pembaruan keyword bawaan untuk instalasi lama. Hanya menyentuh aturan yang keyword-nya
-- masih persis versi lama — keyword yang sudah Anda ubah sendiri tidak ditimpa.
-- "Salam pembuka": kini juga mengenali singkatan salam (ass, aslm, asw, askum, mikum).
UPDATE autoresponders
SET keyword = '\\bass?alam|^\\s*(ass|aslm|asw|askum|mikum|samlekum)\\b', updatedAt = NOW(3)
WHERE name = 'Salam pembuka' AND matchType = 'REGEX' AND keyword = '\\bass?alam';

SELECT id, name, triggerType, keyword, matchType, isActive, ownerId FROM autoresponders ORDER BY id;
