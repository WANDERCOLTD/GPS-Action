/**
 * @build-unit BU-calendar-view
 * @spec architecture/decision-log.md (D073)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 *
 * Compact, date-prominent post row used by both the agenda list and the
 * month-day panel. NOT a replacement for `PostCard` — that surface
 * remains the standard for `/feed` and post detail pages. CalendarRow
 * trades the unfurl, reaction pill, and link preview for vertical
 * density: members scanning a date-ordered list want to see "what is
 * on, when, where" before they decide to tap through.
 *
 * The whole row is a `<Link>` to `/post/[id]` — taps navigate to the
 * full PostCard for actions. The row itself never composes; that work
 * lives in PostCard / the detail page.
 *
 * Layer note: lives in `app/calendar/` (View), composes only `shared/`
 * helpers. `lucide-react` is a leaf dep imported directly per project
 * convention.
 */

import Link from 'next/link';
import { Calendar, MapPin } from 'lucide-react';
import type { CSSProperties } from 'react';
import { formatEventRange } from '@/shared/format-event-time';

export interface CalendarRowPost {
  id: string;
  title: string;
  /** Stripped to a single short line for the row preview. */
  body: string;
  kindSlug: string | null;
  kindDisplayName: string | null;
  urgency: boolean;
  eventAt: string; // ISO 8601, required (rows without eventAt are filtered upstream)
  eventEndsAt: string | null;
  locationText: string | null;
}

interface CalendarRowProps {
  post: CalendarRowPost;
}

const rowStyle: CSSProperties = {
  display: 'block',
  textDecoration: 'none',
  color: 'inherit',
  padding: 'var(--space-3) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  marginBottom: 'var(--space-2)',
};

const timeRowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--colour-info)',
  fontFamily: 'var(--font-ui)',
  marginBottom: 'var(--space-1)',
};

const locationRowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
  fontFamily: 'var(--font-ui)',
  marginTop: 'var(--space-1)',
};

const titleStyle: CSSProperties = {
  fontSize: 'var(--text-base)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--colour-text-primary)',
  margin: 0,
  marginTop: 'var(--space-1)',
  marginBottom: 'var(--space-1)',
  lineHeight: 'var(--line-snug)',
};

const bodyStyle: CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-text-secondary)',
  margin: 0,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const urgentChipStyle: CSSProperties = {
  display: 'inline-block',
  marginRight: 'var(--space-2)',
  padding: '2px var(--space-2)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--colour-urgent)',
  color: 'var(--colour-urgent-contrast)',
  fontSize: 'var(--text-2xs)',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

export function CalendarRow({ post }: CalendarRowProps) {
  const eventAtDate = new Date(post.eventAt);
  const endsAtDate = post.eventEndsAt ? new Date(post.eventEndsAt) : null;
  const range = formatEventRange(eventAtDate, endsAtDate);
  const trimmedBody = post.body.replace(/\n+/g, ' ').trim();

  return (
    <Link
      href={`/post/${post.id}`}
      data-testid="calendar-row-link"
      data-post-id={post.id}
      data-kind={post.kindSlug ?? undefined}
      style={rowStyle}
    >
      <div data-testid="calendar-row-time" style={timeRowStyle}>
        <Calendar size={14} aria-hidden="true" />
        <time dateTime={post.eventAt}>{range}</time>
      </div>
      <h3 style={titleStyle}>
        {post.urgency && (
          <span data-testid="calendar-row-urgent" style={urgentChipStyle}>
            Alert
          </span>
        )}
        {post.title}
      </h3>
      {trimmedBody !== '' && <p style={bodyStyle}>{trimmedBody}</p>}
      {post.locationText && post.locationText.trim() !== '' && (
        <div data-testid="calendar-row-location" style={locationRowStyle}>
          <MapPin size={12} aria-hidden="true" />
          <span>{post.locationText}</span>
        </div>
      )}
    </Link>
  );
}
