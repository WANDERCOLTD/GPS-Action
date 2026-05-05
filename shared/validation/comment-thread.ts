/**
 * @build-unit bu-coordination-board (atom 5d-2)
 * @spec docs/build/session-handoffs/parallel-stream-b-comment-thread-2026-05-05.md
 *
 * Zod schemas for the kanban-ticket comment / note compose router.
 * Body length cap mirrors `shared/validation/comment.ts` (5000 chars).
 */

import { z } from 'zod';

const COMMENT_THREAD_BODY_MIN = 1;
const COMMENT_THREAD_BODY_MAX = 5000;

export const commentThreadAddSchema = z.object({
  requestId: z.string().min(1),
  body: z.string().trim().min(COMMENT_THREAD_BODY_MIN).max(COMMENT_THREAD_BODY_MAX),
});

export const commentThreadListSchema = z.object({
  requestId: z.string().min(1),
  viewerGroupId: z.string().min(1),
});

export type CommentThreadAddInput = z.infer<typeof commentThreadAddSchema>;
export type CommentThreadListInput = z.infer<typeof commentThreadListSchema>;
