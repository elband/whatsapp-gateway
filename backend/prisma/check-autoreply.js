// Diagnosa "auto-balas tidak jalan" — hanya MEMBACA database, tidak mengubah apa pun.
// Pakai (dari folder backend):  node prisma/check-autoreply.js
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAutoReply } from '../src/services/autoReplyPolicy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const problems = [];
const problem = (msg) => problems.push(msg);
const fmt = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : '-');

async function main() {
  // 1. Migrasi: kolom triggerType harus ada.
  const col = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM `autoresponders` LIKE 'triggerType'");
  if (!col.length) {
    console.log('[X] Kolom autoresponders.triggerType BELUM ada.');
    problem('Migrasi belum dijalankan — jalankan: bash scripts/update.sh (atau npx --yes prisma@5 migrate deploy di folder backend).');
    return;
  }
  console.log('[ok] Kolom autoresponders.triggerType ada (migrasi sudah jalan).');

  // 2. Device: harus CONNECTED, mode bukan OFF, dan (mode satu proses) shard 0.
  const role = process.env.CLUSTER_ROLE || 'all';
  const devices = await prisma.device.findMany({ orderBy: { id: 'asc' } });
  const rules = await prisma.autoresponder.findMany({ where: { isActive: true } });
  console.log(`\nMode proses (CLUSTER_ROLE di .env): ${role}`);
  console.log('\nDEVICE');
  if (!devices.length) problem('Belum ada device.');
  for (const d of devices) {
    const cfg = normalizeAutoReply(d.autoReply);
    const mine = rules.filter((r) => r.deviceId === d.id || (r.deviceId === null && r.ownerId === d.ownerId && cfg.useGlobalRules));
    const calls = mine.filter((r) => r.triggerType === 'MISSED_CALL').length;
    const keywords = mine.length - calls;
    console.log(
      `  #${d.id} "${d.name}" status=${d.status} nomor=${d.phoneNumber || '-'} pemilik=user#${d.ownerId ?? '-'} shard=${d.shardId ?? '-'} ` +
        `mode=${cfg.mode} | aturan berlaku: ${keywords} keyword, ${calls} panggilan`,
    );
    const tag = `Device #${d.id} "${d.name}"`;
    if (d.status !== 'CONNECTED') problem(`${tag}: status ${d.status}, bukan CONNECTED — scan QR / sambungkan dulu.`);
    if (cfg.mode === 'OFF') problem(`${tag}: mode auto-balas Mati — ubah di Devices → Auto-balas.`);
    if (cfg.mode !== 'KEYWORD' && cfg.mode !== 'OFF') problem(`${tag}: mode ${cfg.mode} — aturan keyword hanya jalan di mode Keyword (balasan panggilan tetap jalan).`);
    if (cfg.mode === 'KEYWORD' && d.status === 'CONNECTED' && cfg.cooldownMinutes === 0 && keywords > 0) {
      problem(`${tag}: jeda keyword = 0, jadi SETIAP pesan yang cocok dibalas (termasuk laporan otomatis yang berulang). Isi "Jeda keyword yang sama per kontak" di Devices → Auto-balas, mis. 60 menit.`);
    }
    if (!mine.length) problem(`${tag}: tidak ada aturan aktif yang berlaku untuk device ini (pemilik device user#${d.ownerId ?? '-'}).`);
    if (role === 'all' && d.shardId) problem(`${tag}: shardId=${d.shardId} padahal aplikasi jalan satu proses — pesan keluar device ini tidak pernah diproses. Set shardId ke 0.`);
  }

  // 3. Aturan per pemilik — aturan "semua device" hanya berlaku di device milik user yang sama.
  console.log('\nATURAN AKTIF per pemilik');
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const emailOf = (id) => users.find((u) => u.id === id)?.email || '?';
  const byOwner = new Map();
  for (const r of rules) byOwner.set(r.ownerId, [...(byOwner.get(r.ownerId) || []), r]);
  if (!rules.length) {
    console.log('  (kosong)');
    problem('Tabel autoresponders tidak punya aturan aktif — isi lewat menu Autoresponder atau scripts/seed-autoresponders.sql.');
  }
  for (const [owner, list] of byOwner) {
    const calls = list.filter((r) => r.triggerType === 'MISSED_CALL').length;
    console.log(`  user#${owner ?? '-'} (${owner ? emailOf(owner) : 'tanpa pemilik'}): ${list.length - calls} keyword, ${calls} panggilan`);
  }
  for (const d of devices) {
    if (d.ownerId && !byOwner.has(d.ownerId) && rules.length) {
      problem(`Aturan ada, tetapi bukan milik user#${d.ownerId} (${emailOf(d.ownerId)}) yang memiliki device #${d.id}. Ubah @owner_email di scripts/seed-autoresponders.sql ke email itu lalu jalankan lagi.`);
    }
  }

  // 4. Jejak nyata: pesan masuk terakhir & balasan otomatis terakhir.
  const inbound = await prisma.message.findMany({ where: { direction: 'INBOUND' }, orderBy: { id: 'desc' }, take: 5 });
  console.log('\nPESAN MASUK TERAKHIR');
  if (!inbound.length) console.log('  (belum ada)');
  for (const m of inbound) console.log(`  ${fmt(m.createdAt)} device#${m.deviceId} dari ${m.from}: ${(m.body || '').slice(0, 50)}`);

  const replies = await prisma.message.findMany({
    where: { direction: 'OUTBOUND', meta: { path: '$.kind', equals: 'autoreply' } },
    orderBy: { id: 'desc' },
    take: 8,
  });
  console.log('\nBALASAN OTOMATIS TERAKHIR');
  if (!replies.length) console.log('  (belum pernah ada balasan otomatis yang dibuat)');
  for (const m of replies) {
    console.log(`  ${fmt(m.createdAt)} device#${m.deviceId} ke ${m.to} status=${m.status} [${m.meta?.autoReplyKey || ''}]${m.error ? ` error: ${m.error}` : ''}`);
  }
  const stuck = replies.filter((m) => m.status === 'QUEUED' && Date.now() - new Date(m.createdAt).getTime() > 5 * 60000);
  if (stuck.length) problem(`${stuck.length} balasan otomatis tertahan di status QUEUED > 5 menit — worker antrean tidak memprosesnya (cek Redis, shard device, dan pm2 logs).`);
  const failed = replies.find((m) => m.status === 'FAILED');
  if (failed) problem(`Balasan otomatis terakhir GAGAL dikirim: ${failed.error || '(tanpa pesan error)'}`);
  if (inbound.length && !replies.length && rules.length) {
    problem('Ada pesan masuk tetapi belum pernah ada balasan otomatis yang dibuat — cek kecocokan keyword, pemilik aturan, dan mode device di atas.');
  }
}

main()
  .catch((e) => problem(`Gagal membaca database: ${e.message}`))
  .finally(async () => {
    console.log('\nKESIMPULAN');
    if (!problems.length) console.log('  Tidak ada masalah konfigurasi yang terdeteksi. Bila tetap tidak membalas, kirim: pm2 logs --lines 200');
    for (const p of problems) console.log(`  - ${p}`);
    await prisma.$disconnect();
  });
