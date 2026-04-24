/**
 * @build-unit BU-000-seed
 * @spec product/scenarios.md
 *
 * Database seed — populates a realistic demo environment.
 * Expanded as real entities are added (see F10 in phase-0-foundations.md).
 *
 * See docs/product/scenarios.md for the data states this should produce.
 */

import { prisma } from '@/server/db/client';

async function main() {
  console.warn('Seeding GPS Action database...');

  // Real seeding will be added as entities land (F10 — seed data session).
  // For now, this is a no-op stub that verifies the script runs.

  console.warn('✓ Seed complete (no-op stub).');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
