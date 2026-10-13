# Referensi REST API & Integrasi

Base URL produksi: `https://gateway.example.com/api/v1`
Dokumentasi interaktif (Swagger/OpenAPI): `https://gateway.example.com/api/docs`

## Autentikasi

Ada dua cara:

1. **JWT (dashboard / admin)** — login untuk dapat `accessToken`, kirim di header:
   `Authorization: Bearer <accessToken>`
2. **API Key (integrasi aplikasi: ERP, Helpdesk, Monitoring, dll)** — kirim di header:
   `X-API-Key: wag_xxxxx.yyyyyyyy`

Endpoint pengiriman pesan (`/messages/*`) menerima **kedua** metode. Endpoint manajemen (devices, users, dll) memakai JWT.

Format respons konsisten:
```json
{ "success": true, "message": "OK", "data": { }, "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 } }
```

---

## Endpoint Utama

### Auth
| Method | Path | Body |
|--------|------|------|
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/refresh` | `{ refreshToken }` (atau cookie) |
| POST | `/auth/logout` | — |
| GET | `/auth/me` | (Bearer) |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` |

### Device
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/devices` | daftar device + status |
| POST | `/devices` | `{ name, groupId?, webhookUrl?, webhookEvents?, autoReconnect? }` |
| GET | `/devices/:id/qr` | ambil QR untuk scan |
| POST | `/devices/:id/connect` | mulai koneksi |
| POST | `/devices/:id/restart` | restart koneksi |
| POST | `/devices/:id/logout` | logout device |
| DELETE | `/devices/:id` | hapus device |

### Kirim Pesan
| Method | Path | Body |
|--------|------|------|
| POST | `/messages/send` | `{ deviceId, to, body }` |
| POST | `/messages/send-media` | multipart: `file`, `to`, `type` (IMAGE/VIDEO/AUDIO/DOCUMENT), `caption`, `deviceId` |
| POST | `/messages/send-location` | `{ deviceId, to, latitude, longitude, name?, address? }` |
| POST | `/messages/send-contact` | `{ deviceId, to, contactName, contactPhone }` |
| GET | `/messages` | filter: `deviceId, direction, status, type, search, from, to` |
| POST | `/messages/:id/resend` | kirim ulang |

> `deviceId` opsional jika API Key punya `defaultDeviceId`.

### Pesan Tombol & List (interaktif)
| Method | Path | Body |
|--------|------|------|
| POST | `/messages/send-buttons` | `{ deviceId?, to, body, footer?, buttons:[{ id?, text }] }` (1–3 tombol) |
| POST | `/messages/send-list` | `{ deviceId?, to, body, footer?, title?, buttonText?, sections:[{ title?, rows:[{ id?, title, description? }] }] }` |

> Catatan: dukungan tombol/list interaktif WhatsApp kini terbatas tergantung versi & jenis akun.

### Cek Nomor WhatsApp
| Method | Path | Body |
|--------|------|------|
| POST | `/messages/check` | `{ deviceId?, numbers: ["08123...","0852..."] }` → `data: [{ input, phone, exists, jid?, error? }]` |

> Device harus berstatus `CONNECTED`.

### OTP (dapat diakses JWT atau API Key)
| Method | Path | Body |
|--------|------|------|
| POST | `/otp/send` | `{ deviceId?, to, length?(4-8), expiresMinutes?(1-60), purpose?, template? }` → `data: { otpId, to, expiresAt }` |
| POST | `/otp/verify` | `{ to, code, purpose? }` → `data: { valid, reason? }` |

> Template OTP mendukung variabel `{{code}}` dan `{{minutes}}`. Default: "Kode OTP Anda: {{code}}. Berlaku {{minutes}} menit.".

### Autoresponder (auto-reply keyword)
| Method | Path | Body |
|--------|------|------|
| GET | `/autoresponders` | filter `?search&deviceId&page&limit` |
| POST | `/autoresponders` | `{ name, deviceId?(null=semua device), keyword, matchType, response, templateId?, priority?, isActive? }` |
| PUT/DELETE | `/autoresponders/:id` | ubah / hapus |

`matchType`: `EXACT` \| `CONTAINS` \| `STARTS_WITH` \| `REGEX`. `response` mendukung `{{nama}}`, `{{nomor}}`. Auto-reply terkirim otomatis saat ada pesan masuk yang cocok. `response` kosong (`""`) pada aturan `MESSAGE` = pengecualian: pesan yang cocok tidak dibalas sama sekali (beri `priority` tinggi).

`triggerType` (opsional, default `MESSAGE`): `MESSAGE` = pesan masuk yang cocok `keyword`; `MISSED_CALL` = panggilan WhatsApp (suara/video, bukan grup) yang tidak terangkat — `keyword`/`matchType` diabaikan dan boleh kosong. Aturan `MISSED_CALL` berlaku di semua mode auto-balas device kecuali `OFF`, dan dibatasi jeda `noticeCooldownMinutes` per penelepon. Filter daftar: `?triggerType=MISSED_CALL`.

### Inbox / Chat
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/chats?deviceId=` | daftar percakapan + jumlah belum dibaca |
| GET | `/chats/:phone?deviceId=` | thread pesan dengan satu nomor |
| POST | `/chats/:phone/seen` | `{ deviceId }` tandai sudah dibaca |
| POST | `/chats/:phone/reply` | `{ deviceId, body }` balas pesan |

### Kuota Device
Atur batas pesan keluar per device via `PUT /devices/:id` → `{ quota }` (0 = tanpa batas). Field `quotaUsed` bertambah tiap pesan keluar; jika `quotaUsed >= quota` API menolak dengan `403`.

### Broadcast
`POST /broadcasts` — `{ name, deviceId, messageType, body, templateId?, recipients?[], contactGroupId?, contactIds?[], minDelayMs?, maxDelayMs?, scheduledAt? }`
Kontrol: `POST /broadcasts/:id/{pause,resume,cancel,retry}`

### Lainnya
Contacts `/contacts`, Templates `/templates`, Autoresponder `/autoresponders`, OTP `/otp`, Inbox/Chat `/chats`, Webhooks `/webhooks`, Logs `/logs`, Monitoring `/monitoring/{dashboard,system,activity,chart}`, Users `/users`, Roles `/roles`, API Keys `/api-keys`, Settings `/settings`.

---

## Webhook (event masuk ke aplikasi Anda)

Set `webhookUrl` pada device. Gateway akan `POST` JSON ke URL tersebut:
```json
{
  "event": "message.incoming",
  "deviceId": "abc123",
  "device": { "id": 1, "name": "CS-1", "phoneNumber": "628..." },
  "timestamp": "2026-06-28T10:00:00.000Z",
  "data": { "from": "628123456789", "pushName": "Budi", "body": "Halo", "messageId": "..." }
}
```
Event yang tersedia: `message.incoming`, `message.outgoing`, `message.delivered`, `message.read`, `device.connected`, `device.disconnected`, `qr.updated`, `broadcast.completed`.

---

## Contoh Integrasi

### cURL — kirim teks
```bash
curl -X POST https://gateway.example.com/api/v1/messages/send \
  -H "X-API-Key: wag_xxxx.yyyy" \
  -H "Content-Type: application/json" \
  -d '{ "deviceId": 1, "to": "08123456789", "body": "Halo dari Gateway" }'
```

### cURL — kirim PDF/dokumen
```bash
curl -X POST https://gateway.example.com/api/v1/messages/send-media \
  -H "X-API-Key: wag_xxxx.yyyy" \
  -F "to=08123456789" -F "type=DOCUMENT" -F "caption=Invoice" \
  -F "file=@/path/invoice.pdf"
```

### cURL — kirim OTP & verifikasi
```bash
# kirim OTP
curl -X POST https://gateway.example.com/api/v1/otp/send \
  -H "X-API-Key: wag_xxxx.yyyy" -H "Content-Type: application/json" \
  -d '{ "to": "08123456789", "length": 6, "expiresMinutes": 5 }'

# verifikasi
curl -X POST https://gateway.example.com/api/v1/otp/verify \
  -H "X-API-Key: wag_xxxx.yyyy" -H "Content-Type: application/json" \
  -d '{ "to": "08123456789", "code": "123456" }'
```

### cURL — cek nomor terdaftar WA
```bash
curl -X POST https://gateway.example.com/api/v1/messages/check \
  -H "X-API-Key: wag_xxxx.yyyy" -H "Content-Type: application/json" \
  -d '{ "deviceId": 1, "numbers": ["08123456789", "08529999999"] }'
```

### PHP (Laravel — HTTP Client)
```php
use Illuminate\Support\Facades\Http;

$res = Http::withHeaders(['X-API-Key' => config('services.wagateway.key')])
    ->post('https://gateway.example.com/api/v1/messages/send', [
        'deviceId' => 1,
        'to'       => $user->phone,
        'body'     => "Halo {$user->name}, tiket #{$ticket->id} telah dibuat.",
    ]);

if ($res->successful()) {
    logger()->info('WA terkirim', $res->json('data'));
}
```

Kirim media (Laravel):
```php
Http::withHeaders(['X-API-Key' => config('services.wagateway.key')])
    ->attach('file', file_get_contents($pdfPath), 'invoice.pdf')
    ->post('https://gateway.example.com/api/v1/messages/send-media', [
        'to' => '08123456789', 'type' => 'DOCUMENT', 'caption' => 'Invoice Anda',
    ]);
```

### PHP (native cURL)
```php
$ch = curl_init('https://gateway.example.com/api/v1/messages/send');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['X-API-Key: wag_xxxx.yyyy', 'Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode(['deviceId'=>1,'to'=>'08123456789','body'=>'Halo']),
]);
$response = curl_exec($ch);
curl_close($ch);
```

### Next.js / Node (fetch)
```js
await fetch('https://gateway.example.com/api/v1/messages/send', {
  method: 'POST',
  headers: { 'X-API-Key': process.env.WA_GATEWAY_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ deviceId: 1, to: '08123456789', body: 'Halo dari Next.js' }),
});
```

### Menerima Webhook (Laravel route)
```php
Route::post('/wa/webhook', function (Request $r) {
    $event = $r->input('event');
    if ($event === 'message.incoming') {
        $from = $r->input('data.from');
        $text = $r->input('data.body');
        // proses balasan otomatis / simpan tiket, dll.
    }
    return response()->json(['ok' => true]);
});
```

---

## Kode Status & Error
- `200/201` sukses
- `400` validasi gagal (`errors[]`)
- `401` auth gagal / token kedaluwarsa
- `403` tidak punya izin (RBAC / scope)
- `404` data tidak ditemukan
- `409` konflik (data unik)
- `429` rate limit terlampaui
- `500` kesalahan server
