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
  /**
   * Row-level updated timestamp (Prisma `@updatedAt`). Drives the
   * "(edited)" marker per ADR-0016 §1 — when `updatedAt > createdAt`
   * by more than a small epsilon the UI renders the marker.
   */
  updatedAt: Date;
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
    updatedAt: row.updatedAt,
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

// ── Edit / Delete (ADR-0016 / D082) ──────────────────────────────────────

/**
 * Edit-gate / delete-gate violation. Mapped to a tRPC error code in the
 * router layer; thrown by the service so call paths from outside the
 * router (admin tooling, batch scripts) hit the same invariant.
 */
export class CommentMutationGateError extends Error {
  constructor(
    public readonly reason: 'not_found' | 'not_request_comment' | 'not_author' | 'not_human_source',
    message?: string,
  ) {
    super(message ?? reason);
    this.name = 'CommentMutationGateError';
  }
}

export interface EditCommentForKanbanInput {
  commentId: string;
  actorUserId: string;
  body: string;
}

export interface DeleteCommentForKanbanInput {
  commentId: string;
  actorUserId: string;
}

/**
 * Author-only edit on a Request comment. Service-layer enforces the
 * same gate as the router (defence-in-depth per ADR-0016 §3): the
 * comment must exist, target a Request (not a Post), be authored by
 * the actor, and have `source = 'human'`. System rows are foreclosed
 * from edit by construction.
 *
 * On success bumps `Request.lastActivityAt` (per ADR-0015 — editing a
 * comment is a visible-activity event) and writes an `AuditLog` row
 * with action code `kanban_comment.edit` (or `.note.edit` when
 * `kind = 'note'`).
 */
export async function editCommentForKanbanTicket(
  input: EditCommentForKanbanInput,
): Promise<{ id: string }> {
  const existing = await prisma.comment.findUnique({
    where: { id: input.commentId },
    select: {
      id: true,
      postId: true,
      requestId: true,
      authorId: true,
      kind: true,
      source: true,
      body: true,
    },
  });
  if (!existing || existing.requestId === null) {
    if (!existing) {
      throw new CommentMutationGateError('not_found', 'Comment not found.');
    }
    throw new CommentMutationGateError(
      'not_request_comment',
      'Edit / delete is scoped to Request comments per D082.',
    );
  }
  if (existing.source !== 'human') {
    throw new CommentMutationGateError('not_human_source', 'System rows cannot be edited.');
  }
  if (existing.authorId !== input.actorUserId) {
    throw new CommentMutationGateError('not_author', 'Only the author can edit this comment.');
  }

  const trimmed = input.body.trim();
  const previousLength = existing.body.length;

  const updated = await prisma.comment.update({
    where: { id: existing.id },
    data: { body: trimmed },
    select: { id: true },
  });

  await touchRequestActivity(prisma, existing.requestId);

  await auditLog({
    action: existing.kind === 'note' ? 'kanban_comment.note.edit' : 'kanban_comment.edit',
    entityType: 'comment',
    entityId: existing.id,
    userId: input.actorUserId,
    changes: {
      requestId: existing.requestId,
      kind: existing.kind,
      previousBodyLength: previousLength,
      bodyLength: trimmed.length,
    },
  });

  return updated;
}

/**
 * Author-only hard-delete on a Request comment. Same gate as edit.
 * On success the row is removed (no `deletedAt` tombstone — per
 * ADR-0016 §1, `deleteOwn` is a real DELETE for v1). Bumps
 * `Request.lastActivityAt` per ADR-0015 — the team has done something
 * visible. (Item 14 of the brief excludes `deleteComment` from the
 * bump matrix; ADR-0015 §"Bump events" includes it implicitly. The
 * brief is the authoritative scope; the bump is intentionally
 * skipped here per Item 14: "delete should NOT bump — deleting
 * shouldn't make a ticket look 'fresh'".)
 */
export async function deleteCommentForKanbanTicket(
  input: DeleteCommentForKanbanInput,
): Promise<{ id: string }> {
  const existing = await prisma.comment.findUnique({
    where: { id: input.commentId },
    select: {
      id: true,
      postId: true,
      requestId: true,
      authorId: true,
      kind: true,
      source: true,
      body: true,
    },
  });
  if (!existing || existing.requestId === null) {
    if (!existing) {
      throw new CommentMutationGateError('not_found', 'Comment not found.');
    }
    throw new CommentMutationGateError(
      'not_request_comment',
      'Edit / delete is scoped to Request comments per D082.',
    );
  }
  if (existing.source !== 'human') {
    throw new CommentMutationGateError('not_human_source', 'System rows cannot be deleted.');
  }
  if (existing.authorId !== input.actorUserId) {
    throw new CommentMutationGateError('not_author', 'Only the author can delete this comment.');
  }

  await prisma.comment.delete({
    where: { id: existing.id },
  });

  // Item 14 of bu-ticket-view-fixes — delete does NOT bump
  // `lastActivityAt`. Removing content shouldn't make a ticket look
  // fresh.

  await auditLog({
    action: existing.kind === 'note' ? 'kanban_comment.note.delete' : 'kanban_comment.delete',
    entityType: 'comment',
    entityId: existing.id,
    userId: input.actorUserId,
    changes: {
      requestId: existing.requestId,
      kind: existing.kind,
      previousBodyLength: existing.body.length,
    },
  });

  return { id: existing.id };
}
