-- Multi-user: kolom ownerId + backfill data lama + unique per-owner.

-- 1) Tambah kolom ownerId (nullable dulu, agar data lama tidak menolak)
ALTER TABLE `autoresponders` ADD COLUMN `ownerId` INTEGER NULL;
ALTER TABLE `contact_groups` ADD COLUMN `ownerId` INTEGER NULL;
ALTER TABLE `contacts` ADD COLUMN `ownerId` INTEGER NULL;
ALTER TABLE `templates` ADD COLUMN `ownerId` INTEGER NULL;

-- 2) Backfill: data lama dimiliki oleh user pertama (super admin default)
SET @firstUser := (SELECT `id` FROM `users` ORDER BY `id` ASC LIMIT 1);
UPDATE `devices`         SET `ownerId` = @firstUser WHERE `ownerId` IS NULL;
UPDATE `contacts`        SET `ownerId` = @firstUser WHERE `ownerId` IS NULL;
UPDATE `contact_groups`  SET `ownerId` = @firstUser WHERE `ownerId` IS NULL;
UPDATE `templates`       SET `ownerId` = @firstUser WHERE `ownerId` IS NULL;
UPDATE `autoresponders`  SET `ownerId` = @firstUser WHERE `ownerId` IS NULL;

-- 3) Ganti unique global -> composite per-owner (SETELAH backfill agar tidak bentrok)
DROP INDEX `contacts_phone_key` ON `contacts`;
DROP INDEX `templates_name_key` ON `templates`;

-- 4) Index & unique baru
CREATE INDEX `autoresponders_ownerId_idx` ON `autoresponders`(`ownerId`);
CREATE INDEX `contact_groups_ownerId_idx` ON `contact_groups`(`ownerId`);
CREATE INDEX `contacts_ownerId_idx` ON `contacts`(`ownerId`);
CREATE UNIQUE INDEX `contacts_ownerId_phone_key` ON `contacts`(`ownerId`, `phone`);
CREATE INDEX `templates_ownerId_idx` ON `templates`(`ownerId`);
CREATE UNIQUE INDEX `templates_ownerId_name_key` ON `templates`(`ownerId`, `name`);

-- 5) Foreign key ke users
ALTER TABLE `contact_groups` ADD CONSTRAINT `contact_groups_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `templates` ADD CONSTRAINT `templates_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `autoresponders` ADD CONSTRAINT `autoresponders_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 6) Device: index ownerId sudah ada sebagai FK index, cukup rename agar sesuai schema
ALTER TABLE `devices` RENAME INDEX `devices_ownerId_fkey` TO `devices_ownerId_idx`;
