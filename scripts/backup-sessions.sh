#!/usr/bin/env bash
# Backup khusus sesi WhatsApp (tabel `sessions` + `devices` yang terenkripsi)
# dan folder uploads. Sesi Baileys disimpan terenkripsi di DB sehingga
# mudah dipulihkan setelah restart/migrasi server.
set -euo pipefail

APP_DIR="/var/www/whatsapp-gateway"
BACKUP_DIR="${APP_DIR}/storage/backups/sessions"
RETENTION_DAYS=14

DATABASE_URL=$(grep -E '^DATABASE_URL=' "${APP_DIR}/backend/.env" | cut -d '=' -f2- | tr -d '"')
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
OUT="${BACKUP_DIR}/wa_sessions_${STAMP}.sql.gz"

echo "[backup-sessions] Membackup tabel sessions & devices -> ${OUT}"
mysqldump --single-transaction --quick \
  -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
  "$DB_NAME" sessions devices | gzip > "$OUT"

# Backup uploads (opsional)
if [ -d "${APP_DIR}/uploads" ]; then
  tar -czf "${BACKUP_DIR}/uploads_${STAMP}.tar.gz" -C "${APP_DIR}" uploads
fi

find "$BACKUP_DIR" -name '*.gz' -mtime +${RETENTION_DAYS} -delete
echo "[backup-sessions] Selesai."
