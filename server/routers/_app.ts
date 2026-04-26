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
import { reactionRouter } from '@/server/routers/reaction';
import { commentRouter } from '@/server/routers/comment';
import { requestRouter } from '@/server/routers/request';

export const appRouter = router({
  // Dev-only router: user picker, login helpers. Unreachable in production.
  ...(process.env.NODE_ENV !== 'production' ? { dev: devRouter } : {}),
  // Feature routers
  post: postRouter,
  reaction: reactionRouter,
  comment: commentRouter,
  request: requestRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller factory. Used by server components to call procedures. */
export const createCaller = createCallerFactory(appRouter);
