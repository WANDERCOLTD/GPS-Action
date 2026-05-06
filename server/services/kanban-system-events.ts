/**
 * @build-unit bu-coordination-board (atom 5d-3)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0014
 *
 * System-event hook for the kanban comment thread. Service-layer helper
 * called from board.ts / assignments.ts / request-group.ts when a kanban
 * mutation succeeds. Each call-site stays a one-liner; this module owns
 * the per-event toggle gate, the displayName lookups, and the phrasing.
 *
 * Each emit is gated on `isEventEnabled(eventKind)` from
 * `kanban-event-config` (ADR-0014). When enabled, the helper writes a
 * `Comment` row with `kind='comment'`, `source='system'` so the thread
 * on Surface 2 shows "Sharon moved this to Preparation." alongside
 * human comments.
 *
 * Phrasing is past tense, named actor — the project's "honest copy"
 * voice. Default copy is conservative; admin can flip events off.
 *
 * No backfill (per ADR-0014): toggling a kind ON only affects future
 * events. Historical threads are not rewritten.
 *
 * Best-effort: the helper does its own row lookups (actor, column,
 * group) and silently no-ops if a referenced row has been soft-deleted
 * between the mutation and the emit. The mutation has already
 * succeeded; a missing label is not a reason to fail it or surface an
 * error to the caller.
 *
 * Shared-team visibility caveat: rows written here have `kind='comment'`
 * (not `note`), so they pass the `comment-thread.ts` visibility filter
 * to every viewer linked to the ticket — including shared teams. That
 * is intentional for events like `column_move` ("everyone should see
 * 'moved to Review'") but may surprise on `title_edit` / `body_edit` if
 * the originating team meant the edit privately. Default-off mitigates;
 * revisit if the defaults change.
 *
 * Layer boundary: services → db + lib + shared only.
 */

import type { KanbanEventKind, RequestStatus } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { isEventEnabled } from '@/server/services/kanban-event-config';

/**
 * Discriminated union of kanban events that may produce a system Comment.
 * Mirrors `KanbanEventKind` minus `urgent_on` / `urgent_off` — no
 * urgent-flip mutation exists yet (it lands in a follow-up atom).
 */
export type KanbanSystemEvent =
  | { kind: 'column_move'; newColumnId: string }
  | { kind: 'status_change'; newStatus: RequestStatus }
  | { kind: 'title_edit' }
  | { kind: 'body_edit' }
  | { kind: 'share_to_team'; targetGroupId: string }
  | { kind: 'assign_self' }
  | { kind: 'unassign_self' };

export interface EmitKanbanSystemEventInput {
  requestId: string;
  actorId: string;
  event: KanbanSystemEvent;
}

export async function emitKanbanSystemEvent(input: EmitKanbanSystemEventInput): Promise<void> {
  const eventKind = toKanbanEventKind(input.event.kind);
  if (!(await isEventEnabled(eventKind))) return;

  const body = await buildBody(input.actorId, input.event);
  if (body === null) return;

  await prisma.comment.create({
    data: {
      requestId: input.requestId,
      authorId: input.actorId,
      body,
      kind: 'comment',
      source: 'system',
    },
  });
}

function toKanbanEventKind(kind: KanbanSystemEvent['kind']): KanbanEventKind {
  switch (kind) {
    case 'column_move':
      return 'column_move';
    case 'status_change':
      return 'status_change';
    case 'title_edit':
      return 'title_edit';
    case 'body_edit':
      return 'body_edit';
    case 'share_to_team':
      return 'share_to_team';
    case 'assign_self':
      return 'assign_self';
    case 'unassign_self':
      return 'unassign_self';
  }
}

async function buildBody(actorId: string, event: KanbanSystemEvent): Promise<string | null> {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { displayName: true },
  });
  if (!actor) return null;
  const name = actor.displayName;

  switch (event.kind) {
    case 'column_move': {
      const column = await prisma.boardColumn.findUnique({
        where: { id: event.newColumnId },
        select: { displayName: true },
      });
      if (!column) return null;
      return `${name} moved this to ${column.displayName}.`;
    }
    case 'status_change':
      return `${name} set status to ${capitalise(event.newStatus)}.`;
    case 'title_edit':
      return `${name} renamed this ticket.`;
    case 'body_edit':
      return `${name} updated the description.`;
    case 'share_to_team': {
      const group = await prisma.group.findUnique({
        where: { id: event.targetGroupId },
        select: { displayName: true },
      });
      if (!group) return null;
      return `${name} shared this with ${group.displayName}.`;
    }
    case 'assign_self':
      return `${name} claimed this ticket.`;
    case 'unassign_self':
      return `${name} unclaimed this ticket.`;
  }
}

function capitalise(value: string): string {
  const head = value.charAt(0);
  return head ? head.toUpperCase() + value.slice(1) : value;
}
