# H5 — Desain Scale-Out (Device Sharding)

Status: **DESAIN + SCAFFOLD**. Aplikasi saat ini berjalan mode `all` (single-process) dan **tetap kompatibel**. Dokumen ini menjelaskan cara menaikkan kapasitas dari ~ratusan ke ribuan device.

---

## 1. Masalah inti

Koneksi Baileys bersifat **stateful & in-memory** — socket WhatsApp hidup di memori proses pembuatnya. Akibatnya pada desain awal:
- Worker pengirim **harus se-proses** dengan socket → tidak bisa proses terpisah.
- Backend dijalankan **single instance** (`instances: 1`) → tidak ada horizontal scaling & tidak ada HA.
- Plafon ~500 device per proses (RAM + event-loop).

**Solusi:** pisahkan sistem jadi dua tier dengan **device-sharding**.

---

## 2. Arsitektur target

Lihat diagram "arsitektur scale-out device-sharding".

| Tier | Sifat | Tugas |
|------|-------|-------|
| **API tier** | Stateless, N replika, auto-scale | HTTP REST, Socket.IO, auth, validasi, DB read/write. **Tidak** memegang socket WA. Saat butuh aksi device → kirim **command** ke shard pemilik. |
| **WA-worker tier** | Stateful, ber-shard (1 proses = 1 shard) | Memegang socket Baileys untuk subset device, memproses queue kirim, menjalankan autoresponder, mem-publish event. |
| **Redis** | Shared | Command bus (request/reply), pub/sub event, Socket.IO adapter, BullMQ. |
| **MySQL** | Shared (+ read replica) | Sumber kebenaran data; sesi Baileys terenkripsi. |

---

## 3. Pemetaan device → shard

Scaffold: `src/cluster/deviceRouter.js`
- **Default (stateless):** `shardOf(deviceId) = deviceId % SHARD_COUNT`. Sederhana, tanpa state.
- **Upgrade (sticky):** tambah kolom `Device.shardId Int?`. Coordinator menetapkan shard saat device dibuat & saat rebalancing, sehingga mengubah `SHARD_COUNT` tidak mereshuffle semua device. `shardOf` membaca dari DB bila ada.

Migrasi sticky (jalankan saat aktivasi H5):
```sql
ALTER TABLE `devices` ADD COLUMN `shardId` INTEGER NULL;
CREATE INDEX `devices_shardId_idx` ON `devices`(`shardId`);
```

---

## 4. Alur perintah (API → worker, request/reply)

Scaffold: `src/cluster/commandBus.js`
1. API memanggil `sendCommand(deviceId, 'connect'|'logout'|'restart'|'qr'|'checkNumber', payload)`.
2. Bus publish ke channel `wa:cmd:<shard>` dengan `correlationId` + `reply` channel.
3. WA-worker pemilik (`serveCommands`) eksekusi via `BaileysManager`, balas ke `wa:reply:<id>`.
4. API resolve Promise (timeout 15 dtk → error).

> Modul `devices` saat ini memanggil `baileysManager.*` langsung. Saat `clusterEnabled`, ganti ke `sendCommand(...)`.

---

## 5. Alur kirim pesan (per shard)

- Tiap shard punya queue BullMQ sendiri: `wa-messages-<shard>` (atau filter job per-shard).
- API/produser meng-enqueue ke queue shard pemilik device (`shardOf`).
- Worker shard mengonsumsi & mengirim via socket lokalnya.
- Keuntungan: throughput linier terhadap jumlah shard; isolasi kegagalan.

---

## 6. Alur event realtime (worker → semua API node)

Scaffold: `src/cluster/eventBus.js` + `src/cluster/socketAdapter.js`
1. WA-worker mem-`publishEvent('message:incoming'|'device:status'|'device:qr'|..., data)` ke `wa:events`.
2. Tiap API node `subscribeEvents((event,data)=> io.emit(event,data))`.
3. **Socket.IO Redis adapter** (`@socket.io/redis-adapter`) memastikan emit menjangkau klien yang terhubung ke API node mana pun.

> **Perubahan wiring kunci:** di mode worker, `BaileysManager` harus memancarkan event lewat `publishEvent` (bukan `socket.emit` langsung). Cukud satu titik indireksi (mis. `realtime/emit.js`) yang: di mode `all`→socket lokal, di mode `worker`→eventBus.

---

## 7. Failover & rebalancing

- **Heartbeat:** tiap worker `SET wa:shard:<id>:alive <pid> EX 15` tiap 5 dtk.
- **Deteksi mati:** coordinator (atau API leader via lock) memantau key heartbeat. Jika hilang → tandai shard down.
- **Rebalancing (sticky mode):** device dari shard mati di-reassign ke shard sehat (update `shardId`), worth penerima memanggil `startDevice` → Baileys auto-restore dari sesi terenkripsi di DB (**tanpa scan QR ulang**).
- **Graceful:** worker `SIGTERM` → berhenti menerima command, selesaikan in-flight, lepas heartbeat.

---

## 8. Perubahan wiring yang diperlukan (saat aktivasi)

| File | Perubahan |
|------|-----------|
| `whatsapp/BaileysManager.js` | Emit event via indireksi `realtime/emit.js` (worker→eventBus, all→socket) |
| `modules/devices/device.service.js` | Bila `clusterEnabled`, panggil `commandBus.sendCommand` alih-alih `baileysManager.*` |
| `queue/index.js` & `worker.js` | Queue per-shard (`wa-messages-<shard>`); produser pilih queue via `shardOf` |
| `socket/index.js` | Panggil `attachRedisAdapter(io)` saat `clusterEnabled` |
| `server.js` | Mode `api`: `subscribeEvents(...)` + jangan `restoreAll`. Mode `worker`: pakai `entrypoints/worker-wa.js` |

Semua dijaga **backward-compatible**: default `CLUSTER_ROLE=all` = perilaku sekarang.

---

## 9. Matriks ENV & cara menjalankan

| ENV | api | worker | all |
|-----|:--:|:--:|:--:|
| `CLUSTER_ROLE` | `api` | `worker` | `all` |
| `SHARD_COUNT` | N | N | 1 |
| `SHARD_ID` | — | 0..N-1 | 0 |

Contoh PM2 (4 shard + 2 API):
```js
// ecosystem.cluster.cjs
module.exports = { apps: [
  { name:'wa-api-1', script:'src/server.js', env:{ CLUSTER_ROLE:'api', SHARD_COUNT:4, PORT:4001 } },
  { name:'wa-api-2', script:'src/server.js', env:{ CLUSTER_ROLE:'api', SHARD_COUNT:4, PORT:4002 } },
  { name:'wa-sh-0', script:'src/entrypoints/worker-wa.js', env:{ CLUSTER_ROLE:'worker', SHARD_COUNT:4, SHARD_ID:0 } },
  { name:'wa-sh-1', script:'src/entrypoints/worker-wa.js', env:{ CLUSTER_ROLE:'worker', SHARD_COUNT:4, SHARD_ID:1 } },
  { name:'wa-sh-2', script:'src/entrypoints/worker-wa.js', env:{ CLUSTER_ROLE:'worker', SHARD_COUNT:4, SHARD_ID:2 } },
  { name:'wa-sh-3', script:'src/entrypoints/worker-wa.js', env:{ CLUSTER_ROLE:'worker', SHARD_COUNT:4, SHARD_ID:3 } },
]};
```
Nginx mem-balance ke `wa-api-*` (sticky session tidak perlu karena Socket.IO pakai Redis adapter).

---

## 10. Kapasitas & target

| Device | Saran shard | Catatan |
|--------|:-----------:|---------|
| 100 | mode `all` | cukup 1 proses |
| 500 | 2–3 shard | + index inbox, audit-log async (sudah ada) |
| 1.000 | 4–6 shard | API 2 node, DB read-replica |
| 5.000 | 16–24 shard | Redis Cluster, partisi `messages`, object storage media, observability penuh |

Rule of thumb: **~250–350 device aktif per shard** (RAM ~6–10 GB/shard) sebagai titik aman.

---

## 11. Fase migrasi (incremental, zero big-bang)

1. **F0 (sekarang):** mode `all`. Tidak ada perubahan.
2. **F1:** tambah indireksi emit + `attachRedisAdapter` (tetap `all`). Tidak ada dampak fungsional.
3. **F2:** pisah 1 API + 1 worker (SHARD_COUNT=1). Validasi command bus & event bus.
4. **F3:** naikkan SHARD_COUNT, tambah kolom `shardId` sticky + coordinator rebalancing.
5. **F4:** skala API & shard sesuai beban; tambah read-replica & partisi.

---

## 12. Risiko & mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Split-brain (2 worker pegang device sama) | Lock kepemilikan device di Redis (`SET wa:own:<deviceId> <shard> NX`) sebelum `startDevice` |
| Rebalancing storm saat node mati | Reassign bertahap + backoff; batasi reconnect paralel |
| Command timeout saat worker sibuk | Naikkan timeout untuk aksi berat; prioritaskan command via channel terpisah |
| Re-auth WhatsApp saat pindah shard | Tidak terjadi — sesi terenkripsi di DB → auto-restore |
| Konsistensi kuota lintas-proses | Sudah atomic via `updateMany` ber-kondisi (M2) |

---

## 13. Checklist aktivasi
- [x] **F1** Tambah `realtime/emit.js` indireksi & ganti `socket.emit` di BaileysManager
- [x] **F1** `@socket.io/redis-adapter` + `attachRedisAdapter`
- [x] **F2** Route `device.service`/`message.service` ke `commandBus` saat `clusterEnabled`
- [x] **F2** Pisah proses API (`server.js` role-aware) + WA-worker (`entrypoints/worker-wa.js`)
- [x] **F3** Queue per-shard (`wa-messages-<shard>`)
- [x] **F3** Kolom `Device.shardId` (sticky assignment, balanced)
- [x] **F3** Lock kepemilikan device `wa:own:<id>` (anti split-brain) + heartbeat `wa:worker:<n>`
- [x] **F3+** Coordinator rebalancing otomatis saat worker mati (reassign shardId, leader-elected) — `cluster/coordinator.js`
- [x] **F4** Nginx upstream multi-API (`upstream wa_api`, least_conn, sticky tak perlu karena Redis adapter)
- [x] **F4** DB read-replica opt-in (`DATABASE_REPLICA_URL` + `@prisma/extension-read-replicas`)
- [x] **F4** Panduan partisi `messages` (`scripts/partition-messages.sql`) + load test (`scripts/loadtest.k6.js`)
- [ ] Eksekusi load test 500 → 1.000 device di staging (ops)

> Status: **F1–F4 terimplementasi**. F1–F3+ tervalidasi runtime (1 API + 2 worker, failover otomatis terbukti). F4 = lapisan infrastruktur: multi-API behind Nginx, read-replica, partisi, load test — siap dipakai, eksekusi load test sesungguhnya di staging.

## F4 — Catatan operasional

**Multi-API:** jalankan beberapa proses API pada port berbeda, semua `CLUSTER_ROLE=api`:
```bash
CLUSTER_ROLE=api SHARD_COUNT=N PORT=4000 pm2 start backend/src/server.js --name wa-api-1
CLUSTER_ROLE=api SHARD_COUNT=N PORT=4002 pm2 start backend/src/server.js --name wa-api-2
```
Nginx `upstream wa_api { server 127.0.0.1:4000; server 127.0.0.1:4002; }`. Socket.IO Redis adapter → klien di node mana pun menerima event; coordinator leader-elected → hanya satu yang menjalankan rebalancing.

**Read-replica:** set `DATABASE_REPLICA_URL` (boleh banyak, koma). Baca otomatis ke replica, tulis ke primary. Tanpa env ini → single DB (tidak berubah).

**Partisi messages:** lihat `scripts/partition-messages.sql` (manual/DBA; di luar `prisma migrate`).

**Load test:** `k6 run -e BASE_URL=... -e API_KEY=... scripts/loadtest.k6.js`.

> Scaffold tersedia di `backend/src/cluster/` dan `backend/src/entrypoints/worker-wa.js`. Semuanya sudah lolos syntax-check namun **belum di-wire** ke jalur produksi (tanpa regresi).
