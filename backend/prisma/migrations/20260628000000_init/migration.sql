-- WhatsApp Gateway Enterprise - Initial schema (baseline)
-- Setara dengan prisma/schema.prisma. Dijalankan oleh `prisma migrate deploy`.

-- ---------- roles ----------
CREATE TABLE `roles` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `isSystem` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `roles_name_key`(`name`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- permissions ----------
CREATE TABLE `permissions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `group` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `permissions_name_key`(`name`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- role_permissions ----------
CREATE TABLE `role_permissions` (
  `roleId` INTEGER NOT NULL,
  `permissionId` INTEGER NOT NULL,
  PRIMARY KEY (`roleId`, `permissionId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- users ----------
CREATE TABLE `users` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `avatar` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `lastLoginAt` DATETIME(3) NULL,
  `roleId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `users_email_key`(`email`),
  INDEX `users_roleId_idx`(`roleId`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- refresh_tokens ----------
CREATE TABLE `refresh_tokens` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `tokenHash` VARCHAR(255) NOT NULL,
  `userAgent` VARCHAR(191) NULL,
  `ip` VARCHAR(191) NULL,
  `revoked` BOOLEAN NOT NULL DEFAULT false,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `refresh_tokens_userId_idx`(`userId`),
  INDEX `refresh_tokens_tokenHash_idx`(`tokenHash`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- api_keys ----------
CREATE TABLE `api_keys` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `keyPrefix` VARCHAR(191) NOT NULL,
  `keyHash` VARCHAR(255) NOT NULL,
  `scopes` JSON NULL,
  `defaultDeviceId` INTEGER NULL,
  `rateLimit` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `lastUsedAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `createdById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `api_keys_keyPrefix_key`(`keyPrefix`),
  INDEX `api_keys_keyPrefix_idx`(`keyPrefix`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- device_groups ----------
CREATE TABLE `device_groups` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `color` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `device_groups_name_key`(`name`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- devices ----------
CREATE TABLE `devices` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `phoneNumber` VARCHAR(191) NULL,
  `status` ENUM('INITIALIZING', 'QR', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'LOGGED_OUT') NOT NULL DEFAULT 'INITIALIZING',
  `qr` TEXT NULL,
  `groupId` INTEGER NULL,
  `ownerId` INTEGER NULL,
  `webhookUrl` VARCHAR(191) NULL,
  `webhookEvents` JSON NULL,
  `lastSeenAt` DATETIME(3) NULL,
  `connectedAt` DATETIME(3) NULL,
  `autoReconnect` BOOLEAN NOT NULL DEFAULT true,
  `meta` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `devices_deviceId_key`(`deviceId`),
  INDEX `devices_groupId_idx`(`groupId`),
  INDEX `devices_status_idx`(`status`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- sessions ----------
CREATE TABLE `sessions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `deviceId` INTEGER NOT NULL,
  `keyId` VARCHAR(191) NOT NULL,
  `value` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `sessions_deviceId_idx`(`deviceId`),
  UNIQUE INDEX `sessions_deviceId_keyId_key`(`deviceId`, `keyId`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- contact_groups ----------
CREATE TABLE `contact_groups` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `color` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- contacts ----------
CREATE TABLE `contacts` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `tags` JSON NULL,
  `meta` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `contacts_phone_key`(`phone`),
  INDEX `contacts_name_idx`(`name`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- contact_group_members ----------
CREATE TABLE `contact_group_members` (
  `contactId` INTEGER NOT NULL,
  `groupId` INTEGER NOT NULL,
  PRIMARY KEY (`contactId`, `groupId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- templates ----------
CREATE TABLE `templates` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'LOCATION', 'CONTACT') NOT NULL DEFAULT 'TEXT',
  `body` TEXT NOT NULL,
  `caption` TEXT NULL,
  `mediaPath` VARCHAR(191) NULL,
  `variables` JSON NULL,
  `description` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `templates_name_key`(`name`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- broadcasts ----------
CREATE TABLE `broadcasts` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `deviceId` INTEGER NOT NULL,
  `templateId` INTEGER NULL,
  `status` ENUM('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
  `messageType` ENUM('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'LOCATION', 'CONTACT') NOT NULL DEFAULT 'TEXT',
  `body` TEXT NULL,
  `mediaPath` VARCHAR(191) NULL,
  `caption` TEXT NULL,
  `minDelayMs` INTEGER NOT NULL DEFAULT 3000,
  `maxDelayMs` INTEGER NOT NULL DEFAULT 8000,
  `scheduledAt` DATETIME(3) NULL,
  `startedAt` DATETIME(3) NULL,
  `finishedAt` DATETIME(3) NULL,
  `total` INTEGER NOT NULL DEFAULT 0,
  `sentCount` INTEGER NOT NULL DEFAULT 0,
  `failedCount` INTEGER NOT NULL DEFAULT 0,
  `createdById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `broadcasts_status_idx`(`status`),
  INDEX `broadcasts_deviceId_idx`(`deviceId`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- broadcast_items ----------
CREATE TABLE `broadcast_items` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `broadcastId` INTEGER NOT NULL,
  `contactId` INTEGER NULL,
  `phone` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NULL,
  `variables` JSON NULL,
  `status` ENUM('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED') NOT NULL DEFAULT 'QUEUED',
  `error` TEXT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `broadcast_items_broadcastId_idx`(`broadcastId`),
  INDEX `broadcast_items_status_idx`(`status`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- messages ----------
CREATE TABLE `messages` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `deviceId` INTEGER NOT NULL,
  `direction` ENUM('INBOUND', 'OUTBOUND') NOT NULL,
  `type` ENUM('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'LOCATION', 'CONTACT') NOT NULL DEFAULT 'TEXT',
  `status` ENUM('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED') NOT NULL DEFAULT 'QUEUED',
  `to` VARCHAR(191) NULL,
  `from` VARCHAR(191) NULL,
  `body` TEXT NULL,
  `caption` TEXT NULL,
  `waMessageId` VARCHAR(191) NULL,
  `error` TEXT NULL,
  `broadcastItemId` INTEGER NULL,
  `apiKeyId` INTEGER NULL,
  `meta` JSON NULL,
  `sentAt` DATETIME(3) NULL,
  `deliveredAt` DATETIME(3) NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `messages_broadcastItemId_key`(`broadcastItemId`),
  INDEX `messages_deviceId_idx`(`deviceId`),
  INDEX `messages_status_idx`(`status`),
  INDEX `messages_direction_idx`(`direction`),
  INDEX `messages_waMessageId_idx`(`waMessageId`),
  INDEX `messages_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- attachments ----------
CREATE TABLE `attachments` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `messageId` INTEGER NOT NULL,
  `fileName` VARCHAR(191) NOT NULL,
  `filePath` VARCHAR(191) NOT NULL,
  `mimeType` VARCHAR(191) NULL,
  `size` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `attachments_messageId_idx`(`messageId`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- logs ----------
CREATE TABLE `logs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `type` ENUM('API', 'LOGIN', 'ERROR', 'BROADCAST', 'DEVICE', 'MESSAGE', 'WEBHOOK', 'CONTACT', 'TEMPLATE', 'SETTING', 'SYSTEM') NOT NULL,
  `level` ENUM('INFO', 'WARN', 'ERROR') NOT NULL DEFAULT 'INFO',
  `action` VARCHAR(191) NOT NULL,
  `message` TEXT NULL,
  `userId` INTEGER NULL,
  `apiKeyId` INTEGER NULL,
  `deviceId` INTEGER NULL,
  `ip` VARCHAR(191) NULL,
  `userAgent` VARCHAR(191) NULL,
  `meta` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `logs_type_idx`(`type`),
  INDEX `logs_level_idx`(`level`),
  INDEX `logs_userId_idx`(`userId`),
  INDEX `logs_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- settings ----------
CREATE TABLE `settings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(191) NOT NULL,
  `value` JSON NOT NULL,
  `group` VARCHAR(191) NOT NULL DEFAULT 'general',
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `settings_key_key`(`key`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------- Foreign keys ----------
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `users` ADD CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `devices` ADD CONSTRAINT `devices_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `device_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `devices` ADD CONSTRAINT `devices_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `contact_group_members` ADD CONSTRAINT `contact_group_members_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `contact_group_members` ADD CONSTRAINT `contact_group_members_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `contact_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `broadcasts` ADD CONSTRAINT `broadcasts_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `broadcasts` ADD CONSTRAINT `broadcasts_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `broadcast_items` ADD CONSTRAINT `broadcast_items_broadcastId_fkey` FOREIGN KEY (`broadcastId`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `messages` ADD CONSTRAINT `messages_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `messages` ADD CONSTRAINT `messages_broadcastItemId_fkey` FOREIGN KEY (`broadcastItemId`) REFERENCES `broadcast_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `logs` ADD CONSTRAINT `logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
