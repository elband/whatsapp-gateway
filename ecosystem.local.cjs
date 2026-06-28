// PM2 ecosystem untuk menjalankan di mesin LOKAL (Windows/Laragon).
// Backend sekaligus menyajikan build frontend (frontend/dist) → single-port :4000.
// Pakai: pm2 start ecosystem.local.cjs ; pm2 save
const path = require('path');
module.exports = {
  apps: [
    {
      name: 'wa-gateway-api',
      cwd: path.join(__dirname, 'backend'),
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '20s',
      max_memory_restart: '1G',
      time: true,
      env: { NODE_ENV: 'production' },
    },
  ],
};
