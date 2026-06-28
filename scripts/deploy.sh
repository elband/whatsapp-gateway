#!/usr/bin/env bash
# Deploy awal / setup aplikasi di server (jalankan dari root project).
set -euo pipefail

APP_DIR="/var/www/whatsapp-gateway"
cd "$APP_DIR"

echo "==> [1/5] Install dependency backend"
cd "${APP_DIR}/backend"
npm ci --omit=dev || npm install --omit=dev

echo "==> [2/5] Generate Prisma client & migrasi database"
npx prisma generate
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  echo "    (belum ada migrasi) menjalankan prisma db push"
  npx prisma db push
fi

echo "==> [3/5] Seed data awal (admin, roles, permissions) — aman dijalankan berulang"
node prisma/seed.js || true

echo "==> [4/5] Build frontend"
cd "${APP_DIR}/frontend"
npm ci || npm install
npm run build

echo "==> [5/5] (Re)start backend via PM2"
cd "$APP_DIR"
pm2 startOrReload ecosystem.config.cjs
pm2 save

echo "==> Deploy selesai. Cek: pm2 status && curl -s http://127.0.0.1:4000/health"
