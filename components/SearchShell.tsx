'use client';

/**
 * @build-unit BU-search-surface BU-search-result-cards
 * @spec architecture/decision-log.md (D078)
 * @spec adrs/0004-search-trigram-indexes.md
 * @spec build/session-briefs/bu-search-surface.md
 * @spec build/session-briefs/bu-search-result-cards.md
 * @spec product/scenarios.md (SCN-31)
 *
 * Client shell for the `/search` route. Two modes off the same
 * component:
 *
 *  - **Typeahead mode** (no `?type=`): debounced query against the
 *    server action, four grouped result sections (Posts → People →
 *    Regions → Partner orgs per D078 §4), cap 3 per group, "See all
 *    N <group>" link → full mode.
 *  - **Full mode** (`?type=<group>`): one group, server-rendered up to
 *    50, no infinite scroll (preserves "feed has an end").
 *
 * Zero-query empty state shows Recently viewed (last 5 from
 * `localStorage`, D078 §8) and a placeholder for Your regions. Typed
 * queries replace the empty state with grouped results or honest
 * "Nothing matching that yet…" copy.
 *
 * Telemetry: 4 events fire client-side (analytics-events.md). NEVER
 * include the raw query string — only `q_length` and enums (D078 +
 * the PII policy).
 */

import * as React from 'react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, X } from 'lucide-react';
import { HeaderRefreshButton } from '@/components/HeaderRefreshButton';
import { FEED_FILTER_LABELS, type FeedFilter } from '@/shared/feed-filters';
import { SEARCH_ENTITY_TYPES, type SearchEntityType } from '@/shared/validation/search';
import type { SearchResults } from '@/server/routers/search';
import {
  SearchPostHitRow,
  SearchPersonHitRow,
  SearchRegionHitRow,
} from '@/components/SearchHitRows';
import { readRecentlyViewed, type RecentlyViewedItem } from '@/components/recently-viewed-posts';
import { emitSearchEvent } from '@/components/search-telemetry';

// ── Types ───────────────────────────────────────────────────────────────

export type SearchShellMode = 'typeahead' | 'full';

interface SearchShellProps {
  /** Mode. Server picks based on whether `?type=` is set. */
  mode?: SearchShellMode;
  /** Filter inherited from referring feed. `null` if app-wide. */
  initialFilter?: Exclude<FeedFilter, 'all'> | null;
  /** Initial query from `?q=`. */
  initialQuery?: string;
  /**
   * Initial server-rendered results. In full mode, the page does an
   * SSR fetch so first paint shows results without a client round-
   * trip. In typeahead mode, this is `null`.
   */
  initialResults?: SearchResults | null;
  /** Active group in full mode. */
  selectedType?: SearchEntityType;
  /** Entry source for the `search_opened` telemetry event. */
  openedSource?: 'appnav' | 'deep_link' | 'scope_chip';
  /** Server action for client-side requeries. Page wires this. */
  runSearch: (input: {
    q: string;
    type?: SearchEntityType;
    limit?: number;
  }) => Promise<SearchResults>;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 150;
const TYPEAHEAD_GROUP_CAP = 3;
const FULL_MODE_LIMIT = 50;

// Group order is fixed by D078 §4 — clients render in receipt order.
const GROUPS: ReadonlyArray<{
  key: SearchEntityType;
  label: string;
  pluralised: (n: number) => string;
}> = [
  { key: 'posts', label: 'Posts', pluralised: (n) => (n === 1 ? '1 post' : `${n} posts`) },
  { key: 'people', label: 'People', pluralised: (n) => (n === 1 ? '1 person' : `${n} people`) },
  { key: 'regions', label: 'Regions', pluralised: (n) => (n === 1 ? '1 region' : `${n} regions`) },
  {
    key: 'partnerOrgs',
    label: 'Partner orgs',
    pluralised: (n) => (n === 1 ? '1 partner org' : `${n} partner orgs`),
  },
];

// ── Styles ──────────────────────────────────────────────────────────────

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--colour-border-subtle)',
  background: 'var(--colour-surface-raised)',
};

const backButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 44,
  height: 44,
  padding: 0,
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--colour-text-link)',
  cursor: 'pointer',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-md)',
  fontWeight: 'var(--weight-semibold)',
  fontFamily: 'var(--font-ui)',
  color: 'var(--colour-text-primary)',
};

const inputWrapperStyle: CSSProperties = {
  padding: 'var(--space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: 'var(--space-3) var(--space-4)',
  fontSize: 'var(--text-md)',
  fontFamily: 'var(--font-ui)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--colour-border-subtle)',
  background: 'var(--colour-surface-base)',
  color: 'var(--colour-text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
};

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--colour-surface-sunken)',
  color: 'var(--colour-text-primary)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  border: 'none',
  cursor: 'pointer',
  alignSelf: 'flex-start',
};

const sectionStyle: CSSProperties = {
  padding: 'var(--space-4)',
  borderTop: '1px solid var(--colour-border-subtle)',
};

const sectionHeadingRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 'var(--space-2)',
  marginBottom: 'var(--space-2)',
};

const sectionHeadingStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--colour-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const seeAllLinkStyle: CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-text-link)',
  textDecoration: 'none',
};

const placeholderCopyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--colour-text-secondary)',
  fontSize: 'var(--text-sm)',
};

const resultListStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const resultItemLinkStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  padding: 'var(--space-2) 0',
  color: 'var(--colour-text-primary)',
  textDecoration: 'none',
};

const resultLabelStyle: CSSProperties = {
  fontSize: 'var(--text-md)',
  fontWeight: 'var(--weight-medium)',
};

const noResultsStyle: CSSProperties = {
  padding: 'var(--space-6) var(--space-4)',
  textAlign: 'center' as const,
  color: 'var(--colour-text-secondary)',
};

const fullModeLimitNoticeStyle: CSSProperties = {
  ...placeholderCopyStyle,
  fontStyle: 'italic',
};

// ── Component ──────────────────────────────────────────────────────────

const EMPTY_RESULTS: SearchResults = {
  posts: [],
  people: [],
  regions: [],
  partnerOrgs: [],
};

export function SearchShell({
  mode = 'typeahead',
  initialFilter = null,
  initialQuery = '',
  initialResults = null,
  selectedType,
  openedSource = 'appnav',
  runSearch,
}: SearchShellProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<Exclude<FeedFilter, 'all'> | null>(initialFilter);
  const [results, setResults] = useState<SearchResults | null>(initialResults);
  const [isLoading, setIsLoading] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);

  const fetchTokenRef = useRef(0);
  const lastSubmittedRef = useRef<string | null>(null);

  // Hydrate recently-viewed from localStorage AFTER mount (avoids SSR
  // hydration mismatch — server renders with `[]`, client fills in).
  useEffect(() => {
    setRecentlyViewed(readRecentlyViewed());
  }, []);

  // Telemetry: fire `search_opened` once per mount. The `openedSource`
  // is determined by the page based on referrer / query state.
  useEffect(() => {
    emitSearchEvent({ event: 'search_opened', source: openedSource });
  }, [openedSource]);

  // Debounced typeahead fetch. In full mode the URL drives results
  // (the page server-renders), so we don't run this loop there.
  useEffect(() => {
    if (mode !== 'typeahead') return;
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setIsLoading(false);
      lastSubmittedRef.current = null;
      return;
    }
    const token = ++fetchTokenRef.current;
    setIsLoading(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const fetched = await runSearch({ q: trimmed });
          if (fetchTokenRef.current !== token) return; // stale
          setResults(fetched);
          // Telemetry: fire once per debounced submission. Use the
          // ref to avoid double-firing for the same trimmed query.
          if (lastSubmittedRef.current !== trimmed) {
            lastSubmittedRef.current = trimmed;
            emitSearchEvent({
              event: 'search_query_submitted',
              q_length: trimmed.length,
              has_scope_chip: filter !== null,
            });
          }
        } catch {
          if (fetchTokenRef.current !== token) return;
          setResults(EMPTY_RESULTS);
        } finally {
          if (fetchTokenRef.current === token) setIsLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [mode, query, filter, runSearch]);

  function dismissFilter(): void {
    setFilter(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('filter');
      window.history.replaceState(null, '', url.toString());
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    // Submit is a no-op — debounced effect runs queries. Prevents the
    // form from reloading the page when the keyboard "Search" is hit.
  }

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length >= MIN_QUERY_LENGTH;
  const totalHits = results
    ? results.posts.length +
      results.people.length +
      results.regions.length +
      results.partnerOrgs.length
    : 0;
  const showZeroState = mode === 'typeahead' && !hasQuery;
  const showResults = mode === 'full' || (mode === 'typeahead' && hasQuery && results !== null);
  const showNoResults = mode === 'typeahead' && hasQuery && results !== null && totalHits === 0;

  return (
    <main data-testid="search-shell">
      <div style={headerStyle} data-testid="search-header">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          data-testid="search-back-button"
          style={backButtonStyle}
        >
          <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
        </button>
        <h1 style={titleStyle} data-testid="search-title">
          {mode === 'full' && selectedType ? `Search · ${groupLabel(selectedType)}` : 'Search'}
        </h1>
        <div style={{ marginLeft: 'auto' }}>
          <HeaderRefreshButton />
        </div>
      </div>

      <form onSubmit={handleSubmit} style={inputWrapperStyle} data-testid="search-input-form">
        <input
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts, people, regions…"
          autoFocus
          autoComplete="off"
          inputMode="search"
          enterKeyHint="search"
          aria-label="Search query"
          data-testid="search-input-query"
          style={inputStyle}
        />
        {filter !== null && (
          <button
            type="button"
            onClick={dismissFilter}
            aria-label={`Remove ${FEED_FILTER_LABELS[filter]} scope`}
            data-testid="search-scope-chip"
            data-filter={filter}
            style={chipStyle}
          >
            <X size={14} strokeWidth={2} aria-hidden="true" />
            <span>{FEED_FILTER_LABELS[filter]}</span>
          </button>
        )}
      </form>

      {showZeroState && <ZeroState recentlyViewed={recentlyViewed} />}

      {showResults && results !== null && (
        <ResultsView
          mode={mode}
          query={trimmedQuery}
          filter={filter}
          results={results}
          selectedType={selectedType}
        />
      )}

      {showNoResults && (
        <p style={noResultsStyle} data-testid="search-no-results">
          Nothing matching that yet. Try a region name or a person.
        </p>
      )}

      {isLoading && mode === 'typeahead' && (
        <p style={noResultsStyle} aria-live="polite" data-testid="search-loading">
          Searching…
        </p>
      )}
    </main>
  );
}

function groupLabel(key: SearchEntityType): string {
  const found = GROUPS.find((g) => g.key === key);
  return found?.label ?? key;
}

// ── Sub-views ──────────────────────────────────────────────────────────

function ZeroState({ recentlyViewed }: { recentlyViewed: RecentlyViewedItem[] }) {
  return (
    <>
      <section style={sectionStyle} data-testid="search-empty-recently-viewed">
        <div style={sectionHeadingRowStyle}>
          <h2 style={sectionHeadingStyle}>Recently viewed</h2>
        </div>
        {recentlyViewed.length === 0 ? (
          <p style={placeholderCopyStyle}>
            Posts you open will appear here so you can find them again.
          </p>
        ) : (
          <ul style={resultListStyle} data-testid="search-recently-viewed-list">
            {recentlyViewed.map((item, idx) => (
              <li key={item.id}>
                <Link
                  href={`/post/${item.id}`}
                  style={resultItemLinkStyle}
                  data-testid="search-recently-viewed-item"
                  data-position={idx}
                >
                  <span style={resultLabelStyle}>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={sectionStyle} data-testid="search-empty-your-regions">
        <h2 style={sectionHeadingStyle}>Your regions</h2>
        <p style={placeholderCopyStyle}>Region shortcuts will appear here.</p>
      </section>
    </>
  );
}

interface ResultsViewProps {
  mode: SearchShellMode;
  query: string;
  filter: Exclude<FeedFilter, 'all'> | null;
  results: SearchResults;
  selectedType?: SearchEntityType;
}

function ResultsView({ mode, query, filter, results, selectedType }: ResultsViewProps) {
  const groupsToRender = useMemo(() => {
    if (mode === 'full' && selectedType) {
      return GROUPS.filter((g) => g.key === selectedType);
    }
    return GROUPS;
  }, [mode, selectedType]);

  return (
    <>
      {groupsToRender.map((group, groupPosition) => {
        const hitsCount = results[group.key].length;
        if (mode === 'typeahead' && hitsCount === 0) return null;

        const cap = mode === 'full' ? FULL_MODE_LIMIT : TYPEAHEAD_GROUP_CAP;
        const showSeeAll = mode === 'typeahead' && hitsCount > 0;

        return (
          <section
            key={group.key}
            style={sectionStyle}
            data-testid="search-results-section"
            data-entity-type={group.key}
          >
            <div style={sectionHeadingRowStyle}>
              <h2 style={sectionHeadingStyle}>{group.label}</h2>
              {showSeeAll && (
                <Link
                  href={fullResultsHref(query, group.key, filter)}
                  style={seeAllLinkStyle}
                  data-testid="search-see-all-link"
                  data-entity-type={group.key}
                  onClick={() =>
                    emitSearchEvent({
                      event: 'search_see_all_clicked',
                      entity_type: group.key,
                    })
                  }
                >
                  See all {group.pluralised(hitsCount)}
                </Link>
              )}
            </div>
            {mode === 'full' && hitsCount === 0 ? (
              <p style={placeholderCopyStyle} data-testid="search-results-empty-group">
                Nothing matching that yet. Try a region name or a person.
              </p>
            ) : (
              <ResultList
                results={results}
                entityType={group.key}
                cap={cap}
                groupPosition={groupPosition}
              />
            )}
            {mode === 'full' && hitsCount === FULL_MODE_LIMIT && (
              <p style={fullModeLimitNoticeStyle} data-testid="search-results-limit-notice">
                Showing the first {FULL_MODE_LIMIT}. Refine your query for narrower results.
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}

interface ResultListProps {
  results: SearchResults;
  entityType: SearchEntityType;
  cap: number;
  groupPosition: number;
}

function ResultList({ results, entityType, cap, groupPosition }: ResultListProps) {
  const fireClick = (idx: number) => () =>
    emitSearchEvent({
      event: 'search_result_clicked',
      entity_type: entityType,
      position_in_group: idx,
      group_position: groupPosition,
    });

  if (entityType === 'posts') {
    const hits = results.posts.slice(0, cap);
    return (
      <ul style={resultListStyle}>
        {hits.map((hit, idx) => (
          <li key={hit.id}>
            <SearchPostHitRow hit={hit} position={idx} onClick={fireClick(idx)} />
          </li>
        ))}
      </ul>
    );
  }

  if (entityType === 'people') {
    const hits = results.people.slice(0, cap);
    return (
      <ul style={resultListStyle}>
        {hits.map((hit, idx) => (
          <li key={hit.id}>
            <SearchPersonHitRow hit={hit} position={idx} onClick={fireClick(idx)} />
          </li>
        ))}
      </ul>
    );
  }

  if (entityType === 'regions') {
    const hits = results.regions.slice(0, cap);
    return (
      <ul style={resultListStyle}>
        {hits.map((hit, idx) => (
          <li key={hit.id}>
            <SearchRegionHitRow hit={hit} position={idx} onClick={fireClick(idx)} />
          </li>
        ))}
      </ul>
    );
  }

  // partnerOrgs — D078 §9, always empty in v1; render nothing.
  return null;
}

function fullResultsHref(
  q: string,
  type: SearchEntityType,
  filter: Exclude<FeedFilter, 'all'> | null,
): string {
  const params = new URLSearchParams();
  params.set('q', q);
  params.set('type', type);
  if (filter !== null) params.set('filter', filter);
  return `/search?${params.toString()}`;
}

// Re-export for tests / page typing.
export { SEARCH_ENTITY_TYPES };
