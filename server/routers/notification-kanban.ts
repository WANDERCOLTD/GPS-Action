/**
 * @build-unit bu-coordination-board (build seq #3 — routers)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0008
 *
 * Notifications-kanban router — Surface 3 inbox + lifecycle gestures.
 * Wraps `server/services/notifications-kanban.ts`. Coexists with the
 * legacy notification router (which reads `readAt` / `type`) — this
 * one reads `lifecycle` / `reasonKind`.
 *
 * Emit + fan-out helpers are server-side only (called from other
 * services) and intentionally NOT exposed via tRPC.
 */

import { z } from 'zod';
import { router, authedProcedure } from '@/server/lib/trpc';
import {
  acknowledgeNotification,
  dismissNotification,
  listKanbanInboxForUser,
  countNewForUser,
  type KanbanNotificationSummary,
} from '@/server/services/notifications-kanban';

const notificationIdSchema = z.object({ notificationId: z.string().min(1) });

const inboxSchema = z.object({
  scope: z.enum(['new', 'active', 'all']).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export const notificationKanbanRouter = router({
  /** Click-through: lifecycle = new → acknowledged + readAt = now(). */
  acknowledge: authedProcedure.input(notificationIdSchema).mutation(async ({ ctx, input }) => {
    return acknowledgeNotification({
      notificationId: input.notificationId,
      userId: ctx.user.id,
    });
  }),

  /** Swipe: lifecycle in [new, acknowledged] → dismissed + readAt = now(). */
  dismiss: authedProcedure.input(notificationIdSchema).mutation(async ({ ctx, input }) => {
    return dismissNotification({
      notificationId: input.notificationId,
      userId: ctx.user.id,
    });
  }),

  /**
   * Surface 3 inbox. Default scope is 'active' (excludes dismissed) per
   * the brief's "tinted = unacknowledged, plain = acknowledged" model.
   */
  inbox: authedProcedure
    .input(inboxSchema)
    .query(async ({ ctx, input }): Promise<KanbanNotificationSummary[]> => {
      return listKanbanInboxForUser({
        userId: ctx.user.id,
        scope: input.scope,
        limit: input.limit,
      });
    }),

  /** Drives the AppNav badge on Surface 3. */
  newCount: authedProcedure.query(async ({ ctx }) => {
    const count = await countNewForUser(ctx.user.id);
    return { count };
  }),
});
