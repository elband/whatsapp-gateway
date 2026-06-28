import * as baileys from '@whiskeysockets/baileys';
import { prisma } from '../config/prisma.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { logger } from '../config/logger.js';

const { initAuthCreds, BufferJSON, proto } = baileys;

// Auth state Baileys disimpan terenkripsi (AES-256-GCM) di tabel `sessions`.
// Memudahkan pemulihan sesi otomatis setelah server restart tanpa file lokal.
export async function useDbAuthState(devicePk) {
  const readKey = async (keyId) => {
    const row = await prisma.session.findUnique({
      where: { deviceId_keyId: { deviceId: devicePk, keyId } },
    });
    if (!row) return null;
    try {
      return JSON.parse(decrypt(row.value), BufferJSON.reviver);
    } catch (err) {
      logger.error({ err, keyId }, 'Gagal dekripsi session key');
      return null;
    }
  };

  const writeKey = async (keyId, data) => {
    const value = encrypt(JSON.stringify(data, BufferJSON.replacer));
    await prisma.session.upsert({
      where: { deviceId_keyId: { deviceId: devicePk, keyId } },
      create: { deviceId: devicePk, keyId, value },
      update: { value },
    });
  };

  const removeKey = async (keyId) => {
    await prisma.session
      .delete({ where: { deviceId_keyId: { deviceId: devicePk, keyId } } })
      .catch(() => {});
  };

  const creds = (await readKey('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const result = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readKey(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              result[id] = value || undefined;
            }),
          );
          return result;
        },
        set: async (data) => {
          const tasks = [];
          for (const type in data) {
            for (const id in data[type]) {
              const value = data[type][id];
              const keyId = `${type}-${id}`;
              tasks.push(value ? writeKey(keyId, value) : removeKey(keyId));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeKey('creds', creds),
    // Hapus seluruh sesi device (saat logout).
    clear: async () => {
      await prisma.session.deleteMany({ where: { deviceId: devicePk } });
    },
  };
}

export default useDbAuthState;
