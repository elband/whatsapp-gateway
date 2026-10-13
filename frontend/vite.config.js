import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const target = 'http://localhost:4000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Pakai '/api/' (bukan '/api') agar rute halaman /api-keys & /api-docs tidak ikut ter-proxy.
      '/api/': { target, changeOrigin: true },
      '/socket.io': { target, ws: true, changeOrigin: true },
      '/uploads': { target, changeOrigin: true },
    },
  },
  build: {
    // M6: pisahkan vendor besar agar bundle awal lebih kecil & cache-friendly.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          realtime: ['socket.io-client'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})
