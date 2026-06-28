#!/usr/bin/env bash
# Restore database dari file backup .sql.gz
# Penggunaan: ./restore-db.sh /path/ke/backup.sql.gz
set -euo pipefail

APP_DIR="/var/www/whatsapp-gateway"
FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Penggunaan: $0 <file_backup.sql.gz>"
  exit 1
fi

DATABASE_URL=$(grep -E '^DATABASE_URL=' "${APP_DIR}/backend/.env" | cut -d '=' -f2- | tr -d '"')
proto_removed=${DATABASE_URL#mysql://}
creds=${proto_removed%@*}
hostpart=${proto_removed#*@}
DB_USER=${creds%%:*}
DB_PASS=${creds#*:}
DB_HOST=$(echo "$hostpart" | sed -E 's#([^:/]+).*#\1#')
DB_PORT=$(echo "$hostpart" | sed -E 's#[^:]+:([0-9]+).*#\1#'); [ "$DB_PORT" = "$hostpart" ] && DB_PORT=3306
DB_NAME=$(echo "$hostpart" | sed -E 's#.*/([^/?]+).*#\1#')

read -r -p "PERINGATAN: ini akan menimpa database '${DB_NAME}'. Lanjutkan? (yes/no) " ans
[ "$ans" = "yes" ] || { echo "Dibatalkan."; exit 1; }

echo "[restore-db] Restore ${FILE} -> ${DB_NAME}"
gunzip -c "$FILE" | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME"
echo "[restore-db] Selesai."
