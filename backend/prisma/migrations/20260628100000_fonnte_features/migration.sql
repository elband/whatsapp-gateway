-- Fitur tambahan ala-Fonnte: autoresponder, OTP, tombol/list, kuota, inbox seenAt

-- Perluas enum MessageType (BUTTON, LIST) di semua kolom yang memakainya
ALTER TABLE `messages` MODIFY `type` ENUM('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'LOCATION', 'CONTACT', 'BUTTON', 'LIST') NOT NULL DEFAULT 'TEXT';
ALTER TABLE `templates` MODIFY `type` ENUM('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'LOCATION', 'CONTACT', 'BUTTON', 'LIST') NOT NULL DEFAULT 'TEXT';
ALTER TABLE `broadcasts` MODIFY `messageType` ENUM('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'LOCATION', 'CONTACT', 'BUTTON', 'LIST') NOT NULL DEFAULT 'TEXT';

-- Kolom baru
ALTER TABLE `messages` ADD COLUMN `seenAt` DATETIME(3) NULL;
ALTER TABLE `devices` ADD COLUMN `quota` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `devices` ADD COLUMN `quotaUsed` INTEGER NOT NULL DEFAULT 0;

-- ---------- autoresponders ----------
CREATE TABLE `autoresponders` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `deviceId` INTEGER NULL,
  `keyword` VARCHAR(191) NOT NULL,
  `matchType` ENUM('EXACT', 'CONTAINS', 'STARTS_WITH', 'REGEX') NOT NULL DEFAULT 'CONTAINS',
  `response` TEXT NOT NULL,
  `templateId` INTEGER NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `priority` INTEGER NOT NULL DEFAULT 0,
  `hitCount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `autoresponders_deviceId_idx`(`deviceId`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- otps ----------
CREATE TABLE `otps` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `deviceId` INTEGER NULL,
  `phone` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `purpose` VARCHAR(191) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `verifiedAt` DATETIME(3) NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `otps_phone_idx`(`phone`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `autoresponders` ADD CONSTRAINT `autoresponders_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `autoresponders` ADD CONSTRAINT `autoresponders_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
