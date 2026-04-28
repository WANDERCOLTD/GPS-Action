/**
 * @build-unit BU-tick-or-cross
 * @spec architecture/decision-log.md (D070)
 *
 * Reference-data invariant: every PostKind slug the application code
 * references (per `shared/post-kinds.ts`) MUST exist as a non-deleted
 * row in the database. The check runs in CI after
 * `prisma migrate deploy` to fail the merge if a developer adds a
 * code-referenced slug without a matching idempotent migration.
 *
 * Layer boundary: server/lib → server/db + shared only.
 */

import { prisma } from '@/server/db/client';
import { REQUIRED_POST_KIND_SLUGS } from '@/shared/post-kinds';

export class MissingReferenceDataError extends Error {
  public readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(
      `Required PostKind rows are missing or soft-deleted: ${missing.join(
        ', ',
      )}. Add an idempotent data migration (see D070).`,
    );
    this.name = 'MissingReferenceDataError';
    this.missing = missing;
  }
}

export async function assertReferenceData(): Promise<void> {
  const rows = await prisma.postKind.findMany({
    where: {
      slug: { in: [...REQUIRED_POST_KIND_SLUGS] },
      deletedAt: null,
    },
    select: { slug: true },
  });
  const present = new Set(rows.map((r) => r.slug));
  const missing = REQUIRED_POST_KIND_SLUGS.filter((s) => !present.has(s));
  if (missing.length > 0) {
    throw new MissingReferenceDataError(missing);
  }
}
