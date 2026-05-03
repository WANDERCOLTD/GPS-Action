'use server';

/**
 * @build-unit BU-search-surface
 * @spec architecture/decision-log.md (D078)
 *
 * Server actions for the `/search` route. Wraps the tRPC caller so the
 * client component can run a query without the codebase taking a
 * tRPC-client dependency. Visibility filtering for posts is enforced
 * server-side via the shared `getPostVisibilityFilter` helper, reached
 * through `caller.search.query` (D078 §5).
 */

import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import type { SearchResults } from '@/server/routers/search';
import type { SearchEntityType } from '@/shared/validation/search';

export interface RunSearchInput {
  q: string;
  type?: SearchEntityType;
  limit?: number;
}

export async function runSearch(input: RunSearchInput): Promise<SearchResults> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  return caller.search.query({
    q: input.q,
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
  });
}
