/**
 * @build-unit BU-admin-bulk-ops
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-bulk-ops.md
 *
 * Bulk-mutation service for the generic admin engine. Each verb
 * iterates over the supplied ids one row at a time so:
 *
 *   - The per-row `writeAdminAudit()` call (BU-admin-audit-integration)
 *     fires once per id — the audit trail is row-granular.
 *   - A single failure doesn't abort the rest of the batch — the
 *     return shape names which ids succeeded and which failed.
 *
 * Sequential processing per Q2 (locked 2026-04-26). Bound at 100
 * ids per call (Q1) — enforced at the router via Zod.
 */

import { TRPCError } from '@trpc/server';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { entityMetadata } from '@/server/admin/entity-metadata';
import { hardDeleteEntity, restoreEntity, softDeleteEntity } from '@/server/services/admin/crud';

export interface BulkResult {
  readonly succeeded: number;
  readonly failed: ReadonlyArray<{ readonly id: string; readonly message: string }>;
}

export type BulkVerb = 'softDelete' | 'restore' | 'hardDelete' | 'forceRelease';

interface BulkArgs {
  readonly entity: EntityKey;
  readonly ids: ReadonlyArray<string>;
  readonly actorId: string;
}

function assertVerbSupported(entity: EntityKey, verb: BulkVerb): void {
  const meta = entityMetadata[entity];
  if (!meta) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Entity "${entity}" is not in the metadata map`,
    });
  }
  const supported = meta.bulkActions ?? [];
  if (!supported.includes(verb)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Entity "${entity}" does not support bulk ${verb}. Declared bulkActions: ${supported.join(', ') || '(none)'}`,
    });
  }
}

/**
 * Sequential per-id loop. Each successful row calls the per-row
 * mutation (which writes audit). Failures are collected and
 * returned alongside successes.
 */
async function runBulk(
  args: BulkArgs,
  perRow: (id: string) => Promise<unknown>,
): Promise<BulkResult> {
  const failed: Array<{ id: string; message: string }> = [];
  let succeeded = 0;
  for (const id of args.ids) {
    try {
      await perRow(id);
      succeeded += 1;
    } catch (err: unknown) {
      const message =
        err instanceof TRPCError ? err.message : err instanceof Error ? err.message : String(err);
      failed.push({ id, message });
    }
  }
  return { succeeded, failed };
}

export async function bulkSoftDelete(args: BulkArgs): Promise<BulkResult> {
  assertVerbSupported(args.entity, 'softDelete');
  return runBulk(args, (id) => softDeleteEntity(args.entity, id, args.actorId));
}

export async function bulkRestore(args: BulkArgs): Promise<BulkResult> {
  assertVerbSupported(args.entity, 'restore');
  return runBulk(args, (id) => restoreEntity(args.entity, id, args.actorId));
}

export async function bulkHardDelete(args: BulkArgs): Promise<BulkResult> {
  assertVerbSupported(args.entity, 'hardDelete');
  return runBulk(args, (id) => hardDeleteEntity(args.entity, id, args.actorId));
}

/**
 * Force-release of a claim. Gated to `request` entity only — request
 * is workflow:queue and never reaches the /data surface (per Q4 of
 * BU-admin-crud), but the procedure registers here for future use
 * when an admin surface for requests lands.
 *
 * Today the underlying request service doesn't expose a force-release
 * function (BU-requests-urgent shipped claim/resolve only). Until
 * BU-admin-roles or BU-requests-admin lands, this throws so the bulk
 * surface fails honestly rather than silently no-op.
 */
export async function bulkForceRelease(args: BulkArgs): Promise<BulkResult> {
  if (args.entity !== 'request') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `forceRelease is only valid for the 'request' entity (got '${args.entity}')`,
    });
  }
  assertVerbSupported(args.entity, 'forceRelease');
  // Service-side stub. Lift the throw when the request service exposes
  // a force-release function (tracked: BU-admin-roles / BU-requests-admin).
  return runBulk(args, async (_id) => {
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'forceRelease not yet wired to the request service. Lands with BU-admin-roles.',
    });
  });
}
