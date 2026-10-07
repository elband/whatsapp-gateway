-- Default tier harian jadi tanpa batas (0). Device yang sudah ada ikut dibebaskan.
ALTER TABLE `devices`
  ALTER COLUMN `dailyRecipientLimit` SET DEFAULT 0;

UPDATE `devices` SET `dailyRecipientLimit` = 0;
