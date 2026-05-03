/**
 * @build-unit BU-search-surface
 * @spec D078 §1, §4, §5
 * @spec ADR-0004
 *
 * Search tRPC router. Single procedure: `query`.
 *
 * Public procedure (logged-out callers can search) — visibility filtering
 * is enforced inside the service via the shared
 * `getPostVisibilityFilter` helper (D078 §5). Members-only posts are
 * never returned for unauthenticated callers.
 */

import { router, publicProcedure } from '@/server/lib/trpc';
import { searchAll } from '@/server/services/search';
import { searchQuerySchema } from '@/shared/validation/search';

// BU-search-surface PR D: re-export the result-shape types so /app and
// /components can consume them without crossing the /app → /server/services
// layer boundary. The router is the natural seam.
export type { SearchHit, SearchResults } from '@/server/services/search';

export const searchRouter = router({
  query: publicProcedure.input(searchQuerySchema).query(async ({ ctx, input }) => {
    return searchAll({
      q: input.q,
      type: input.type,
      limit: input.limit,
      callerId: ctx.user?.id ?? null,
    });
  }),
});
