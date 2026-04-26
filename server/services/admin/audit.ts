/**
 * @build-unit BU-admin-audit-integration
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-audit-integration.md
 *
 * Admin-specific audit writer. Wraps `auditLog()` from
 * `server/services/audit.ts` with the verb-naming + changes-shape
 * conventions for the generic admin surface. Never throws — the
 * underlying writer already swallows errors.
 *
 * Verb format (Q4 locked): dotted, `admin.<entity>.<verb>`. Sorts
 * naturally in `action LIKE 'admin.%'` queries.
 */

import type { EntityKey } from '@/server/admin/entity-metadata';
import { auditLog } from '@/server/services/audit';
import { computeDiff, stripPii, type Diff } from '@/server/services/admin/diff';

export type AdminAuditVerb = 'create' | 'update' | 'soft-delete' | 'restore' | 'hard-delete';

interface BaseArgs {
  readonly entity: EntityKey;
  readonly entityId: string;
  readonly actorId: string;
}

interface CreateArgs extends BaseArgs {
  readonly verb: 'create';
  /** Full row snapshot of the newly-created entity. */
  readonly after: Record<string, unknown>;
}

interface UpdateArgs extends BaseArgs {
  readonly verb: 'update';
  readonly before: Record<string, unknown>;
  readonly after: Record<string, unknown>;
}

interface DeleteishArgs extends BaseArgs {
  readonly verb: 'soft-delete' | 'restore' | 'hard-delete';
  /** Full row snapshot taken BEFORE the mutation runs. */
  readonly before: Record<string, unknown>;
}

export type AdminAuditArgs = CreateArgs | UpdateArgs | DeleteishArgs;

/** Build the action string. Same shape for every verb. */
function actionFor(entity: EntityKey, verb: AdminAuditVerb): string {
  return `admin.${entity}.${verb}`;
}

/**
 * Build the `changes` payload. Shape varies by verb (see brief
 * "Outputs produced"):
 *   - create:        { after }
 *   - update:        { diff }
 *   - soft-delete:   { before }
 *   - restore:       { before }
 *   - hard-delete:   { before }
 */
function buildChanges(args: AdminAuditArgs): Record<string, unknown> {
  switch (args.verb) {
    case 'create':
      return { after: stripPii(args.after) };
    case 'update': {
      const diff: Diff = computeDiff(args.before, args.after);
      return { diff };
    }
    case 'soft-delete':
    case 'restore':
    case 'hard-delete':
      return { before: stripPii(args.before) };
  }
}

/**
 * Write one audit row for a generic-admin mutation. Safe to call
 * even if `args.before` / `args.after` haven't been pre-loaded —
 * the underlying writer never throws.
 *
 * For User entity mutations, `targetUserId` mirrors `entityId`
 * (the row being mutated *is* a user). For other entities,
 * `targetUserId` is null.
 */
export async function writeAdminAudit(args: AdminAuditArgs): Promise<void> {
  await auditLog({
    action: actionFor(args.entity, args.verb),
    entityType: args.entity,
    entityId: args.entityId,
    userId: args.actorId,
    targetUserId: args.entity === 'user' ? args.entityId : null,
    changes: buildChanges(args),
    context: { source: 'admin' },
  });
}
