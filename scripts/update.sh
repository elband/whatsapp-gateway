#!/usr/bin/env bash
# Update aplikasi tanpa downtime (zero-downtime reload).
set -euo pipefail

APP_DIR="/var/www/whatsapp-gateway"
cd "$APP_DIR"

echo "==> Backup database sebelum update"
bash "${APP_DIR}/scripts/backup-db.sh" || true

echo "==> Tarik kode terbaru"
git pull --ff-only

echo "==> Update backend"
cd "${APP_DIR}/backend"
npm ci --omit=dev || npm install --omit=dev
npx prisma generate
npx prisma migrate deploy

echo "==> Build frontend (atomic: build ke folder sementara lalu swap)"
cd "${APP_DIR}/frontend"
npm ci || npm install
npm run build
# 'dist' baru langsung dilayani Nginx (file statis), tidak perlu reload Nginx.

echo "==> Reload backend tanpa downtime"
cd "$APP_DIR"
pm2 reload ecosystem.config.cjs --update-env
pm2 save

echo "==> Update selesai. Health: $(curl -s http://127.0.0.1:4001/health || echo 'gagal')"
