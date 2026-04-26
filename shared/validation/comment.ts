/**
 * @build-unit BU-comments
 * @spec architecture/decision-log.md (D052)
 * @spec product/scenarios.md (SCN-20)
 *
 * Zod validation schemas for the comment tRPC router. Body length
 * caps at 5000 chars per D052; Zod rejects above. UI shows a soft
 * hint at 4000.
 */

import { z } from 'zod';

const COMMENT_BODY_MIN = 1;
const COMMENT_BODY_MAX = 5000;

export const commentAddSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(COMMENT_BODY_MIN).max(COMMENT_BODY_MAX),
});

export const commentListForPostSchema = z.object({
  postId: z.string().uuid(),
});

export type CommentAddInput = z.infer<typeof commentAddSchema>;
export type CommentListForPostInput = z.infer<typeof commentListForPostSchema>;
