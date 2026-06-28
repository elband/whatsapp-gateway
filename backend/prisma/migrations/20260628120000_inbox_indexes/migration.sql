-- M3: index untuk query inbox/percakapan (group by lawan bicara per device)
CREATE INDEX `messages_deviceId_from_idx` ON `messages`(`deviceId`, `from`);
CREATE INDEX `messages_deviceId_to_idx` ON `messages`(`deviceId`, `to`);
