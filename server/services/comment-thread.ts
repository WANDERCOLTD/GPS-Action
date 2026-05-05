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
