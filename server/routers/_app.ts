/**
 * @build-unit BU-000-root
 * @spec architecture/api-contract.md
 *
 * Root tRPC router. Sub-routers merge here. Keep this file small.
 * Dev router is conditionally registered — unreachable in production.
 */

import { router, createCallerFactory } from '@/server/lib/trpc';
import { devRouter } from '@/server/routers/dev';

export const appRouter = router({
  // Dev-only router: user picker, login helpers. Unreachable in production.
  ...(process.env.NODE_ENV !== 'production' ? { dev: devRouter } : {}),
  // Feature routers land here: posts, users, dispatch, vetting, etc.
});

export type AppRouter = typeof appRouter;

/** Server-side caller factory. Used by server components to call procedures. */
export const createCaller = createCallerFactory(appRouter);
