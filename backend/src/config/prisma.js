import { PrismaClient } from '@prisma/client';
import { readReplicas } from '@prisma/extension-read-replicas';
import { env } from './env.js';

// Klien dasar (primary = read+write).
const base = new PrismaClient({
  log: env.isProd ? ['error', 'warn'] : ['error', 'warn'],
});

// F4: bila DATABASE_REPLICA_URL diset, baca otomatis dialihkan ke replica,
// tulis tetap ke primary. Tanpa replica → klien biasa (tidak berubah).
export const prisma = env.replicaUrls.length
  ? base.$extends(readReplicas({ url: env.replicaUrls }))
  : base;

export async function connectPrisma() {
  await base.$connect();
}

export async function disconnectPrisma() {
  await base.$disconnect();
}

export default prisma;
