/**
 * @build-unit bu-coordination-board (build seq #5 — Surface 2, atom 5d-1)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 * @spec docs/build/session-handoffs/parallel-stream-b-comment-thread-2026-05-05.md
 * @adr 0007
 *
 * Comment thread read query for the kanban ticket-detail surface.
 *
 * Returns the interleaved Comment + Note + System-event rows for a
 * Request, oldest-first, with the visibility filter:
 *
 *   - `Comment.kind = 'note'` rows are hidden from members of shared
 *     groups. Only members of the *originating* group see notes.
 *   - `Comment.kind = 'comment'` is visible to any viewer the router
 *     has already gated on (member of any active link, or admin).
 *
 * Originating group resolution: the `RequestGroup` row with
 * `origin = 'originating'` (per ADR-0009 invariant). When the viewer's
 * group equals that originating group, they see notes; otherwise the
 * `kind` filter narrows to comments only.
 *
 * Layer boundary: services → db + lib + shared only. Caller (router)
 * gates membership in `viewerGroupId` upstream; this service trusts that.
 */

import type { CommentKind, CommentSource } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { auditLog } from '@/server/services/audit';
import { touchRequestActivity } from '@/server/services/request-activity';

export interface CommentThreadAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CommentThreadRow {
  id: string;
  body: string;
  kind: CommentKind;
  source: CommentSource;
  createdAt: Date;
  author: CommentThreadAuthor;
}

export interface ListForKanbanTicketInput {
  requestId: string;
  /**
   * The group whose board the viewer is acting on. Must equal the
   * Request's originating group for the viewer to see internal notes.
   */
  viewerGroupId: string;
  viewerId: string;
}

export async function listForKanbanTicket(
  input: ListForKanbanTicketInput,
): Promise<CommentThreadRow[]> {
  const originatingLink = await prisma.requestGroup.findFirst({
    where: {
      requestId: input.requestId,
      origin: 'originating',
      deletedAt: null,
    },
    select: { groupId: true },
  });

  const seesNotes = originatingLink?.groupId === input.viewerGroupId;
  const kindFilter: CommentKind[] = seesNotes ? ['comment', 'note'] : ['comment'];

  const rows = await prisma.comment.findMany({
    where: {
      requestId: input.requestId,
      deletedAt: null,
      kind: { in: kindFilter },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      author: {
        select: { id: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    kind: row.kind,
    source: row.source,
    createdAt: row.createdAt,
    author: {
      id: row.author.id,
      displayName: row.author.displayName,
      avatarUrl: row.author.avatarUrl,
    },
  }));
}

// ── Permission gate (atom 5d-2) ──────────────────────────────────────────

export interface CommentThreadAccess {
  /** Viewer is a member of any active linked group OR system admin. */
  canComment: boolean;
  /**
   * Viewer is a member of the originating group OR system admin.
   * Gates note compose. Without this, a shared-team author would create
   * a "ghost note" — invisible to themselves on the next page load.
   */
  canPostNote: boolean;
}

export interface CommentThreadAccessInput {
  requestId: string;
  userId: string;
  isSystemAdmin: boolean;
}

/**
 * Resolve compose access for a kanban ticket. The router uses this to
 * gate `postComment` (canComment) and `postNote` (canPostNote).
 *
 * System admins bypass the membership check on both — consistent with
 * the kanban surface's permission table where sysadmin sees and acts on
 * any board.
 */
export async function getCommentThreadAccess(
  input: CommentThreadAccessInput,
): Promise<CommentThreadAccess> {
  if (input.isSystemAdmin) {
    return { canComment: true, canPostNote: true };
  }

  const links = await prisma.requestGroup.findMany({
    where: { requestId: input.requestId, deletedAt: null },
    select: { groupId: true, origin: true },
  });
  if (links.length === 0) {
    return { canComment: false, canPostNote: false };
  }

  const memberships = await prisma.groupMembership.findMany({
    where: {
      userId: input.userId,
      groupId: { in: links.map((l) => l.groupId) },
      leftAt: null,
      deletedAt: null,
    },
    select: { groupId: true },
  });
  if (memberships.length === 0) {
    return { canComment: false, canPostNote: false };
  }

  const memberGroupIds = new Set(memberships.map((m) => m.groupId));
  const originating = links.find((l) => l.origin === 'originating');
  const canPostNote = originating !== undefined && memberGroupIds.has(originating.groupId);

  return { canComment: true, canPostNote };
}

// ── Compose (atom 5d-2) ──────────────────────────────────────────────────

export interface CreateCommentForKanbanInput {
  requestId: string;
  authorId: string;
  body: string;
  kind: CommentKind;
}

/**
 * Write a Comment row attached to a kanban Request. `source` is forced
 * to `'human'` — the system-event hook (atom 5d-3) writes its own rows
 * with `source = 'system'`.
 *
 * Caller (router) has already gated permission via `getCommentThreadAccess`.
 * This service trusts that gate.
 */
export async function createCommentForKanbanTicket(
  input: CreateCommentForKanbanInput,
): Promise<{ id: string }> {
  const request = await prisma.request.findFirst({
    where: { id: input.requestId, deletedAt: null },
    select: { id: true },
  });
  if (!request) {
    throw new Error('Request not found or deleted');
  }

  const created = await prisma.comment.create({
    data: {
      requestId: input.requestId,
      authorId: input.authorId,
      body: input.body.trim(),
      kind: input.kind,
      source: 'human',
    },
    select: { id: true },
  });

  // ADR-0015 — comment / note posted is a visible-activity event.
  await touchRequestActivity(prisma, input.requestId);

  await auditLog({
    action: input.kind === 'note' ? 'kanban_note.add' : 'kanban_comment.add',
    entityType: 'comment',
    entityId: created.id,
    userId: input.authorId,
    changes: {
      requestId: input.requestId,
      kind: input.kind,
      bodyLength: input.body.length,
    },
  });

  return created;
}
