-- Anti-ban: pengaturan istirahat per-batch per-broadcast
ALTER TABLE `broadcasts`
  ADD COLUMN `batchSize` INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN `batchRestMinMs` INTEGER NOT NULL DEFAULT 180000,
  ADD COLUMN `batchRestMaxMs` INTEGER NOT NULL DEFAULT 600000;
