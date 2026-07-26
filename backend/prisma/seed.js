import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

// Definisi permission per modul.
const PERMISSION_GROUPS = {
  device: ['read', 'create', 'update', 'delete'],
  message: ['read', 'send'],
  broadcast: ['read', 'create', 'update', 'delete'],
  contact: ['read', 'create', 'update', 'delete'],
  template: ['read', 'create', 'update', 'delete'],
  autoresponder: ['read', 'create', 'update', 'delete'],
  user: ['read', 'create', 'update', 'delete'],
  role: ['read', 'create', 'update', 'delete'],
  apikey: ['read', 'create', 'update', 'delete'],
  log: ['read', 'delete'],
  monitoring: ['read'],
  setting: ['read', 'update'],
  webhook: ['read'],
};

function buildPermissions() {
  const list = [];
  for (const [group, actions] of Object.entries(PERMISSION_GROUPS)) {
    for (const action of actions) {
      list.push({ name: `${group}.${action}`, group, description: `${action} ${group}` });
    }
  }
  return list;
}

async function main() {
  console.log('🌱 Seeding database...');

  // 1) Permissions
  const permissions = buildPermissions();
  for (const p of permissions) {
    await prisma.permission.upsert({ where: { name: p.name }, update: {}, create: p });
  }
  const allPermissions = await prisma.permission.findMany();
  console.log(`  ✓ ${allPermissions.length} permissions`);

  // 2) Roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'super_admin' },
    update: { isSystem: true },
    create: { name: 'super_admin', description: 'Akses penuh semua data & kelola user', isSystem: true },
  });
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: { isSystem: true },
    create: { name: 'admin', description: 'Admin per-user (hanya data miliknya)', isSystem: true },
  });
  const operatorRole = await prisma.role.upsert({
    where: { name: 'operator' },
    update: {},
    create: { name: 'operator', description: 'Operasional pesan & broadcast' },
  });
  const viewerRole = await prisma.role.upsert({
    where: { name: 'viewer' },
    update: {},
    create: { name: 'viewer', description: 'Hanya melihat (read-only)' },
  });

  // super_admin: semua permission (lihat & kelola semua data + user/role/apikey/setting)
  await prisma.rolePermission.deleteMany({ where: { roleId: superAdminRole.id } });
  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({ roleId: superAdminRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // admin: admin per-user. Punya penuh atas data domainnya sendiri (device/message/
  // broadcast/contact/template/autoresponder) + read monitoring/log/webhook.
  // TIDAK punya user.*/role.*/apikey.*/setting.* (khusus super_admin).
  const adminPerms = allPermissions.filter((p) =>
    ['device', 'message', 'broadcast', 'contact', 'template', 'autoresponder'].includes(p.group) ||
    ['monitoring.read', 'log.read', 'webhook.read'].includes(p.name),
  );
  await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  await prisma.rolePermission.createMany({
    data: adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // operator: device.read, message.*, broadcast.*, contact.*, template.*, monitoring.read, log.read, webhook.read
  const operatorPerms = allPermissions.filter((p) =>
    ['message', 'broadcast', 'contact', 'template', 'autoresponder'].includes(p.group) ||
    ['device.read', 'monitoring.read', 'log.read', 'webhook.read'].includes(p.name),
  );
  await prisma.rolePermission.deleteMany({ where: { roleId: operatorRole.id } });
  await prisma.rolePermission.createMany({
    data: operatorPerms.map((p) => ({ roleId: operatorRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // viewer: semua *.read + monitoring.read
  const viewerPerms = allPermissions.filter((p) => p.name.endsWith('.read'));
  await prisma.rolePermission.deleteMany({ where: { roleId: viewerRole.id } });
  await prisma.rolePermission.createMany({
    data: viewerPerms.map((p) => ({ roleId: viewerRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });
  console.log('  ✓ roles: super_admin, admin, operator, viewer');

  // 3) Super admin user default
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
  const name = process.env.SEED_ADMIN_NAME || 'Super Admin';
  const superAdmin = await prisma.user.upsert({
    where: { email },
    update: { roleId: superAdminRole.id },
    create: { name, email, password: await bcrypt.hash(password, 12), roleId: superAdminRole.id, isActive: true },
  });
  console.log(`  ✓ super admin user: ${email} / ${password}`);

  // 3b) Backfill kepemilikan data lama -> super admin default (idempotent)
  const backfill = { where: { ownerId: null }, data: { ownerId: superAdmin.id } };
  await prisma.device.updateMany(backfill);
  await prisma.contact.updateMany(backfill);
  await prisma.contactGroup.updateMany(backfill);
  await prisma.template.updateMany(backfill);
  await prisma.autoresponder.updateMany(backfill);
  console.log('  ✓ backfill ownerId data lama -> super admin');

  // 4) Default settings
  const defaults = [
    { key: 'app.name', value: 'WhatsApp Gateway', group: 'general' },
    { key: 'broadcast.minDelayMs', value: 3000, group: 'broadcast' },
    { key: 'broadcast.maxDelayMs', value: 8000, group: 'broadcast' },
    { key: 'message.retryAttempts', value: 3, group: 'message' },
  ];
  for (const s of defaults) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log('  ✓ default settings');

  console.log('✅ Seeding selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
