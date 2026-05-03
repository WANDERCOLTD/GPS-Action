/**
 * @build-unit BU-search-surface
 * @spec architecture/decision-log.md (D078)
 * @spec adrs/0004-search-trigram-indexes.md
 * @spec build/session-briefs/bu-search-surface.md
 * @spec product/scenarios.md (SCN-31)
 *
 * Search page — server entry. PR C of bu-search-surface ships only the
 * shell (header + autofocused input + scope chip + empty-state
 * placeholders); result rendering, telemetry, and recently-viewed
 * persistence land in PR D.
 *
 * Auth-gated. Reads `?filter=` to hydrate the scope chip when search
 * was opened from a filtered feed (D078 §7) and `?q=` for URL-
 * addressable result sets (D078 §7 — round-trip discipline). The
 * `all` filter is treated as no chip — same convention used by
 * `/feed`.
 */

import { redirect } from 'next/navigation';
import { createTRPCContext } from '@/server/routers/context';
import { isFeedFilter, type FeedFilter } from '@/shared/feed-filters';
import { SearchShell } from '@/components/SearchShell';

export const metadata = {
  title: 'Search — GPS Action',
};

interface PageProps {
  searchParams: Promise<{
    filter?: string | string[];
    q?: string | string[];
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

export default async function SearchPage({ searchParams }: PageProps) {
  const ctx = await createTRPCContext();

  if (!ctx.user) {
    redirect('/dev/login?returnTo=/search');
  }

  const params = await searchParams;
  const initialFilter = pickInheritedFilter(pickFirst(params.filter));
  const initialQuery = (pickFirst(params.q) ?? '').slice(0, 200);

  return <SearchShell initialFilter={initialFilter} initialQuery={initialQuery} />;
}
