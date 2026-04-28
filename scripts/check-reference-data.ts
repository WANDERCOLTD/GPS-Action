/**
 * @spec architecture/decision-log.md (D070)
 *
 * CI entry point for the reference-data gate. Runs after
 * `prisma migrate deploy` in the deploy job; exits non-zero if any
 * code-referenced PostKind slug is missing from the database, failing
 * the merge.
 */

// Prisma 7 (D071): the runtime adapter reads DATABASE_URL at module
// init; tsx doesn't auto-load .env, so we import it here before the
// prisma client is constructed. Companion to #143 which patched
// scripts/seed.ts the same way.
import 'dotenv/config';

import { assertReferenceData, MissingReferenceDataError } from '@/server/lib/assert-reference-data';

async function main(): Promise<void> {
  try {
    await assertReferenceData();
    console.warn('✓ Reference data check passed.');
    process.exit(0);
  } catch (err) {
    if (err instanceof MissingReferenceDataError) {
      console.error('✗ Reference data check FAILED:');
      console.error(`  ${err.message}`);
      console.error(
        '\nPer D070, every code-referenced PostKind slug must be inserted by an idempotent migration. Add one before merging.',
      );
      process.exit(1);
    }
    throw err;
  }
}

void main();
