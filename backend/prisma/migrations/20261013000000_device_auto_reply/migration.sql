-- Profil auto-balas per device (mode OFF/KEYWORD/AWAY/WEBHOOK, jam kerja, cooldown,
-- jeda setelah balasan manual). NULL = default: keyword + aturan global, tanpa balas grup.
ALTER TABLE `devices`
  ADD COLUMN `autoReply` JSON NULL;
