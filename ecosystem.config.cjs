// PM2 ecosystem untuk WhatsApp Gateway Enterprise
// Catatan: backend dijalankan single-instance (fork) karena koneksi Baileys
// disimpan di memori proses. Worker queue berjalan in-process bersama backend.
module.exports = {
  apps: [
    {
      name: 'wa-gateway-api',
      cwd: '/var/www/whatsapp-gateway/backend',
      script: 'src/server.js',
      interpreter: 'node',
      node_args: '--max-old-space-size=1024',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '30s',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/www/whatsapp-gateway/logs/pm2-error.log',
      out_file: '/var/www/whatsapp-gateway/logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
