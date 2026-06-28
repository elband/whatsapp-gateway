#!/usr/bin/env bash
# Backup database MySQL/MariaDB WhatsApp Gateway.
# Cron contoh (harian 02:00): 0 2 * * * /var/www/whatsapp-gateway/scripts/backup-db.sh
set -euo pipefail

APP_DIR="/var/www/whatsapp-gateway"
BACKUP_DIR="${APP_DIR}/storage/backups/db"
RETENTION_DAYS=14

# Ambil kredensial dari backend/.env (DATABASE_URL=mysql://user:pass@host:port/db)
DATABASE_URL=$(grep -E '^DATABASE_URL=' "${APP_DIR}/backend/.env" | cut -d '=' -f2- | tr -d '"')
# Parse URL
proto_removed=${DATABASE_URL#mysql://}
creds=${proto_removed%@*}
hostpart=${proto_removed#*@}
DB_USER=${creds%%:*}
DB_PASS=${creds#*:}
DB_HOST=$(echo "$hostpart" | sed -E 's#([^:/]+).*#\1#')
DB_PORT=$(echo "$hostpart" | sed -E 's#[^:]+:([0-9]+).*#\1#'); [ "$DB_PORT" = "$hostpart" ] && DB_PORT=3306
DB_NAME=$(echo "$hostpart" | sed -E 's#.*/([^/?]+).*#\1#')

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
OUT="${BACKUP_DIR}/${DB_NAME}_${STAMP}.sql.gz"

echo "[backup-db] Membackup ${DB_NAME} -> ${OUT}"
mysqldump --single-transaction --quick --routines --events \
  -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$OUT"

echo "[backup-db] Menghapus backup lebih lama dari ${RETENTION_DAYS} hari"
find "$BACKUP_DIR" -name '*.sql.gz' -mtime +${RETENTION_DAYS} -delete

echo "[backup-db] Selesai: $(du -h "$OUT" | cut -f1)"
