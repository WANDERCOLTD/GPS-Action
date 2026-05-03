'use client';

/**
 * @build-unit BU-search-result-cards
 * @spec build/session-briefs/bu-search-result-cards.md
 * @spec product/design-philosophy.md (List-of-entities re-use rule)
 *
 * Per-entity row components for `/search`. Three row types — Post,
 * Person, Region — each rendered in the project's house byline style:
 * `KindChip` + `AvatarBubble` + `formatRole` chips for posts and
 * people, `MapPin` + slug subtitle for regions. The compact
 * version of `PostCard`'s byline; reuses the same primitives so the
 * search surface looks like everywhere else.
 *
 * Telemetry stays at the SearchShell layer — the row components
 * forward `onClick` so the click handler can fire
 * `search_result_clicked` with position metadata.
 */

import * as React from 'react';
import type { CSSProperties, MouseEventHandler, ReactElement } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { AvatarBubble, KindChip, formatRole } from '@/components/post-meta';
import type {
  PostSearchHit,
  PersonSearchHit,
  RegionSearchHit,
  SearchAuthorRole,
} from '@/server/routers/search';

// ── Shared styles ───────────────────────────────────────────────────────

const rowLinkStyle: CSSProperties = {
  display: 'block',
  padding: 'var(--space-3) 0',
  color: 'var(--colour-text-primary)',
  textDecoration: 'none',
  borderBottom: '1px solid var(--colour-border-subtle)',
};

const bylineStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  marginBottom: 'var(--space-1)',
  flexWrap: 'wrap',
};

const titleStyle: CSSProperties = {
  fontSize: 'var(--text-md)',
  fontWeight: 'var(--weight-medium)',
  color: 'var(--colour-text-primary)',
  display: 'block',
  marginTop: 'var(--space-1)',
};

const metaStyle: CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
};

const roleChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '1px var(--space-2)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--colour-surface-sunken)',
  color: 'var(--colour-text-secondary)',
  fontSize: 'var(--text-2xs)',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
};

const personRowStyle: CSSProperties = {
  ...rowLinkStyle,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
};

const regionRowStyle: CSSProperties = {
  ...personRowStyle,
};

const personMainStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  minWidth: 0,
};

const inlineSignalStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 'var(--text-md)',
  marginRight: 'var(--space-1)',
};

// ── Helpers ─────────────────────────────────────────────────────────────

function RoleChips({ roles }: { roles: readonly SearchAuthorRole[] }) {
  if (roles.length === 0) return null;
  return (
    <>
      {roles.map((role) => (
        <span key={role} style={roleChipStyle} data-testid="search-role-chip" data-role={role}>
          {formatRole(role)}
        </span>
      ))}
    </>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString();
}

// ── Row components ──────────────────────────────────────────────────────

interface SearchPostHitRowProps {
  hit: PostSearchHit;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  testId?: string;
  position: number;
}

export function SearchPostHitRow({
  hit,
  onClick,
  testId = 'search-result-item',
  position,
}: SearchPostHitRowProps): ReactElement {
  return (
    <Link
      href={hit.href}
      style={rowLinkStyle}
      onClick={onClick}
      data-testid={testId}
      data-entity-type="posts"
      data-position={position}
    >
      <div style={bylineStyle}>
        <KindChip kindSlug={hit.kindSlug} urgency={hit.urgency} />
        <AvatarBubble displayName={hit.author.displayName} style={{ width: 24, height: 24 }} />
        <strong style={{ fontSize: 'var(--text-sm)' }}>{hit.author.displayName}</strong>
        <RoleChips roles={hit.author.roles} />
        <span style={metaStyle}>· {formatDate(hit.createdAt)}</span>
      </div>
      <span style={titleStyle}>
        {hit.signal && (
          <span
            aria-label={hit.signal === 'promote' ? 'Amplify' : 'Flag'}
            style={inlineSignalStyle}
            data-testid="search-result-signal"
            data-signal={hit.signal}
          >
            {hit.signal === 'promote' ? '✅' : '❌'}
          </span>
        )}
        {hit.title}
      </span>
    </Link>
  );
}

interface SearchPersonHitRowProps {
  hit: PersonSearchHit;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  testId?: string;
  position: number;
}

export function SearchPersonHitRow({
  hit,
  onClick,
  testId = 'search-result-item',
  position,
}: SearchPersonHitRowProps): ReactElement {
  return (
    <Link
      href={hit.href}
      style={personRowStyle}
      onClick={onClick}
      data-testid={testId}
      data-entity-type="people"
      data-position={position}
    >
      <AvatarBubble displayName={hit.displayName} />
      <div style={personMainStyle}>
        <div style={bylineStyle}>
          <strong style={{ fontSize: 'var(--text-md)' }}>{hit.displayName}</strong>
          <RoleChips roles={hit.roles} />
        </div>
      </div>
    </Link>
  );
}

interface SearchRegionHitRowProps {
  hit: RegionSearchHit;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  testId?: string;
  position: number;
}

export function SearchRegionHitRow({
  hit,
  onClick,
  testId = 'search-result-item',
  position,
}: SearchRegionHitRowProps): ReactElement {
  return (
    <Link
      href={hit.href}
      style={regionRowStyle}
      onClick={onClick}
      data-testid={testId}
      data-entity-type="regions"
      data-position={position}
    >
      <MapPin
        size={20}
        strokeWidth={2}
        aria-hidden="true"
        style={{ color: 'var(--colour-text-secondary)', flexShrink: 0 }}
      />
      <div style={personMainStyle}>
        <strong style={{ fontSize: 'var(--text-md)' }}>{hit.displayName}</strong>
        <span style={metaStyle}>{hit.slug}</span>
      </div>
    </Link>
  );
}
