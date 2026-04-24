/**
 * @build-unit BU-000-root
 * @spec architecture/api-contract.md
 *
 * Root tRPC router. Sub-routers merge here. Keep this file small.
 */

import { router } from '@/server/lib/trpc';

export const appRouter = router({
  // Feature routers land here: posts, users, dispatch, vetting, etc.
});

export type AppRouter = typeof appRouter;
