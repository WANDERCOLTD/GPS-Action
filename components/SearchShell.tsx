'use client';

/**
 * @build-unit BU-search-surface
 * @spec architecture/decision-log.md (D078)
 * @spec adrs/0004-search-trigram-indexes.md
 * @spec build/session-briefs/bu-search-surface.md
 * @spec product/scenarios.md (SCN-31)
 *
 * Client shell for the `/search` route. PR C of the BU ships only the
 * shell — autofocused input, removable scope chip, empty-state
 * placeholders. PR D wires the typeahead + full-results to
 * `trpc.search.query`, recently-viewed via localStorage, and the
 * 4 telemetry events.
 *
 * The page-level sticky header (back / "Search" title / refresh) sits
 * below the root layout's nav header. The duplicate refresh affordance
 * is deliberate: the page header is the contextually relevant place
 * for a member focused on a search session, and matches the design
 * brief (D078 §7 envelope).
 */

import * as React from 'react';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, X } from 'lucide-react';
import { HeaderRefreshButton } from '@/components/HeaderRefreshButton';
import { FEED_FILTER_LABELS, type FeedFilter } from '@/shared/feed-filters';

interface SearchShellProps {
  /**
   * Filter inherited from the referring feed via `?filter=` (D078 §7).
   * `null` when search was opened app-wide or the filter was `all`.
   * Renders a removable `× <Label>` scope chip below the input.
   */
  initialFilter?: Exclude<FeedFilter, 'all'> | null;
  /**
   * Initial query from `?q=` (D078 §7 — URL-addressable result sets).
   * PR C just hydrates the input; PR D will run the query against the
   * server and render grouped results.
   */
  initialQuery?: string;
}

const MIN_QUERY_LENGTH = 2;

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

const sectionHeadingStyle: CSSProperties = {
  margin: 0,
  marginBottom: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--colour-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const placeholderCopyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--colour-text-secondary)',
  fontSize: 'var(--text-sm)',
};

export function SearchShell({ initialFilter = null, initialQuery = '' }: SearchShellProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<Exclude<FeedFilter, 'all'> | null>(initialFilter);

  function dismissFilter(): void {
    setFilter(null);
    // Reflect the change in the URL so a refresh (or share) preserves
    // the widened scope. Use history.replaceState — no navigation, no
    // server round-trip; PR D will hook the URL to the live query too.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('filter');
      window.history.replaceState(null, '', url.toString());
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    // PR D wires submit to trpc.search.query + telemetry. PR C is
    // shell-only — submitting with an empty/short query is a no-op so
    // the keyboard "Search" key doesn't bounce the user out of the
    // overlay.
    if (query.trim().length < MIN_QUERY_LENGTH) return;
  }

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
          Search
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

      <section style={sectionStyle} data-testid="search-empty-recently-viewed">
        <h2 style={sectionHeadingStyle}>Recently viewed</h2>
        <p style={placeholderCopyStyle}>
          Posts you open will appear here so you can find them again.
        </p>
      </section>

      <section style={sectionStyle} data-testid="search-empty-your-regions">
        <h2 style={sectionHeadingStyle}>Your regions</h2>
        <p style={placeholderCopyStyle}>Region shortcuts will appear here.</p>
      </section>
    </main>
  );
}
