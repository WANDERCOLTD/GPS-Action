/**
 * @build-unit BU-network-spread-gallery
 * @spec build/session-briefs/bu-network-spread-gallery.md
 *
 * Client component. The Photos-app-style grid of spread tiles +
 * section headers + detail-sheet state.
 *
 * Section headers vary with active sort:
 *   - `mostSpread` → 5+ groups · 2–4 · once (by distinctSourceCount)
 *   - `trending`   → Picking up · Steady · Cooling (by trendingScore)
 *   - `mostRecent` → Today · Yesterday · This week · Earlier
 *
 * Detail sheet open/close state lives here (clicked tile + close
 * handler); the sheet itself is a separate component.
 */

'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { NetworkSpreadTile } from '@/components/NetworkSpreadTile';
import { NetworkSpreadDetailSheet } from '@/components/NetworkSpreadDetailSheet';
import type { SpreadSort, SpreadTile } from '@/shared/network-spread';

interface NetworkSpreadGridProps {
  tiles: ReadonlyArray<SpreadTile>;
  sort: SpreadSort;
  windowDays: number;
}

interface Section {
  label: string;
  tiles: SpreadTile[];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function groupBySort(tiles: ReadonlyArray<SpreadTile>, sort: SpreadSort): Section[] {
  if (sort === 'mostSpread') {
    const five: SpreadTile[] = [];
    const twoToFour: SpreadTile[] = [];
    const once: SpreadTile[] = [];
    for (const t of tiles) {
      if (t.distinctSourceCount >= 5) five.push(t);
      else if (t.distinctSourceCount >= 2) twoToFour.push(t);
      else once.push(t);
    }
    return [
      { label: 'Shared into 5+ groups', tiles: five },
      { label: 'Shared into 2–4 groups', tiles: twoToFour },
      { label: 'Shared once', tiles: once },
    ].filter((s) => s.tiles.length > 0);
  }

  if (sort === 'trending') {
    // Buckets by trendingScore quantile-ish thresholds.
    const picking: SpreadTile[] = [];
    const steady: SpreadTile[] = [];
    const cooling: SpreadTile[] = [];
    for (const t of tiles) {
      if (t.trendingScore >= 0.5) picking.push(t);
      else if (t.trendingScore > 0) steady.push(t);
      else cooling.push(t);
    }
    return [
      { label: 'Picking up', tiles: picking },
      { label: 'Steady', tiles: steady },
      { label: 'Cooling', tiles: cooling },
    ].filter((s) => s.tiles.length > 0);
  }

  // mostRecent → date buckets
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  const today: SpreadTile[] = [];
  const yest: SpreadTile[] = [];
  const week: SpreadTile[] = [];
  const earlier: SpreadTile[] = [];
  for (const t of tiles) {
    if (isSameDay(t.lastSeenAt, now)) today.push(t);
    else if (isSameDay(t.lastSeenAt, yesterday)) yest.push(t);
    else if (t.lastSeenAt >= weekAgo) week.push(t);
    else earlier.push(t);
  }
  return [
    { label: 'Today', tiles: today },
    { label: 'Yesterday', tiles: yest },
    { label: 'This week', tiles: week },
    { label: 'Earlier', tiles: earlier },
  ].filter((s) => s.tiles.length > 0);
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 3,
  padding: '0 3px',
};

const sectionHeaderStyle: CSSProperties = {
  padding: '18px 16px 8px',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--colour-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const countStyle: CSSProperties = {
  fontWeight: 400,
  textTransform: 'none',
  letterSpacing: 0,
  color: 'var(--colour-text-tertiary)',
  marginLeft: 6,
};

const endStyle: CSSProperties = {
  textAlign: 'center',
  padding: 'var(--space-6) var(--space-4) var(--space-8)',
  color: 'var(--colour-text-tertiary)',
  fontSize: 'var(--text-sm)',
};

export function NetworkSpreadGrid({ tiles, sort, windowDays }: NetworkSpreadGridProps) {
  const sections = useMemo(() => groupBySort(tiles, sort), [tiles, sort]);
  const [openTile, setOpenTile] = useState<SpreadTile | null>(null);

  if (tiles.length === 0) {
    return (
      <div style={endStyle} data-testid="network-spread-empty-state">
        Nothing has been shared in the last {windowDays} days yet.
      </div>
    );
  }

  return (
    <div data-testid="network-spread-grid">
      <style>{`
        @media (min-width: 700px) {
          [data-spread-grid] { grid-template-columns: repeat(4, 1fr) !important; }
        }
        @media (min-width: 1024px) {
          [data-spread-grid] { grid-template-columns: repeat(6, 1fr) !important; }
        }
      `}</style>
      {sections.map((section) => (
        <section
          key={section.label}
          data-testid="network-spread-section"
          data-section-label={section.label}
        >
          <h2 style={sectionHeaderStyle}>
            {section.label}
            <span style={countStyle}>
              {section.tiles.length} {section.tiles.length === 1 ? 'item' : 'items'}
            </span>
          </h2>
          <div style={gridStyle} data-spread-grid>
            {section.tiles.map((tile) => (
              <NetworkSpreadTile key={tile.normalizedUrl} tile={tile} onSelect={setOpenTile} />
            ))}
          </div>
        </section>
      ))}
      <div style={endStyle}>· End of {windowDays}-day window ·</div>
      {openTile && <NetworkSpreadDetailSheet tile={openTile} onClose={() => setOpenTile(null)} />}
    </div>
  );
}
