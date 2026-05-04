/**
 * @build-unit bu-coordination-board (build seq #2 — board-column chunk)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0006
 *
 * BoardColumn service — per-Group configurable kanban columns.
 *
 * Responsibilities:
 *   - Seed default columns on Group creation (per `GroupKind`, per
 *     ADR-0006 + `shared/board-column-defaults.ts`). Idempotent: if a
 *     Group already has columns, seedDefaultColumnsForGroup is a no-op.
 *   - CRUD + soft-delete (group admins rename / reorder / retire).
 *   - Atomic reorder: writes a contiguous 0-based ordinal range across
 *     all supplied column ids in one transaction.
 *
 * App-level invariants this service enforces (per ADR-0006 +
 * schema.prisma comment block above the model):
 *   - `displayName` non-empty + trimmed.
 *   - Ordinals are 0-based and contiguous within a Group's active
 *     (non-soft-deleted) columns. Reorder rebuilds the sequence.
 *   - Hard-delete blocked when any active Request points at the column
 *     via `Request.columnId`. Soft-delete is the normal retire path.
 *
 * Permission gates (caller's responsibility — service is permission-
 * agnostic, mirrors assignments.ts):
 *   - Reorder / rename / delete: group admin (Surface 1 permission
 *     table).
 *   - Seed: only the Group-create flow.
 *
 * Layer boundary: services → db + lib + shared only.
 */

import type { BoardColumn, GroupKind } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { defaultColumnsForKind } from '@/shared/board-column-defaults';

export interface SeedDefaultColumnsInput {
  groupId: string;
  kind: GroupKind;
  actorId: string;
}

export interface CreateColumnInput {
  groupId: string;
  displayName: string;
  actorId: string;
}

export interface RenameColumnInput {
  columnId: string;
  displayName: string;
  actorId: string;
}

export interface DeleteColumnInput {
  columnId: string;
  actorId: string;
}

export interface ReorderColumnsInput {
  groupId: string;
  /** Ordered list of column ids; the resulting ordinal is the array index. */
  orderedIds: string[];
  actorId: string;
}

const TWO_PHASE_OFFSET = 1_000_000;

/**
 * Seed the system default columns for a freshly-created Group. Idempotent:
 * if any active column already exists for the Group, returns the existing
 * set unchanged (no audit, no churn). Called from the Group create flow
 * in `admin/registry.ts`.
 */
export async function seedDefaultColumnsForGroup(
  input: SeedDefaultColumnsInput,
): Promise<BoardColumn[]> {
  const { groupId, kind, actorId } = input;

  const existing = await prisma.boardColumn.findMany({
    where: { groupId, deletedAt: null },
    orderBy: { ordinal: 'asc' },
  });
  if (existing.length > 0) return existing;

  const names = defaultColumnsForKind(kind);
  const created = await prisma.$transaction(
    names.map((displayName, ordinal) =>
      prisma.boardColumn.create({ data: { groupId, displayName, ordinal } }),
    ),
  );

  await Promise.all(
    created.map((col) =>
      auditLog({
        action: 'board_column_seeded',
        entityType: 'BoardColumn',
        entityId: col.id,
        userId: actorId,
        context: { groupId, kind, ordinal: col.ordinal, displayName: col.displayName },
      }),
    ),
  );

  return created;
}

/**
 * List active columns for a Group, ordinal-asc. Soft-deleted columns are
 * excluded — admins access the deleted set via a future `listDeleted`
 * surface (out of scope for this PR).
 */
export async function listColumnsForGroup(groupId: string): Promise<BoardColumn[]> {
  return prisma.boardColumn.findMany({
    where: { groupId, deletedAt: null },
    orderBy: { ordinal: 'asc' },
  });
}

/**
 * Resolve the groupId for a BoardColumn — used by routers to gate
 * column-level mutations behind the group-admin permission check
 * before calling the mutation primitives. Returns null if the column
 * doesn't exist (deleted or otherwise).
 */
export async function getColumnGroupId(columnId: string): Promise<string | null> {
  const row = await prisma.boardColumn.findUnique({
    where: { id: columnId },
    select: { groupId: true },
  });
  return row?.groupId ?? null;
}

/**
 * Append a new column at the end of the Group's active set (ordinal =
 * current count). Trim + reject empty `displayName`.
 */
export async function createColumn(input: CreateColumnInput): Promise<BoardColumn> {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    throw new Error('BoardColumn.displayName must be non-empty');
  }

  const result = await prisma.$transaction(async (tx) => {
    const count = await tx.boardColumn.count({
      where: { groupId: input.groupId, deletedAt: null },
    });
    return tx.boardColumn.create({
      data: { groupId: input.groupId, displayName, ordinal: count },
    });
  });

  await auditLog({
    action: 'board_column_created',
    entityType: 'BoardColumn',
    entityId: result.id,
    userId: input.actorId,
    context: { groupId: input.groupId, ordinal: result.ordinal, displayName },
  });

  return result;
}

/**
 * Rename a column. No-op (no audit) if name unchanged after trim.
 */
export async function renameColumn(input: RenameColumnInput): Promise<BoardColumn> {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    throw new Error('BoardColumn.displayName must be non-empty');
  }

  const before = await prisma.boardColumn.findUnique({ where: { id: input.columnId } });
  if (!before) throw new Error(`BoardColumn ${input.columnId} not found`);
  if (before.deletedAt !== null) throw new Error(`BoardColumn ${input.columnId} is deleted`);
  if (before.displayName === displayName) return before;

  const updated = await prisma.boardColumn.update({
    where: { id: input.columnId },
    data: { displayName },
  });

  await auditLog({
    action: 'board_column_renamed',
    entityType: 'BoardColumn',
    entityId: updated.id,
    userId: input.actorId,
    changes: { displayName: { from: before.displayName, to: displayName } },
    context: { groupId: updated.groupId },
  });

  return updated;
}

/**
 * Soft-delete a column. Refuses if any active (non-soft-deleted) Request
 * still has `columnId = this`. Caller must relocate cards first.
 *
 * Active columns past the deleted ordinal are renumbered to keep the
 * surviving sequence contiguous (matches the visual reorder admins
 * expect on Surface 1).
 */
export async function softDeleteColumn(input: DeleteColumnInput): Promise<BoardColumn> {
  const before = await prisma.boardColumn.findUnique({ where: { id: input.columnId } });
  if (!before) throw new Error(`BoardColumn ${input.columnId} not found`);
  if (before.deletedAt !== null) return before;

  const blockingRequests = await prisma.request.count({
    where: { columnId: input.columnId, deletedAt: null },
  });
  if (blockingRequests > 0) {
    throw new Error(
      `Cannot delete BoardColumn ${input.columnId}: ${blockingRequests} active request(s) still reference it. Relocate cards before deleting.`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const removed = await tx.boardColumn.update({
      where: { id: input.columnId },
      data: { deletedAt: new Date() },
    });
    await tx.boardColumn.updateMany({
      where: { groupId: before.groupId, deletedAt: null, ordinal: { gt: before.ordinal } },
      data: { ordinal: { decrement: 1 } },
    });
    return removed;
  });

  await auditLog({
    action: 'board_column_deleted',
    entityType: 'BoardColumn',
    entityId: updated.id,
    userId: input.actorId,
    context: {
      groupId: before.groupId,
      ordinal: before.ordinal,
      displayName: before.displayName,
    },
  });

  return updated;
}

/**
 * Atomic reorder. The supplied `orderedIds` array becomes the new
 * ordinal sequence (0-based). Two-phase write avoids transient unique-
 * constraint violations on `(groupId, ordinal)`: phase 1 shifts all
 * ordinals into a high range, phase 2 rewrites the contiguous 0..N-1.
 *
 * Refuses if `orderedIds` doesn't exactly cover the Group's active
 * column set (no extras, no missing ids). Refuses an empty array if any
 * active columns exist.
 */
export async function reorderColumns(input: ReorderColumnsInput): Promise<BoardColumn[]> {
  const { groupId, orderedIds, actorId } = input;

  const { rows, changed } = await prisma.$transaction(async (tx) => {
    const active = await tx.boardColumn.findMany({
      where: { groupId, deletedAt: null },
      orderBy: { ordinal: 'asc' },
    });

    const activeIds = new Set(active.map((c) => c.id));
    const requestedIds = new Set(orderedIds);
    if (
      activeIds.size !== requestedIds.size ||
      [...activeIds].some((id) => !requestedIds.has(id))
    ) {
      throw new Error(
        `reorderColumns: orderedIds must exactly cover the Group's active columns (got ${orderedIds.length}, have ${active.length})`,
      );
    }

    if (active.every((c, i) => c.id === orderedIds[i])) {
      return { rows: active, changed: false };
    }

    // Two-phase write: phase 1 shifts everyone into a high range so no
    // two rows clash on `(groupId, ordinal)`; phase 2 rewrites 0..N-1.
    await Promise.all(
      orderedIds.map((id, i) =>
        tx.boardColumn.update({
          where: { id },
          data: { ordinal: i + TWO_PHASE_OFFSET },
        }),
      ),
    );
    const final = await Promise.all(
      orderedIds.map((id, i) =>
        tx.boardColumn.update({
          where: { id },
          data: { ordinal: i },
        }),
      ),
    );
    return { rows: final, changed: true };
  });

  if (changed) {
    await auditLog({
      action: 'board_column_reordered',
      entityType: 'BoardColumn',
      // No single entity — log against the first column for traceability.
      entityId: rows[0]?.id ?? groupId,
      userId: actorId,
      context: { groupId, orderedIds },
    });
  }

  return rows.sort((a, b) => a.ordinal - b.ordinal);
}
