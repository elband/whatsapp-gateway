#!/usr/bin/env bash
# Update aplikasi di server produksi: backup DB -> git pull -> dependency ->
# migrasi -> data awal autoresponder -> build frontend (atomic) -> reload PM2 -> cek health.
#
# Pakai:
#   bash scripts/update.sh
#
# Opsi (variabel lingkungan):
#   FORCE=1         tetap jalan walau tidak ada commit baru (mis. setelah ubah .env)
#   NO_PULL=1       jangan git pull; bangun commit yang sedang ter-checkout (rollback)
#   SKIP_BACKUP=1   lewati backup database (tidak disarankan)
#   SKIP_SEED=1     jangan isi data awal autoresponder (scripts/seed-autoresponders.sql)
#   ECOSYSTEM=...   file ecosystem PM2 (default: ecosystem.config.cjs;
#                   mode cluster: ECOSYSTEM=ecosystem.cluster.cjs)
set -euo pipefail

# Seluruh isi dibungkus { } agar bash membaca skrip sampai habis sebelum
# menjalankannya — aman walau `git pull` mengganti file ini di tengah jalan.
{

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ECOSYSTEM="${ECOSYSTEM:-ecosystem.config.cjs}"
cd "$APP_DIR"

step() { echo; echo "==> $*"; }
die() { echo "!! $*" >&2; exit 1; }

[ -f backend/.env ] || die "backend/.env tidak ditemukan di ${APP_DIR}"
[ -f "$ECOSYSTEM" ] || die "File ecosystem PM2 tidak ditemukan: ${ECOSYSTEM}"
# VITE_API_URL di-bake saat build; bila kosong frontend menembak http://localhost:4000.
grep -qE '^VITE_API_URL=.+' frontend/.env 2>/dev/null || die "frontend/.env belum berisi VITE_API_URL (domain produksi)"

PORT=$(grep -E '^PORT=' backend/.env | tail -1 | cut -d '=' -f2- | tr -d '"\r ' || true)
PORT="${PORT:-4000}"
HEALTH_URL="http://127.0.0.1:${PORT}/health"

BEFORE=$(git rev-parse HEAD)
if [ "${NO_PULL:-0}" = "1" ]; then
  step "Tanpa git pull (NO_PULL=1) — membangun commit ${BEFORE:0:7}"
  FORCE=1
else
  step "Tarik kode terbaru"
  git pull --ff-only
fi
AFTER=$(git rev-parse HEAD)
if [ "$BEFORE" = "$AFTER" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "Tidak ada commit baru (${AFTER:0:7}). Jalankan dengan FORCE=1 untuk tetap membangun ulang."
  exit 0
fi
git --no-pager log --oneline "${BEFORE}..${AFTER}" || true

# Backup SEBELUM migrasi; gagal backup = berhenti (aplikasi lama masih berjalan).
if [ "${SKIP_BACKUP:-0}" = "1" ]; then
  step "Backup database dilewati (SKIP_BACKUP=1)"
else
  step "Backup database"
  bash "${APP_DIR}/scripts/backup-db.sh" || die "Backup gagal — update dibatalkan sebelum migrasi. (SKIP_BACKUP=1 untuk melewati)"
fi

step "Dependency backend"
cd "${APP_DIR}/backend"
# devDependencies ikut dipasang: Prisma CLI ada di sana. Tanpa ini `npx prisma`
# mengunduh Prisma versi TERBARU yang bisa tidak cocok dengan skema/klien v5.
npm ci --include=dev || npm install --include=dev

step "Prisma: generate klien & migrasi database"
npx --no-install prisma generate
npx --no-install prisma migrate deploy

# Data awal autoresponder (panggilan tak terjawab + keyword), lewat DATABASE_URL —
# tanpa user/password MySQL. Hanya menambah aturan yang belum ada (per nama &
# pemilik): suntingan tidak ditimpa, tapi aturan bawaan yang DIHAPUS dibuat lagi.
if [ "${SKIP_SEED:-0}" = "1" ]; then
  step "Data awal autoresponder dilewati (SKIP_SEED=1)"
else
  step "Data awal autoresponder"
  npx --no-install prisma db execute --schema prisma/schema.prisma --file "${APP_DIR}/scripts/seed-autoresponders.sql" \
    || echo "!! Seed autoresponder gagal (update dilanjutkan) — jalankan manual: scripts/seed-autoresponders.sql" >&2
fi

step "Build frontend (atomic: build ke dist.new lalu tukar)"
cd "${APP_DIR}/frontend"
npm ci --include=dev || npm install --include=dev
rm -rf dist.new
npx --no-install vite build --outDir dist.new --emptyOutDir
[ -f dist.new/index.html ] || die "Build frontend tidak menghasilkan index.html"
# Nginx menyajikan frontend/dist langsung; penukaran hanya sekejap, tanpa reload Nginx.
rm -rf dist.old
[ -d dist ] && mv dist dist.old
mv dist.new dist
rm -rf dist.old

step "Reload backend (PM2)"
cd "$APP_DIR"
pm2 startOrReload "$ECOSYSTEM" --update-env
pm2 save

step "Cek health ${HEALTH_URL}"
for i in $(seq 1 30); do
  if curl -sf --max-time 5 "$HEALTH_URL" >/dev/null; then
    echo "Sehat: $(curl -s --max-time 5 "$HEALTH_URL")"
    echo
    echo "Update selesai: ${BEFORE:0:7} -> ${AFTER:0:7}"
    exit 0
  fi
  sleep 2
done

echo "!! Backend tidak sehat setelah 60 detik." >&2
pm2 status || true
cat >&2 <<EOF
Periksa log   : pm2 logs --lines 100
Kembali ke kode sebelumnya (migrasi DB TIDAK ikut mundur; pulihkan dari
storage/backups/db dengan scripts/restore-db.sh bila perlu):
  git reset --hard ${BEFORE} && NO_PULL=1 SKIP_BACKUP=1 bash scripts/update.sh
EOF
exit 1
}
