/**
 * @build-unit BU-feed-filter BU-icon-strips
 * @spec product/research/search-surfaces.md (§4 — chips persist; search is modal)
 * @spec product/design-philosophy.md (Glyph register)
 * @spec docs/build/session-briefs/bu-icon-strips.md
 *
 * Horizontal pill row that replaces the `<h1>Feed</h1>` on `/feed`.
 * Single-active, URL-driven via `?filter=<slug>`. Server component —
 * each chip is a `<Link>` so navigation is plain HTTP and back-button
 * semantics work without client state.
 *
 * The page passes `active` (from `searchParams.filter`); chips not
 * matching that value render in their default ghost style.
 *
 * Per BU-icon-strips, chips are icons-only with two deliberate
 * non-lucide exceptions:
 *
 *   - AM renders the partner-brand glyph from `FEED_FILTER_ICONS`
 *     as an `<img>` (per share-taxonomy). Lucide `Megaphone` is
 *     reserved as the future fallback if the brand glyph ever swaps.
 *   - Tick-or-cross renders the literal `✅❌` emoji as a deliberate
 *     visual identity — no lucide line icon mirrors the literal
 *     yes/no pair.
 *
 * "All" is the only chip whose visible content stays as plain text
 * (the deliberate "off" outlier). Every chip has its label exposed
 * via `aria-label` and via `IconChipTooltip` (300ms hover / 600ms
 * long-press).
 */

import * as React from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { CalendarDays, Radio, Users, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { IconChipTooltip } from '@/components/IconChipTooltip';
import {
  FEED_FILTERS,
  FEED_FILTER_LABELS,
  FEED_FILTER_TONES,
  FEED_FILTER_ICONS,
  type FeedFilter,
} from '@/shared/feed-filters';

interface FeedFilterChipsProps {
  active: FeedFilter;
}

/**
 * Chip glyph picks (BU-icon-strips). Filters absent from this map fall
 * back to either the brand glyph (`activist_mailer` → `<img>`), the
 * literal `✅❌` emoji (`tick_or_cross`), or plain text (`all`). See
 * the brief for rationale per pick.
 */
const FILTER_LUCIDE: Partial<Record<FeedFilter, LucideIcon>> = {
  urgent: Zap,
  happening_now: Radio,
  meeting: Users,
  event: CalendarDays,
};

const ICON_SIZE = 16;
const ICON_STROKE = 2;

// Right-edge gradient mask on the scroll container so members on
// narrow viewports can see at a glance that the chip strip scrolls
// horizontally — the scrollbar is hidden on iPhone, so without an
// affordance an Events / Meetings chip cut off at the edge looks
// indistinguishable from "no more chips". The mask only kicks in
// when content overflows; on wide screens the mask region is empty
// and invisible.
const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  marginBottom: 'var(--space-6)',
  paddingBottom: 'var(--space-1)',
  WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
  maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
};

const chipInnerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const brandImgStyle: CSSProperties = {
  display: 'inline-block',
  width: ICON_SIZE,
  height: ICON_SIZE,
};

const tickCrossStyle: CSSProperties = {
  fontSize: 'var(--text-sm)',
  lineHeight: 1,
};

const srOnlyStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function renderChipContent(filter: FeedFilter, label: string): React.ReactNode {
  // "All" — the deliberate text outlier (no glyph).
  if (filter === 'all') return <span style={chipInnerStyle}>{label}</span>;

  // Tick-or-cross — deliberate emoji exception.
  if (filter === 'tick_or_cross') {
    return (
      <span style={tickCrossStyle} aria-hidden="true">
        ✅❌
      </span>
    );
  }

  // Activist Mailer — brand glyph.
  const brandUrl = FEED_FILTER_ICONS[filter];
  if (brandUrl) {
    return <img src={brandUrl} alt="" aria-hidden="true" style={brandImgStyle} />;
  }

  // Lucide line icon.
  const Icon = FILTER_LUCIDE[filter];
  if (Icon) {
    return <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
  }

  // Defensive fallback — shouldn't happen if FEED_FILTERS / picks stay in sync.
  return <span style={chipInnerStyle}>{label}</span>;
}

export function FeedFilterChips({ active }: FeedFilterChipsProps) {
  return (
    <>
      <h1 style={srOnlyStyle}>Feed</h1>
      <nav aria-label="Feed filters" data-testid="feed-filter-chips" style={rowStyle}>
        {FEED_FILTERS.map((filter) => {
          const isActive = filter === active;
          const href = filter === 'all' ? '/feed' : `/feed?filter=${filter}`;
          // Active chip mirrors the kind chip on the posts it surfaces:
          // urgent / Now → urgent palette, meeting / event → info,
          // tick_or_cross → primary, all → neutral. Inactive chips fall
          // back to the default ghost.
          const tone = FEED_FILTER_TONES[filter];
          const className = isActive ? `gps-chip gps-chip--${tone}` : 'gps-chip';
          const label = FEED_FILTER_LABELS[filter];
          return (
            <IconChipTooltip key={filter} label={label}>
              <Link
                href={href}
                prefetch={false}
                aria-label={label}
                data-testid={`feed-filter-${filter}`}
                data-tone={tone}
                aria-current={isActive ? 'page' : undefined}
                className={className}
              >
                {renderChipContent(filter, label)}
              </Link>
            </IconChipTooltip>
          );
        })}
      </nav>
    </>
  );
}
