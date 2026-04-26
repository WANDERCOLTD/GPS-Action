/**
 * @build-unit BU-admin-bulk-ops
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-bulk-ops.md
 *
 * Server-action wrapper for the four bulk-mutation tRPC procedures.
 * The list page binds the entity into a single `bulkAction(verb, ids)`
 * handler that the BulkSelector context invokes.
 */

'use server';

import { TRPCError } from '@trpc/server';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { ADMIN_ENTITY_KEYS } from '@/shared/validation/admin';

type BulkVerb = 'softDelete' | 'restore' | 'hardDelete' | 'forceRelease';

interface BulkActionResult {
  readonly succeeded: number;
  readonly failed: ReadonlyArray<{ readonly id: string; readonly message: string }>;
}

function isAdminEntity(value: string): value is (typeof ADMIN_ENTITY_KEYS)[number] {
  return (ADMIN_ENTITY_KEYS as readonly string[]).includes(value);
}

export async function adminBulkAction(
  entity: string,
  verb: BulkVerb,
  ids: ReadonlyArray<string>,
): Promise<BulkActionResult> {
  // Refresh auth on every call. Server actions don't share the cookie
  // through props, so context is rebuilt from the request.
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);

  // forceRelease is only valid for the `request` entity. The shared
  // ADMIN_ENTITY_KEYS list doesn't include it (slice 1); special-case
  // here so the call passes Zod and reaches the procedure stub.
  if (verb === 'forceRelease') {
    if (entity !== 'request') {
      return {
        succeeded: 0,
        failed: ids.map((id) => ({
          id,
          message: `forceRelease is only valid for the 'request' entity (got '${entity}')`,
        })),
      };
    }
    try {
      return await caller.admin.bulk.forceRelease({ entity: 'request', ids: [...ids] });
    } catch (err: unknown) {
      const message = err instanceof TRPCError ? err.message : 'Bulk action failed.';
      return { succeeded: 0, failed: ids.map((id) => ({ id, message })) };
    }
  }

  if (!isAdminEntity(entity)) {
    return {
      succeeded: 0,
      failed: ids.map((id) => ({ id, message: `Unknown entity "${entity}"` })),
    };
  }

  try {
    if (verb === 'softDelete') {
      return await caller.admin.bulk.softDelete({ entity, ids: [...ids] });
    }
    if (verb === 'restore') {
      return await caller.admin.bulk.restore({ entity, ids: [...ids] });
    }
    return await caller.admin.bulk.hardDelete({ entity, ids: [...ids] });
  } catch (err: unknown) {
    const message = err instanceof TRPCError ? err.message : 'Bulk action failed.';
    return { succeeded: 0, failed: ids.map((id) => ({ id, message })) };
  }
}
