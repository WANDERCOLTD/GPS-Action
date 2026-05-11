/**
 * @build-unit bu-share-event-polymorphic
 * @spec architecture/decision-log.md (D077)
 * @spec build/session-briefs/bu-share-event-polymorphic.md
 * @adr docs/adrs/0018-share-event-polymorphic.md
 *
 * Parity gate for the three-phase ShareEvent migration. Runs in CI on
 * Phase A and Phase B PRs.
 *
 * Returns exit 0 when one of the following is true:
 *   1. PostShare table does not exist (the steady state both before
 *      Phase A backfill matters AND after Phase C cleanup) — there's
 *      nothing to be at parity with.
 *   2. COUNT(PostShare) === COUNT(ShareEvent WHERE targetType='post')
 *      AND every PostShare row has a matching ShareEvent row joined
 *      via legacyPostShareId.
 *
 * Returns exit 1 with a diff report otherwise.
 *
 * Why this is necessary: ADR-0003's PostShare table was speced but
 * never built (bu-post-share-counter status: planned as of
 * 2026-05-11). The parity script must therefore handle the
 * "no PostShare table" case gracefully — vacuously OK rather than
 * an error. Once Phase B ships dual-write, both tables will coexist
 * and the count + join checks become load-bearing.
 */

import 'dotenv/config';
import { fileURLToPath } from 'node:url';

interface ParityResult {
  ok: boolean;
  reason: string;
  details?: {
    postShareCount?: number;
    shareEventPostCount?: number;
    orphanCount?: number;
  };
}

/**
 * Pure check fn — returns the parity result without touching process.exit.
 * Exported so the unit tests can mock the underlying counts.
 */
export async function verifyShareEventParity(deps: {
  postShareTableExists: () => Promise<boolean>;
  countPostShare: () => Promise<number>;
  countShareEventOfPostTarget: () => Promise<number>;
  countOrphanPostShareRows: () => Promise<number>;
}): Promise<ParityResult> {
  const exists = await deps.postShareTableExists();
  if (!exists) {
    return {
      ok: true,
      reason:
        'PostShare table not present — vacuously at parity (Phase A pre-dual-write or Phase C post-cleanup).',
    };
  }

  const [postShareCount, shareEventPostCount, orphanCount] = await Promise.all([
    deps.countPostShare(),
    deps.countShareEventOfPostTarget(),
    deps.countOrphanPostShareRows(),
  ]);

  if (postShareCount !== shareEventPostCount) {
    return {
      ok: false,
      reason: `Count mismatch: PostShare has ${postShareCount} rows, ShareEvent (targetType='post') has ${shareEventPostCount}.`,
      details: { postShareCount, shareEventPostCount, orphanCount },
    };
  }

  if (orphanCount > 0) {
    return {
      ok: false,
      reason: `${orphanCount} PostShare row(s) have no matching ShareEvent (joined via legacyPostShareId).`,
      details: { postShareCount, shareEventPostCount, orphanCount },
    };
  }

  return {
    ok: true,
    reason: `Parity OK — ${postShareCount} PostShare row(s) match ${shareEventPostCount} ShareEvent row(s) of targetType='post'.`,
    details: { postShareCount, shareEventPostCount, orphanCount },
  };
}

/**
 * Production deps — hit the live DB via Prisma's $queryRaw. Imported
 * lazily so the unit tests can import the pure `verifyShareEventParity`
 * fn without triggering Prisma's adapter-pg connection.
 */
async function liveDeps(): Promise<Parameters<typeof verifyShareEventParity>[0]> {
  const { prisma } = await import('@/server/db/client');
  return {
    postShareTableExists: async () => {
      const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = current_schema()
            AND table_name = 'PostShare'
        ) AS exists
      `;
      return Boolean(rows[0]?.exists);
    },
    countPostShare: async () => {
      const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "PostShare"
      `;
      return Number(rows[0]?.count ?? 0n);
    },
    countShareEventOfPostTarget: async () => {
      const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "ShareEvent"
        WHERE "targetType" = 'post'
      `;
      return Number(rows[0]?.count ?? 0n);
    },
    countOrphanPostShareRows: async () => {
      const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "PostShare" ps
        LEFT JOIN "ShareEvent" se ON se."legacyPostShareId" = ps."id"
        WHERE se."id" IS NULL
      `;
      return Number(rows[0]?.count ?? 0n);
    },
  };
}

async function main(): Promise<void> {
  const result = await verifyShareEventParity(await liveDeps());

  if (result.ok) {
    console.warn(`OK  ${result.reason}`);
    if (result.details) {
      console.warn(`     details: ${JSON.stringify(result.details)}`);
    }
    process.exit(0);
  }

  console.error(`FAIL  ${result.reason}`);
  if (result.details) {
    console.error(`      details: ${JSON.stringify(result.details)}`);
  }
  console.error('\nRun this after Phase B dual-write to confirm both tables are in lockstep.');
  process.exit(1);
}

// Run only when invoked directly (e.g. `tsx scripts/verify-share-event-parity.ts`),
// not when imported by tests.
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  void main();
}
