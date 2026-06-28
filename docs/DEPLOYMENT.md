# Panduan Deployment — Ubuntu Server 24.04 LTS (tanpa Docker)

Panduan ini menginstal WhatsApp Gateway Enterprise di server produksi: Node.js 22, MySQL/MariaDB, Redis, Nginx, PM2/systemd, UFW, dan SSL Let's Encrypt.

Asumsi:
- Domain: `gateway.example.com` (arahkan A record ke IP server)
- Lokasi aplikasi: `/var/www/whatsapp-gateway`
- User layanan: `wagateway`

---

## 1. Persiapan Server & User

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw

# Buat user layanan tanpa login shell interaktif penuh (boleh juga pakai user biasa)
sudo adduser --system --group --home /var/www/whatsapp-gateway wagateway || true
sudo mkdir -p /var/www/whatsapp-gateway
sudo chown -R wagateway:wagateway /var/www/whatsapp-gateway
```

## 2. Install Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # harus v22.x
npm -v
```

## 3. Install MariaDB (atau MySQL)

```bash
sudo apt install -y mariadb-server
sudo systemctl enable --now mariadb
sudo mysql_secure_installation     # set root password, hapus anonymous, dll
```

Buat database & user:

```bash
sudo mysql -u root -p
```
```sql
CREATE DATABASE whatsapp_gateway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'wagateway'@'127.0.0.1' IDENTIFIED BY 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON whatsapp_gateway.* TO 'wagateway'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

## 4. Install Redis (queue + cache)

```bash
sudo apt install -y redis-server
sudo sed -i 's/^# *requirepass .*/requirepass GANTI_REDIS_PASSWORD/' /etc/redis/redis.conf   # opsional
sudo systemctl enable --now redis-server
redis-cli ping   # PONG
```

## 5. Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

## 6. Install PM2 (global)

```bash
sudo npm install -g pm2
pm2 -v
```

## 7. Ambil Kode & Konfigurasi

```bash
sudo -u wagateway -H bash
cd /var/www/whatsapp-gateway
git clone <REPO_URL> .       # atau upload manual isi project ke folder ini

# Backend env
cd backend
cp .env.example .env
nano .env
```

Isi `.env` minimal:
- `DATABASE_URL="mysql://wagateway:GANTI_PASSWORD_KUAT@127.0.0.1:3306/whatsapp_gateway"`
- `REDIS_PASSWORD=GANTI_REDIS_PASSWORD` (jika diaktifkan)
- `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET` — string acak panjang
- `SESSION_ENCRYPTION_KEY` — generate:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `APP_URL=https://gateway.example.com`
- `CORS_ORIGINS=https://gateway.example.com`

Frontend env:
```bash
cd ../frontend
cp .env.example .env
# VITE_API_URL=https://gateway.example.com
```

## 8. Install Dependency, Migrasi DB, Build

Cara cepat memakai script:
```bash
cd /var/www/whatsapp-gateway
chmod +x scripts/*.sh
bash scripts/deploy.sh
```

Atau manual:
```bash
# Backend
cd backend
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy     # buat semua tabel
node prisma/seed.js           # admin default + roles + permissions

# Frontend
cd ../frontend
npm ci
npm run build                 # output ke frontend/dist
```

## 9. Menjalankan Backend dengan PM2

```bash
cd /var/www/whatsapp-gateway
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs wa-gateway-api
```

### Auto-start saat reboot (PM2)
```bash
pm2 startup systemd -u wagateway --hp /var/www/whatsapp-gateway
# jalankan perintah sudo yang ditampilkan, lalu:
pm2 save
```

### Alternatif: systemd langsung (tanpa PM2)
Jangan jalankan bersamaan dengan PM2.
```bash
sudo cp systemd/whatsapp-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now whatsapp-gateway
sudo systemctl status whatsapp-gateway
```

## 10. Konfigurasi Nginx Reverse Proxy

```bash
sudo cp nginx/whatsapp-gateway.conf /etc/nginx/sites-available/whatsapp-gateway
# Ganti server_name & path domain di file tsb
sudo ln -s /etc/nginx/sites-available/whatsapp-gateway /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 11. SSL Let's Encrypt (Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d gateway.example.com
# pilih redirect HTTP->HTTPS. Auto-renew sudah aktif via systemd timer:
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

## 12. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'      # 80 + 443
sudo ufw enable
sudo ufw status
```
> Port 4000 (backend) & 3306 (DB) & 6379 (Redis) TIDAK dibuka ke publik — hanya diakses lokal/melalui Nginx.

---

## 13. Backup & Restore

```bash
# Backup database (jadwalkan via cron)
bash scripts/backup-db.sh

# Backup khusus sesi WhatsApp + uploads
bash scripts/backup-sessions.sh

# Restore database
bash scripts/restore-db.sh /var/www/whatsapp-gateway/storage/backups/db/whatsapp_gateway_YYYYMMDD_HHMMSS.sql.gz
```

> **Sesi WhatsApp disimpan terenkripsi (AES-256-GCM) di tabel `sessions`.** Backup database = backup sesi. Setelah restore DB + `SESSION_ENCRYPTION_KEY` yang sama, device akan auto-reconnect tanpa scan ulang QR.

Contoh cron (`sudo -u wagateway crontab -e`):
```cron
0 2 * * *  /var/www/whatsapp-gateway/scripts/backup-db.sh >> /var/www/whatsapp-gateway/logs/backup.log 2>&1
30 2 * * * /var/www/whatsapp-gateway/scripts/backup-sessions.sh >> /var/www/whatsapp-gateway/logs/backup.log 2>&1
*/5 * * * * /var/www/whatsapp-gateway/scripts/monitor.sh >> /var/www/whatsapp-gateway/logs/monitor.log 2>&1
```

## 14. Rotasi Log

```bash
sudo cp scripts/logrotate-whatsapp-gateway /etc/logrotate.d/whatsapp-gateway
sudo logrotate -d /etc/logrotate.d/whatsapp-gateway   # uji (dry-run)
```
PM2 juga dapat memakai `pm2 install pm2-logrotate`.

## 15. Monitoring Service

```bash
pm2 status && pm2 monit                 # PM2
systemctl status whatsapp-gateway       # systemd
curl -s http://127.0.0.1:4000/health    # health check
sudo journalctl -u nginx -f             # log nginx
```
Dashboard aplikasi juga menampilkan CPU/RAM/Disk, status device, queue, dan aktivitas real-time.

## 16. Update Aplikasi Tanpa Downtime

```bash
bash scripts/update.sh
# Internal: git pull -> npm ci -> prisma migrate deploy -> build frontend -> pm2 reload
```
`pm2 reload` melakukan restart anggun (graceful); sesi WhatsApp dipulihkan otomatis dari DB saat proses baru naik.

---

## Troubleshooting

| Gejala | Solusi |
|--------|--------|
| Device stuck di `QR` | Buka dashboard > Devices > Scan QR. QR auto-refresh. |
| `SESSION_ENCRYPTION_KEY harus 64 hex` | Generate key 32-byte hex, isi di `.env`. |
| Pesan tidak terkirim | Pastikan device `CONNECTED` & Redis aktif (`redis-cli ping`). |
| 502 Bad Gateway | Backend mati — `pm2 logs` / `journalctl -u whatsapp-gateway`. |
| WebSocket gagal | Pastikan blok `location /socket.io/` di Nginx ada (lihat config). |
| Migrasi gagal | Cek `DATABASE_URL` & hak akses user MySQL. |
