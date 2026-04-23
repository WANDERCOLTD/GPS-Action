/**
 * Root tRPC router.
 * Feature routers merge here. Keep this file small.
 */

import { router } from '@/server/lib/trpc';
import { pingRouter } from './ping';

export const appRouter = router({
  ping: pingRouter,
  // Future routers: posts, users, dispatch, vetting, etc.
});

export type AppRouter = typeof appRouter;
