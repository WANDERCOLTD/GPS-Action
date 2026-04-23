/**
 * Database seed — populates a realistic demo environment.
 * Expanded as real entities are added.
 *
 * See docs/product/scenarios.md for the data states this should produce.
 */

import { prisma } from '@/server/db/client';

async function main() {
  console.warn('Seeding GPS Action database...');

  // Placeholder — real seeding happens as entities land.
  await prisma.ping.create({
    data: { message: 'Seed ran successfully.' },
  });

  console.warn('✓ Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
