-- Pemicu aturan autoresponder: MESSAGE (keyword pada pesan masuk, perilaku lama)
-- atau MISSED_CALL (panggilan WhatsApp tidak terangkat; kolom keyword dikosongkan).
ALTER TABLE `autoresponders`
  ADD COLUMN `triggerType` ENUM('MESSAGE', 'MISSED_CALL') NOT NULL DEFAULT 'MESSAGE' AFTER `deviceId`;
