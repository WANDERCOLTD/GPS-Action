/**
 * @build-unit BU-network-spread-gallery
 * @spec build/session-briefs/bu-network-spread-gallery.md
 * @spec process/testid-convention.md
 *
 * Server component. Type-chip strip above the spread gallery grid.
 * Five chips: Social · Video · News · Action · Other (plus "All").
 * Multi-select; URL-state-encoded as `?type=social,video`. Mirrors
 * the `NetworkSourceChipStrip` pattern so the two filter rows feel
 * of-a-piece.
 *
 * Buckets and their domain lists live in `server/lib/url-type.ts`;
 * the wire type is `SpreadLinkType` from `shared/network-spread.ts`.
 */

import type { CSSProperties } from 'react';
import { SPREAD_LINK_TYPES, type SpreadLinkType } from '@/shared/network-spread';

interface NetworkSpreadTypeChipStripProps {
  /** Currently-active types (from `?type=` URL param). Empty = "All". */
  active: ReadonlyArray<SpreadLinkType>;
  preserveParams?: Record<string, string | undefined>;
}

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  paddingBottom: 'var(--space-1)',
};

function toggleType(active: ReadonlyArray<SpreadLinkType>, type: SpreadLinkType): SpreadLinkType[] {
  if (active.includes(type)) return active.filter((t) => t !== type);
  return [...active, type];
}

function buildHref(
  nextTypes: ReadonlyArray<SpreadLinkType>,
  preserveParams: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  if (nextTypes.length > 0) {
    params.set('type', [...nextTypes].sort().join(',').toLowerCase());
  }
  for (const [k, v] of Object.entries(preserveParams)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '?';
}

export function NetworkSpreadTypeChipStrip({
  active,
  preserveParams,
}: NetworkSpreadTypeChipStripProps) {
  const allActive = active.length === 0;
  return (
    <div
      style={rowStyle}
      role="navigation"
      aria-label="Filter spread tiles by type"
      data-testid="network-spread-type-chip-strip"
    >
      <a
        href={buildHref([], preserveParams)}
        className={`gps-chip${allActive ? ' gps-chip--active' : ''}`}
        aria-current={allActive ? 'true' : undefined}
        data-testid="network-spread-type-chip-all"
      >
        All
      </a>
      {SPREAD_LINK_TYPES.map((type) => {
        const isActive = active.includes(type);
        const next = toggleType(active, type);
        return (
          <a
            key={type}
            href={buildHref(next, preserveParams)}
            className={`gps-chip${isActive ? ' gps-chip--active' : ''}`}
            aria-current={isActive ? 'true' : undefined}
            data-testid="network-spread-type-chip"
            data-type={type.toLowerCase()}
          >
            {type}
          </a>
        );
      })}
    </div>
  );
}

/**
 * Parse `?type=social,video` (case-insensitive) into a deduped
 * SpreadLinkType[]. Unknown tokens silently drop. Empty = [] ("All").
 */
export function parseTypesParam(raw: string | string[] | undefined): SpreadLinkType[] {
  if (raw === undefined) return [];
  const flat = Array.isArray(raw) ? raw.join(',') : raw;
  const tokens = flat
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  const out: SpreadLinkType[] = [];
  const seen = new Set<SpreadLinkType>();
  for (const tok of tokens) {
    const match = SPREAD_LINK_TYPES.find((t) => t.toLowerCase() === tok);
    if (match && !seen.has(match)) {
      seen.add(match);
      out.push(match);
    }
  }
  return out;
}
