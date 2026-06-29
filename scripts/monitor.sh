#!/usr/bin/env bash
# Cek kesehatan service (untuk cron/monitoring sederhana). Auto-restart bila health gagal.
# Cron contoh (tiap 5 menit): */5 * * * * /var/www/whatsapp-gateway/scripts/monitor.sh >> /var/www/whatsapp-gateway/logs/monitor.log 2>&1
set -uo pipefail

HEALTH_URL="http://127.0.0.1:4001/health"
STAMP=$(date '+%Y-%m-%d %H:%M:%S')

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || echo "000")
if [ "$code" = "200" ]; then
  echo "[$STAMP] OK ($code)"
else
  echo "[$STAMP] HEALTH GAGAL ($code) -> restart backend"
  pm2 restart wa-gateway-api || systemctl restart whatsapp-gateway || true
fi

# Cek service pendukung
systemctl is-active --quiet redis-server || echo "[$STAMP] WARNING: redis-server tidak aktif"
(systemctl is-active --quiet mariadb || systemctl is-active --quiet mysql) || echo "[$STAMP] WARNING: database tidak aktif"
