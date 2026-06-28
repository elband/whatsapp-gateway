# ==========================================================
# OPSIONAL — image all-in-one (single-port): backend + frontend build.
# Deployment utama proyek ini tetap Ubuntu + PM2/systemd + Nginx (lihat docs/DEPLOYMENT.md).
# Dockerfile ini disediakan untuk "Docker readiness" / portabilitas.
# Build: docker build -t wa-gateway .
# ==========================================================

# Stage 1 — build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2 — backend runtime (menyajikan API + frontend build = single port 4000)
FROM node:22-alpine AS backend
WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
RUN npx prisma generate
# Bawa hasil build frontend ke lokasi yang dilayani app.js (../../frontend/dist)
COPY --from=frontend /app/frontend/dist /app/frontend/dist

EXPOSE 4000
# Jalankan migrasi lalu start server
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
