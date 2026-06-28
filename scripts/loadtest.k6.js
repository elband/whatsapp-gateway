// Load test API kirim pesan (k6). Pesan masuk antrean (tidak benar-benar terkirim
// kecuali device CONNECTED) — ini menguji throughput API + queue, bukan WhatsApp.
//
// Jalankan:
//   k6 run -e BASE_URL=https://gateway.example.com/api/v1 -e API_KEY=wag_xxx.yyy -e DEVICE_ID=1 scripts/loadtest.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const APIKEY = __ENV.API_KEY;
const DEVICE_ID = Number(__ENV.DEVICE_ID || 1);

export default function () {
  const res = http.post(
    `${BASE}/messages/send`,
    JSON.stringify({ deviceId: DEVICE_ID, to: '08123456789', body: 'loadtest' }),
    { headers: { 'Content-Type': 'application/json', 'X-API-Key': APIKEY } },
  );
  check(res, { 'status 201': (r) => r.status === 201 });
  sleep(0.2);
}
