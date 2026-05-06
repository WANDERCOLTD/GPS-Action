/**
 * @build-unit bu-coordination-board (Surface 1 — propose-to-backlog)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Zod schemas for the board router. Today: just the propose-to-backlog
 * input. Title + body length caps mirror `editTitle` / `editBody`
 * (200 / 10 000 chars) so the propose flow can't outsize what the
 * detail-page editor allows.
 */

import { z } from 'zod';

const TITLE_MIN = 1;
const TITLE_MAX = 200;
const BODY_MAX = 10000;

export const boardProposeSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().trim().min(TITLE_MIN).max(TITLE_MAX),
  /** null clears (matches the EditableTicketBody empty-state). */
  body: z.string().max(BODY_MAX).nullable(),
});

export type BoardProposeInput = z.infer<typeof boardProposeSchema>;

/**
 * Quick-add: creates a ticket directly in a column on the Active board
 * (status='active', columnId=X), skipping the backlog triage step.
 * Body is omitted on the quick path — author can fill it in on Surface 2
 * after creation.
 */
export const boardQuickAddSchema = z.object({
  groupId: z.string().min(1),
  columnId: z.string().min(1),
  title: z.string().trim().min(TITLE_MIN).max(TITLE_MAX),
});

export type BoardQuickAddInput = z.infer<typeof boardQuickAddSchema>;
