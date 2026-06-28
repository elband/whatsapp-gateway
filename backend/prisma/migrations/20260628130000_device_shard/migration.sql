-- F3: sticky shard assignment per device
ALTER TABLE `devices` ADD COLUMN `shardId` INTEGER NULL;
CREATE INDEX `devices_shardId_idx` ON `devices`(`shardId`);
