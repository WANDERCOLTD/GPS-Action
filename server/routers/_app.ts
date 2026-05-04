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
import { requestRouter } from '@/server/routers/request';
import { assignmentRouter } from '@/server/routers/assignment';
import { subscriptionRouter } from '@/server/routers/subscription';
import { adminRouter } from '@/server/routers/admin';
import { searchRouter } from '@/server/routers/search';
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
  request: requestRouter,
  assignment: assignmentRouter,
  subscription: subscriptionRouter,
  admin: adminRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller factory. Used by server components to call procedures. */
export const createCaller = createCallerFactory(appRouter);
