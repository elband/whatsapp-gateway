#!/usr/bin/env bash
# Deploy awal / setup aplikasi di server (jalankan dari root project).
set -euo pipefail

APP_DIR="/var/www/whatsapp-gateway"
cd "$APP_DIR"

echo "==> [1/5] Install dependency backend"
cd "${APP_DIR}/backend"
npm ci --omit=dev || npm install --omit=dev

# Prisma CLI ada di devDependencies (tidak terpasang karena --omit=dev). Versi dikunci ke
# v5: `npx prisma` polos mengunduh versi TERBARU yang tidak cocok dengan skema/klien v5.
echo "==> [2/5] Generate Prisma client & migrasi database"
npx --yes prisma@5 generate
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx --yes prisma@5 migrate deploy
else
  echo "    (belum ada migrasi) menjalankan prisma db push"
  npx --yes prisma@5 db push
fi

echo "==> [3/5] Seed data awal (admin, roles, permissions, autoresponder) — aman dijalankan berulang"
node prisma/seed.js || true
# Data awal autoresponder (panggilan tak terjawab + keyword). Hanya menambah aturan
# yang belum ada (per nama & pemilik) — aturan yang pernah dihapus akan dibuat lagi.
npx --yes prisma@5 db execute --schema prisma/schema.prisma --file "${APP_DIR}/scripts/seed-autoresponders.sql" \
  || echo "    (peringatan) seed autoresponder gagal — jalankan manual: scripts/seed-autoresponders.sql"

echo "==> [4/5] Build frontend"
cd "${APP_DIR}/frontend"
npm ci || npm install
npm run build

echo "==> [5/5] (Re)start backend via PM2"
cd "$APP_DIR"
pm2 startOrReload ecosystem.config.cjs
pm2 save

echo "==> Deploy selesai. Cek: pm2 status && curl -s http://127.0.0.1:4001/health"
