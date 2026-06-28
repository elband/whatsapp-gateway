// H5 scaffold — konfigurasi peran & sharding (via ENV).
// CLUSTER_ROLE: 'all' (default, single-process seperti sekarang) | 'api' | 'worker'
// SHARD_COUNT : jumlah WA-worker shard
// SHARD_ID    : indeks shard untuk proses worker ini (0 .. SHARD_COUNT-1)
export const ROLE = process.env.CLUSTER_ROLE || 'all';
export const SHARD_COUNT = Math.max(1, parseInt(process.env.SHARD_COUNT || '1', 10));
export const SHARD_ID = Math.max(0, parseInt(process.env.SHARD_ID || '0', 10));

export const isApi = ROLE === 'api' || ROLE === 'all';
export const isWorker = ROLE === 'worker' || ROLE === 'all';
export const clusterEnabled = ROLE !== 'all'; // true bila API & worker dipisah

export default { ROLE, SHARD_COUNT, SHARD_ID, isApi, isWorker, clusterEnabled };
