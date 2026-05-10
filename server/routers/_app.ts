/**
 * @build-unit BU-000-root
 * @spec architecture/api-contract.md
 *
 * Root tRPC router. Sub-routers merge here. Keep this file small.
 * Dev router is conditionally registered — unreachable in production.
 */

import { router, createCallerFactory } from '@/server/lib/trpc';
import { devRouter } from '@/server/routers/dev';
import { postRouter } from '@/server/routers/post';
import { postKindRouter } from '@/server/routers/postKind';
import { reactionRouter } from '@/server/routers/reaction';
import { commentRouter } from '@/server/routers/comment';
import { commentThreadRouter } from '@/server/routers/comment-thread';
import { requestRouter } from '@/server/routers/request';
import { assignmentRouter } from '@/server/routers/assignment';
import { subscriptionRouter } from '@/server/routers/subscription';
import { boardRouter } from '@/server/routers/board';
import { boardColumnRouter } from '@/server/routers/board-column';
import { groupKanbanRouter } from '@/server/routers/group-kanban';
import { shareRouter } from '@/server/routers/share';
import { notificationKanbanRouter } from '@/server/routers/notification-kanban';
import { adminRouter } from '@/server/routers/admin';
import { searchRouter } from '@/server/routers/search';
import { networkRouter } from '@/server/routers/network';
import { isDemoMode } from '@/shared/demo-mode';

export const appRouter = router({
  // Dev-only router: user picker, login helpers. Unreachable in production
  // unless DEMO_MODE is enabled (BU-demo-mode).
  ...(process.env.NODE_ENV !== 'production' || isDemoMode() ? { dev: devRouter } : {}),
  // Feature routers
  post: postRouter,
  postKind: postKindRouter,
  reaction: reactionRouter,
  comment: commentRouter,
  commentThread: commentThreadRouter,
  request: requestRouter,
  assignment: assignmentRouter,
  subscription: subscriptionRouter,
  board: boardRouter,
  boardColumn: boardColumnRouter,
  groupKanban: groupKanbanRouter,
  share: shareRouter,
  notificationKanban: notificationKanbanRouter,
  admin: adminRouter,
  search: searchRouter,
  network: networkRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller factory. Used by server components to call procedures. */
export const createCaller = createCallerFactory(appRouter);
