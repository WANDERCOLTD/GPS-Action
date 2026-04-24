/**
 * @build-unit BU-001-lite
 * @spec product/scenarios.md
 *
 * Database seed — populates a realistic demo environment.
 * Idempotent: uses upsert, safe to re-run.
 *
 * BU-001-lite: 5 demo users + 2 role grants.
 * BU-feed will extend with posts, groups, etc.
 */

import { prisma } from '@/server/db/client';

// ── Seed users ───────────────────────────────────────────────────────────
// Invented characters — not real people. Names riff on classic film stars
// with fabricated surnames.

const SEED_USERS = [
  {
    email: 'eddie@demo.gps-action.test',
    displayName: 'Eddie Morales',
  },
  {
    email: 'cary@demo.gps-action.test',
    displayName: 'Cary Whitfield',
  },
  {
    email: 'bette@demo.gps-action.test',
    displayName: 'Bette Rosenthal',
  },
  {
    email: 'humphrey@demo.gps-action.test',
    displayName: 'Humphrey Kline',
  },
  {
    email: 'ingrid@demo.gps-action.test',
    displayName: 'Ingrid Blum',
  },
] as const;

async function main(): Promise<void> {
  console.warn('Seeding GPS Action database...');

  const now = new Date();

  // ── Upsert users ─────────────────────────────────────────────────────
  const userIds: Record<string, string> = {};

  for (const seed of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: { displayName: seed.displayName },
      create: {
        email: seed.email,
        displayName: seed.displayName,
        verifiedAt: now,
      },
    });
    // Use the first part of the email (before @) as the lookup key
    const key = seed.email.split('@')[0]!;
    userIds[key] = user.id;
  }

  console.warn(`  ✓ ${SEED_USERS.length} users upserted`);

  // ── Role grants ──────────────────────────────────────────────────────
  // Bette: admin. Cary: queue_manager. Self-granted for seed purposes.

  const betteId = userIds['bette']!;
  const caryId = userIds['cary']!;

  // Bette → admin (granted by herself for bootstrap)
  const existingAdminGrant = await prisma.roleGrant.findFirst({
    where: { userId: betteId, role: 'admin', revokedAt: null },
  });

  if (!existingAdminGrant) {
    await prisma.roleGrant.create({
      data: {
        userId: betteId,
        role: 'admin',
        grantedByUserId: betteId,
        grantedReason: 'Seeded dev-environment role for demo purposes',
      },
    });
    console.warn('  ✓ Bette granted admin role');
  } else {
    console.warn('  ✓ Bette already has admin role');
  }

  // Cary → queue_manager (granted by Bette)
  const existingQmGrant = await prisma.roleGrant.findFirst({
    where: { userId: caryId, role: 'queue_manager', revokedAt: null },
  });

  if (!existingQmGrant) {
    await prisma.roleGrant.create({
      data: {
        userId: caryId,
        role: 'queue_manager',
        grantedByUserId: betteId,
        grantedReason: 'Seeded dev-environment role for demo purposes',
      },
    });
    console.warn('  ✓ Cary granted queue_manager role');
  } else {
    console.warn('  ✓ Cary already has queue_manager role');
  }

  console.warn('✓ Seed complete.');
}

main()
  .catch((e: unknown) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
