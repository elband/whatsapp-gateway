// F2 — mode CLUSTER: API tier (stateless) + WA-worker (stateful, ber-shard).
// SHARD_COUNT=1 sebagai langkah awal. Naikkan + tambah worker pada F3.
// Jalankan: pm2 start ecosystem.cluster.cjs   (hentikan dulu ecosystem.local.cjs!)
const path = require('path');
const cwd = path.join(__dirname, 'backend');
const base = { cwd, autorestart: true, time: true, max_memory_restart: '1G' };
const SHARD_COUNT = '1';

module.exports = {
  apps: [
    {
      ...base,
      name: 'wa-api',
      script: 'src/server.js',
      env: { CLUSTER_ROLE: 'api', SHARD_COUNT, PORT: '4000' },
    },
    {
      ...base,
      name: 'wa-worker-0',
      script: 'src/entrypoints/worker-wa.js',
      env: { CLUSTER_ROLE: 'worker', SHARD_COUNT, SHARD_ID: '0' },
    },
  ],
};
