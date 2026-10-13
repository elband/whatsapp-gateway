# Tutorial Deploy Produksi — WhatsApp Gateway

Panduan ini sudah disesuaikan dengan setup nyata:

| Item | Nilai |
|------|-------|
| Domain | `wg.aptpairport.id` |
| Lokasi app | `/var/www/whatsapp-gateway` |
| Backend port (internal) | `4001` |
| Database | MySQL 8 |
| Frontend | static build, disajikan Nginx (tanpa port sendiri) |
| Process manager | PM2 (`wa-gateway-api`) |

> Catatan: port publik hanya **22 (SSH), 80 (HTTP), 443 (HTTPS)**. Backend `4001`, MySQL `3306`, Redis `6379` hanya lokal.

---

## 0. Prasyarat

- VPS Ubuntu 22.04/24.04, akses root/sudo.
- **A record** `wg` pada domain `aptpairport.id` sudah mengarah ke IP VPS.

Cek DNS:
```bash
dig +short wg.aptpairport.id     # harus tampil IP VPS Anda
```

---

## 1. Paket dasar

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw nginx redis-server mysql-server

# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v        # v22.x

# PM2 global
sudo npm install -g pm2

sudo systemctl enable --now mysql redis-server nginx
```

---

## 2. Database MySQL

```bash
sudo mysql_secure_installation       # set password root, hapus anonymous
sudo mysql
```
```sql
CREATE DATABASE whatsapp_gateway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'wagateway'@'127.0.0.1' IDENTIFIED BY 'PASSWORD_DB_KUAT';
GRANT ALL PRIVILEGES ON whatsapp_gateway.* TO 'wagateway'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

Cek MySQL hanya lokal (aman):
```bash
sudo ss -tulpn | grep :3306      # harus 127.0.0.1:3306
```

---

## 3. Ambil kode

```bash
sudo mkdir -p /var/www/whatsapp-gateway
sudo chown -R $USER:$USER /var/www/whatsapp-gateway
cd /var/www/whatsapp-gateway
git clone <REPO_URL> .            # atau upload manual isi project
```

---

## 4. Konfigurasi `backend/.env`

```bash
cd /var/www/whatsapp-gateway/backend
cp .env.example .env

# Generate 3 secret acak (catat hasilnya):
echo "ACCESS  : $(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
echo "REFRESH : $(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
echo "SESSION : $(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

nano .env
```

Isi nilai berikut:
```ini
NODE_ENV=production
APP_URL=https://wg.aptpairport.id
CORS_ORIGINS=https://wg.aptpairport.id
PORT=4001

DATABASE_URL="mysql://wagateway:PASSWORD_DB_KUAT@127.0.0.1:3306/whatsapp_gateway?connection_limit=10&pool_timeout=20"

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

TRUST_PROXY=1

JWT_ACCESS_SECRET=<hasil ACCESS>
JWT_REFRESH_SECRET=<hasil REFRESH>
SESSION_ENCRYPTION_KEY=<hasil SESSION — 64 hex>

# Ganti password admin awal:
SEED_ADMIN_EMAIL=admin@aptpairport.id
SEED_ADMIN_PASSWORD=GANTI_PASSWORD_ADMIN
```

> ⚠️ **`SESSION_ENCRYPTION_KEY` simpan permanen & backup terpisah.** Kunci ini mengenkripsi sesi WhatsApp di DB. Kalau hilang/berganti, semua device harus scan QR ulang.

---

## 5. Konfigurasi `frontend/.env`

```bash
cd /var/www/whatsapp-gateway/frontend
nano .env
```
```ini
VITE_API_URL=https://wg.aptpairport.id
```
> Frontend memakai alamat **domain** (bukan port). Saat backend di port internal 4001, frontend tetap konek via Nginx — tak perlu tahu portnya.

---

## 6. Install, migrasi, seed, build (otomatis)

```bash
cd /var/www/whatsapp-gateway
chmod +x scripts/*.sh
bash scripts/deploy.sh
```
Script menjalankan: install backend → `prisma generate` → `prisma migrate deploy` → seed admin/roles → build frontend → start PM2.

Cek:
```bash
pm2 status
sudo ss -tulpn | grep :4001
curl -s http://127.0.0.1:4001/health      # OK
```

Auto-start saat reboot:
```bash
pm2 startup systemd      # jalankan perintah sudo yang ditampilkan
pm2 save
```

---

## 7. Nginx reverse proxy

```bash
sudo cp /var/www/whatsapp-gateway/nginx/whatsapp-gateway.conf \
        /etc/nginx/sites-available/whatsapp-gateway

# Ganti domain placeholder -> domain asli
sudo sed -i 's/gateway\.example\.com/wg.aptpairport.id/g' \
        /etc/nginx/sites-available/whatsapp-gateway

# Arahkan upstream ke port backend 4001 & buang node kedua (4002) bila ada
sudo sed -i -E 's/127\.0\.0\.1:(4000|6000)/127.0.0.1:4001/g' \
        /etc/nginx/sites-available/whatsapp-gateway
sudo sed -i '/127\.0\.0\.1:4002/d' \
        /etc/nginx/sites-available/whatsapp-gateway

sudo ln -s /etc/nginx/sites-available/whatsapp-gateway /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Verifikasi isi upstream:
grep -n 'server 127.0.0.1' /etc/nginx/sites-available/whatsapp-gateway

sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. SSL Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d wg.aptpairport.id     # pilih redirect HTTP->HTTPS
sudo certbot renew --dry-run
```

---

## 9. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 10. Verifikasi akhir

```bash
curl -sI https://wg.aptpairport.id/health     # 200
```
Buka **https://wg.aptpairport.id** → login (email/password dari `SEED_ADMIN_*`) → menu **Devices** → **Scan QR** untuk hubungkan nomor WhatsApp.

---

## Operasional

```bash
# Update (backup DB -> git pull -> migrate -> build -> pm2 reload -> cek health)
bash scripts/update.sh
# Opsi: FORCE=1 (bangun ulang tanpa commit baru, mis. setelah ubah .env),
#       NO_PULL=1 (bangun commit yang ter-checkout, untuk rollback), SKIP_BACKUP=1

# Log & monitoring
pm2 logs wa-gateway-api
pm2 monit

# Backup DB (sesi WA ikut, terenkripsi di DB)
bash scripts/backup-db.sh
```

Cron disarankan (`crontab -e`):
```cron
0 2 * * *   /var/www/whatsapp-gateway/scripts/backup-db.sh >> /var/www/whatsapp-gateway/logs/backup.log 2>&1
*/5 * * * * /var/www/whatsapp-gateway/scripts/monitor.sh   >> /var/www/whatsapp-gateway/logs/monitor.log 2>&1
```

---

## Troubleshooting cepat

| Gejala | Solusi |
|--------|--------|
| 502 Bad Gateway | Backend mati / salah port. `pm2 logs wa-gateway-api`; pastikan `PORT` di `.env` = upstream Nginx (`4001`). Setelah ubah `.env`: `pm2 restart wa-gateway-api --update-env`. |
| Login gagal / API error di browser | `frontend/.env` salah. Harus `VITE_API_URL=https://wg.aptpairport.id`, lalu `npm run build`. |
| WebSocket gagal | Pastikan blok `location /socket.io/` ada di config Nginx (bawaan sudah ada). |
| Device stuck di QR | Dashboard > Devices > Scan QR (auto-refresh). |
| Port bentrok | `sudo ss -tulpn \| grep :PORT` untuk cek; pilih port lain yang kosong. |
| Sesi WA hilang setelah restore | `SESSION_ENCRYPTION_KEY` harus sama persis dengan saat backup. |
