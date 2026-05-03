/**
 * @build-unit BU-search-surface BU-search-result-cards
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

// Re-export the per-entity hit types so /app and /components can
// consume them without crossing the /app → /server/services boundary.
// The router is the natural seam (BU-search-surface PR D shipped the
// generic `SearchHit`; BU-search-result-cards split it per entity to
// support the canonical row primitives).
export type {
  SearchResults,
  PostSearchHit,
  PersonSearchHit,
  RegionSearchHit,
  PartnerOrgSearchHit,
  SearchAuthorRole,
} from '@/server/services/search';

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
