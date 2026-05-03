/**
 * @build-unit BU-search-surface
 * @spec architecture/decision-log.md (D078)
 * @spec adrs/0004-search-trigram-indexes.md
 * @spec build/session-briefs/bu-search-surface.md
 * @spec product/scenarios.md (SCN-31)
 *
 * Search page — server entry. Two modes:
 *
 *  - **Typeahead mode** (no `?type=`): renders the shell. Results are
 *    fetched client-side via the `runSearch` server action as the
 *    member types.
 *  - **Full mode** (`?type=<group>`): server-renders the selected
 *    group up to 50 hits so first paint is filled. Subsequent client-
 *    side query edits refetch.
 *
 * Auth-gated. Reads `?filter=` to hydrate the scope chip when search
 * was opened from a filtered feed (D078 §7), `?q=` for URL-addressable
 * result sets, and `?type=` for full mode.
 */

import { redirect } from 'next/navigation';
import { createTRPCContext } from '@/server/routers/context';
import { isFeedFilter, type FeedFilter } from '@/shared/feed-filters';
import { SEARCH_ENTITY_TYPES, type SearchEntityType } from '@/shared/validation/search';
import { SearchShell } from '@/components/SearchShell';
import { runSearch } from '@/app/search/actions';
import type { SearchResults } from '@/server/routers/search';

export const metadata = {
  title: 'Search — GPS Action',
};

interface PageProps {
  searchParams: Promise<{
    filter?: string | string[];
    q?: string | string[];
    type?: string | string[];
  }>;
}

function pickFirst(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

function pickInheritedFilter(raw: string | undefined): Exclude<FeedFilter, 'all'> | null {
  if (!raw) return null;
  if (!isFeedFilter(raw)) return null;
  return raw === 'all' ? null : raw;
}

function pickEntityType(raw: string | undefined): SearchEntityType | undefined {
  if (!raw) return undefined;
  return (SEARCH_ENTITY_TYPES as readonly string[]).includes(raw)
    ? (raw as SearchEntityType)
    : undefined;
}

function pickOpenedSource(
  hasQuery: boolean,
  filter: Exclude<FeedFilter, 'all'> | null,
): 'appnav' | 'deep_link' | 'scope_chip' {
  if (hasQuery) return 'deep_link';
  if (filter !== null) return 'scope_chip';
  return 'appnav';
}

export default async function SearchPage({ searchParams }: PageProps) {
  const ctx = await createTRPCContext();

  if (!ctx.user) {
    redirect('/dev/login?returnTo=/search');
  }

  const params = await searchParams;
  const initialFilter = pickInheritedFilter(pickFirst(params.filter));
  const initialQuery = (pickFirst(params.q) ?? '').slice(0, 120);
  const selectedType = pickEntityType(pickFirst(params.type));
  const mode = selectedType ? 'full' : 'typeahead';
  const openedSource = pickOpenedSource(initialQuery.length >= 2, initialFilter);

  // Full mode: server-fetch the one group's results so first paint is
  // populated. Typeahead mode renders the shell empty and lets the
  // client fetch as the member types.
  let initialResults: SearchResults | null = null;
  if (mode === 'full' && selectedType && initialQuery.length >= 2) {
    initialResults = await runSearch({
      q: initialQuery,
      type: selectedType,
      limit: 50,
    });
  }

  return (
    <SearchShell
      mode={mode}
      initialFilter={initialFilter}
      initialQuery={initialQuery}
      initialResults={initialResults}
      {...(selectedType !== undefined ? { selectedType } : {})}
      openedSource={openedSource}
      runSearch={runSearch}
    />
  );
}
