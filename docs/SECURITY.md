# Catatan Keamanan

Ringkasan kontrol keamanan yang diterapkan dan rekomendasi operasional.

## Hardening dari Audit (Remediasi)

Kontrol berikut ditambahkan setelah audit keamanan:

| Kode | Kontrol |
|------|---------|
| C1 | Guard produksi `env.js`: tolak boot bila secret lemah/placeholder, JWT access=refresh, atau `SESSION_ENCRYPTION_KEY` bukan 64-hex. `.env.production.example` hanya berisi placeholder. |
| C2 | `/uploads` wajib autentikasi (`mediaAuth`) — token via header/query/cookie. |
| H1 | CORS fail-closed: produksi wajib `CORS_ORIGINS`, tidak ada `*`/reflect dengan credentials (Express & Socket.IO). |
| H2 | Proteksi SSRF (`utils/ssrfGuard.js`): blok IP privat/loopback/link-local/metadata pada webhook dispatch & test. |
| H3 | Token tidak disimpan di `localStorage`; access token in-memory, refresh hanya httpOnly cookie + bootstrap refresh saat reload. |
| H4 | API Key: `requireScope` + `enforceApiKeyDevice` (pin ke device milik key) pada endpoint kirim & OTP. |
| H6 | Content-Security-Policy ketat global; relaks hanya pada `/api/docs`. |
| M1 | Audit log dibatch (`createMany`) untuk mengurangi write amplification. |
| M2 | Kuota device atomik (transaksi + `updateMany` ber-kondisi). |
| M3 | Index `(deviceId, from)` & `(deviceId, to)` untuk query inbox. |
| M4 | Health-check mendalam (`/health` cek DB + Redis, 503 bila degraded). |
| M10 | Guard ReDoS pada regex autoresponder (batas panjang pola & input). |
| M11 | OTP disimpan sebagai hash (terikat nomor) + cooldown 60 dtk per nomor. |


## Diterapkan di Aplikasi

| Aspek | Implementasi |
|-------|--------------|
| **HTTPS** | Diterminasi di Nginx (Let's Encrypt). HSTS aktif. Backend hanya diakses lokal (127.0.0.1:4000). |
| **Helmet** | Header keamanan HTTP (`X-Content-Type-Options`, `X-Frame-Options`, dll) via `helmet`. |
| **CORS** | Dibatasi ke origin pada `CORS_ORIGINS`, `credentials: true`. |
| **Rate Limiting** | Global limiter + limiter khusus login (anti brute-force), disimpan di Redis. Bisa per-API-Key. |
| **JWT** | Access token pendek (15m) + refresh token (7d) dengan **rotasi** & penyimpanan hash di DB (dapat dicabut). |
| **API Key** | Per aplikasi, format `wag_<prefix>.<secret>`. Hanya **hash SHA-256** yang disimpan; plaintext ditampilkan sekali. Bisa scope, expiry, rate limit, & device default. |
| **RBAC** | Role + Permission granular (`group.action`). Endpoint admin dijaga `requirePermission`. |
| **Validasi Input** | Skema Joi pada body/query/params; `stripUnknown` aktif. |
| **Audit Log** | Semua aksi mengubah data (non-GET) & login dicatat ke tabel `logs` (user, IP, UA). |
| **Enkripsi Sesi** | Auth-state Baileys dienkripsi **AES-256-GCM** sebelum disimpan ke DB (`SESSION_ENCRYPTION_KEY`). |
| **Proteksi Endpoint Admin** | Wajib JWT + permission; tidak bisa diakses via API Key. |
| **Password** | Hash `bcrypt` (cost 12). |
| **Upload** | Batas ukuran (`MAX_UPLOAD_MB`), nama file di-sanitasi, disimpan di luar webroot statis backend. |

## Rekomendasi Operasional

1. **Ganti semua secret default** di `.env`: `JWT_*_SECRET`, `SESSION_ENCRYPTION_KEY`, password DB/Redis, password admin.
2. **Simpan `.env` dengan permission ketat**: `chmod 600 backend/.env`.
3. **Jangan buka port** 4000/3306/6379 ke publik (UFW hanya izinkan 80/443/SSH).
4. **Backup `SESSION_ENCRYPTION_KEY`** secara aman — tanpa key ini, sesi terenkripsi tidak bisa dipulihkan.
5. **Aktifkan password Redis** (`requirepass`) bila Redis bisa diakses dari luar localhost.
6. **Rotasi API Key** berkala lewat dashboard (fitur regenerate).
7. **Pantau audit log** & aktifkan rotasi log (logrotate).
8. **Update dependency** rutin (`npm audit`), dan OS (`apt upgrade`).
9. **Batasi user MySQL** hanya ke database aplikasi (sudah pada panduan deployment).
10. **Verifikasi webhook** di sisi penerima (mis. IP allowlist / shared secret) bila perlu.

## Model Ancaman Singkat
- **Kebocoran API Key** → dampak terbatas oleh scope + device default + rate limit; segera regenerate.
- **Pencurian refresh token** → dapat dicabut (revoke) per sesi; rotasi otomatis mendeteksi penggunaan ganda.
- **Akses DB** → sesi WA tetap terenkripsi tanpa `SESSION_ENCRYPTION_KEY`.
