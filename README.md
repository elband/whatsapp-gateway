# WhatsApp Gateway Enterprise

Pusat integrasi notifikasi WhatsApp untuk berbagai aplikasi perusahaan (ERP, Helpdesk, Monitoring Jaringan, FIDS, HR, Inventaris, dll) melalui REST API.

Dibangun dengan **Clean Architecture**, modular, reusable, dan siap produksi di **Ubuntu Server 24.04 LTS tanpa Docker**.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Runtime | Node.js 22 LTS |
| Web Framework | Express.js |
| WhatsApp | Baileys (Multi Device) |
| Database | MySQL / MariaDB |
| ORM | Prisma |
| Queue & Cache | Redis + BullMQ |
| Realtime | Socket.IO |
| Auth | JWT + Refresh Token + API Key |
| Frontend | React + Vite + TailwindCSS |
| Process Manager | PM2 + systemd |
| Reverse Proxy | Nginx + Certbot (Let's Encrypt) |
| API Docs | Swagger / OpenAPI |

## Struktur Project

```
/var/www/whatsapp-gateway/
├── backend/        # Express API + Baileys + Queue + Socket.IO
├── frontend/       # React (Vite) + TailwindCSS dashboard
├── uploads/        # File upload media (gambar, pdf, dokumen)
├── sessions/       # Backup sesi Baileys (utama disimpan terenkripsi di DB)
├── logs/           # File log aplikasi (rotasi via logrotate)
├── storage/        # Penyimpanan tambahan / temp
├── scripts/        # Script deploy, backup, restore, monitoring
├── nginx/          # Konfigurasi Nginx reverse proxy
├── systemd/        # Unit file systemd
└── docs/           # Dokumentasi instalasi, deployment, API
```

## Quick Start (Development)

```bash
# Backend
cd backend
cp .env.example .env          # sesuaikan kredensial
npm install
npx prisma migrate dev        # buat tabel
npm run seed                  # buat admin default + roles/permissions
npm run dev

# Frontend (terminal lain)
cd frontend
cp .env.example .env
npm install
npm run dev
```

Admin default: `admin@example.com` / `Admin@12345` (ganti segera setelah login).

### Testing & CI

```bash
cd backend && npm test        # unit test (Vitest) — fungsi murni, tanpa DB/Redis
```
Pipeline CI (GitHub Actions) di [.github/workflows/ci.yml](.github/workflows/ci.yml): backend (prisma validate + test), frontend (build), security (npm audit + gitleaks).

API docs (Swagger): `http://localhost:4000/api/docs`

## Deployment Produksi

Lihat panduan lengkap di [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — mencakup instalasi Ubuntu, Node 22, MySQL/MariaDB, Redis, Nginx, PM2, systemd, UFW, SSL Let's Encrypt, backup/restore, rotasi log, monitoring, dan update tanpa downtime.

## Dokumentasi

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Panduan deployment Ubuntu Server lengkap
- [docs/API.md](docs/API.md) — Referensi REST API & contoh integrasi (Laravel, PHP, Next.js)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Arsitektur & alur sistem
- [docs/SCALE-OUT-H5.md](docs/SCALE-OUT-H5.md) — Desain scale-out (device-sharding) untuk skala ribuan device
- [docs/SECURITY.md](docs/SECURITY.md) — Catatan keamanan
- Swagger/OpenAPI interaktif: `/api/docs`

## Lisensi

Internal / Enterprise.
