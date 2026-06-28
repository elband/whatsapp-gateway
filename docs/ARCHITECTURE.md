# Arsitektur Sistem

## Gambaran Umum

```
                         ┌─────────────────────────────────────────────┐
   Aplikasi Enterprise   │                 NGINX (443/SSL)              │
   (ERP, Helpdesk, FIDS, │   ┌──────────────┬───────────────┬────────┐ │
    HR, Monitoring, dll)─┼──▶│  /api  proxy │ /socket.io ws │ static │ │
                         │   └──────┬───────┴───────┬───────┴───┬────┘ │
                         └──────────┼───────────────┼───────────┼──────┘
                                    ▼               ▼           ▼
                          ┌──────────────────┐  ┌────────┐  ┌────────────┐
                          │  Express API     │  │Socket. │  │ React SPA  │
                          │  (JWT + API Key) │  │  IO    │  │ (Vite dist)│
                          └───┬─────────┬────┘  └────────┘  └────────────┘
                              │         │
                 ┌────────────┘         └──────────────┐
                 ▼                                      ▼
        ┌─────────────────┐                   ┌──────────────────┐
        │ BaileysManager  │  ── creds/keys ─▶ │  MySQL/MariaDB    │
        │ (multi-device)  │   (terenkripsi)   │  (Prisma ORM)    │
        └───────┬─────────┘                   └──────────────────┘
                │ enqueue / consume
                ▼
        ┌─────────────────┐        ┌──────────────────┐
        │ BullMQ Worker   │ ◀────▶ │      Redis       │
        │ (in-process)    │  queue │ (queue + cache)  │
        └─────────────────┘        └──────────────────┘
```

## Lapisan (Clean Architecture)

```
backend/src/
├── config/        # env, prisma, redis, logger, swagger  (infrastruktur)
├── utils/         # ApiError, jwt, crypto, password, phone, response (murni)
├── middlewares/   # auth, apiKey, rbac, rateLimiter, validate, audit, upload, error
├── services/      # logService, webhookService, messageBuilder, scheduler (lintas-modul)
├── whatsapp/      # BaileysManager + useDbAuthState (integrasi WA)
├── queue/         # messageQueue (producer) + worker (consumer)
├── socket/        # gateway realtime
├── modules/<fitur>/   # tiap fitur: routes -> controller -> service (-> prisma)
│     ├── *.routes.js       (HTTP + OpenAPI + guard permission)
│     ├── *.controller.js   (adaptor HTTP, format respons)
│     ├── *.service.js      (logika bisnis, akses DB)
│     └── *.validation.js   (skema Joi)
├── routes/index.js   # komposisi seluruh modul
├── app.js            # rakit Express (middleware global)
└── server.js         # bootstrap: DB, socket, worker, scheduler, restore sesi
```

Aturan ketergantungan: `routes → controller → service → prisma`. Controller tidak mengakses DB langsung; service tidak tahu detail HTTP. Hal lintas-modul (log, webhook, queue) berada di `services/` dan `queue/`.

## Alur Kirim Pesan
1. Client `POST /messages/send` (JWT/API Key) → controller → `message.service` membuat record `Message` (status `QUEUED`) → `enqueueSingle()` ke BullMQ.
2. Worker mengambil job → `BaileysManager.sendMessage()` ke socket device → update status `SENT` → emit Socket.IO + webhook `message.outgoing`.
3. Update pengiriman/baca dari WA (`messages.update`) → status `DELIVERED`/`READ` → emit + webhook.

## Alur Broadcast
1. `POST /broadcasts` membuat `Broadcast` + banyak `BroadcastItem`.
2. `start()` memasukkan tiap item ke queue dengan **jeda acak kumulatif** (anti-banned).
3. Worker memproses item, menghormati status (`PAUSED` → tunda, `CANCELLED` → lewati), render variabel template, kirim, update progress → emit `broadcast:progress`.
4. Penjadwalan: broadcast `SCHEDULED` dijalankan oleh `scheduler` (node-cron) saat waktunya tiba.

## Multi-Device & Pemulihan Sesi
- Setiap device = satu koneksi Baileys yang dikelola `BaileysManager` (Map in-memory).
- Auth-state (creds + signal keys) disimpan **terenkripsi AES-256-GCM** di tabel `sessions` melalui `useDbAuthState`.
- Saat server start, `restoreAll()` memulihkan semua device yang sebelumnya aktif — **tanpa scan ulang QR**.
- `connection.update === 'close'` (bukan logout) memicu **auto-reconnect** dengan backoff.

## Realtime
Socket.IO mengirim event: `device:status`, `device:qr`, `message:incoming`, `message:status`, `broadcast:progress`, `broadcast:status`, `broadcast:completed`. Dashboard subscribe untuk update langsung.

## Mengapa worker in-process?
Koneksi Baileys hidup di memori proses pembuatnya. Worker yang mengirim pesan harus berbagi memori tersebut, sehingga worker dijalankan **dalam proses backend yang sama** (bukan proses terpisah). Redis tetap dipakai sebagai antrean/persistensi job agar tahan restart.
