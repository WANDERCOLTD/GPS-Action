/**
 * @build-unit bu-network-source-chips
 * @spec build/session-briefs/bu-network-source-chips.md
 *
 * Server component. Horizontal pill row above `/network`'s card list,
 * one chip per source from `gps_chat_labels` + an "All" chip.
 * URL-state-encoded: `?source=slug-a,slug-b`. Multi-select: tapping a
 * chip toggles its slug in the comma list. Empty selection = "All".
 *
 * Each chip is a plain `<a>` so navigation is HTTP, back-button
 * semantics work without client state, and the chip strip can render
 * on the server with no hydration.
 *
 * Sort: `displayOrder ASC, label ASC` (Grant 2026-05-11 Round 2;
 * locked decision — answers open product Q1 in the brief).
 *
 * Colour: the override map in `shared/styles/source-palette.ts`
 * wins; Grant's `color` is the fallback; neutral is the last resort.
 * Icon: the source's `icon` (emoji) rendered inline; null collapses
 * to text-only.
 *
 * Per design-philosophy / icon-strips, the strip uses the same
 * `.gps-chip` / `.gps-chip--active` styles as the existing
 * FeedFilterChips so the two surfaces feel of-a-piece.
 */

import type { CSSProperties } from 'react';
import { SourceBadge } from '@/components/SourceBadge';
import type { NetworkSource } from '@/shared/network-card';

interface NetworkSourceChipStripProps {
  sources: NetworkSource[];
  /** Currently-active slugs (from the URL `?source=` param). Empty = "All". */
  active: string[];
  /**
   * Other URL params that must survive a chip toggle. Today this is
   * `sort` — toggling a source chip must NOT silently reset the
   * member's chosen sort direction.
   */
  preserveParams?: Record<string, string | undefined>;
  /**
   * Base path the chip hrefs point to. Defaults to `/network` (list
   * view). Pass `/network/spread` from the gallery so toggling a chip
   * doesn't kick the user out of gallery mode.
   */
  basePath?: string;
}

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  paddingBottom: 'var(--space-1)',
  WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
  maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
};

const labelStyle: CSSProperties = {
  whiteSpace: 'nowrap',
};

/**
 * Build the next `?source=` value when the given slug is toggled. If
 * the slug is currently active, remove it; otherwise add it. Empty
 * result strips the param entirely (= "All").
 */
function toggleSlug(active: string[], slug: string): string[] {
  if (active.includes(slug)) return active.filter((s) => s !== slug);
  return [...active, slug];
}

function buildHref(
  slugs: string[],
  preserve: Record<string, string | undefined>,
  basePath: string,
): string {
  // Manual query construction (not URLSearchParams) so commas in the
  // source list stay literal — `/network?source=a,b` is friendlier
  // for sharing than `/network?source=a%2Cb`. Slug values are kebab-
  // case and don't need encoding; preserved values are encoded
  // defensively in case the caller passes something exotic.
  const parts: string[] = [];
  if (slugs.length > 0) {
    parts.push(`source=${[...slugs].sort().join(',')}`);
  }
  for (const [k, v] of Object.entries(preserve)) {
    if (v !== undefined && v !== '') parts.push(`${k}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `${basePath}?${parts.join('&')}` : basePath;
}

export function NetworkSourceChipStrip({
  sources,
  active,
  preserveParams = {},
  basePath = '/network',
}: NetworkSourceChipStripProps) {
  const isAll = active.length === 0;

  return (
    <nav
      aria-label="Network source filters"
      data-testid="network-source-chip-strip"
      style={rowStyle}
    >
      <a
        href={buildHref([], preserveParams, basePath)}
        aria-current={isAll ? 'page' : undefined}
        aria-label="All sources"
        data-testid="network-source-chip-all"
        data-active={isAll ? 'true' : 'false'}
        className={isAll ? 'gps-chip gps-chip--active' : 'gps-chip'}
      >
        <span style={labelStyle}>All</span>
      </a>
      {sources.map((source) => {
        const isActive = active.includes(source.slug);
        const next = toggleSlug(active, source.slug);
        const href = buildHref(next, preserveParams, basePath);
        return (
          <SourceBadge
            key={source.slug}
            source={source}
            iconOverride={source.iconOverride ?? null}
            variant="chip"
            href={href}
            active={isActive}
            ariaLabel={source.label}
            title={source.description ?? source.label}
          />
        );
      })}
    </nav>
  );
}

/**
 * Parse the `?source=` searchParam into a slug array. Comma-separated;
 * dedupes; preserves no order (the chip strip sorts on render).
 * Empty input / missing param / whitespace-only ⇒ `[]` (= "All").
 */
export function parseSourcesParam(raw: string | string[] | undefined): string[] {
  if (raw === undefined) return [];
  const flat = Array.isArray(raw) ? raw.join(',') : raw;
  const slugs = flat
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return Array.from(new Set(slugs));
}
