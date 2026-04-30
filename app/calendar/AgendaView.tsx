/**
 * @build-unit BU-calendar-view
 * @spec architecture/decision-log.md (D073)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 *
 * Agenda view — flat list of upcoming events grouped by Europe/London
 * day. Day headers spell:
 *
 *   - "Today"          — the caller's current Europe/London day
 *   - "Tomorrow"       — exactly +1 day
 *   - "Sat 3 May"      — weekday + date for any other day
 *
 * If items in "Today" already started before the caller's current
 * moment, an "Earlier today" mini-header sits above them so the eye
 * tracks the past-vs-future split without losing them entirely. The
 * cutoff is "today 00:00 Europe/London" (set by the upstream service);
 * past-day items are filtered out at the query, not here.
 *
 * Empty list → "No upcoming events" + a link to /compose.
 *
 * No client state. The component is a pure server-rendered presentation
 * over the post array passed in by `app/calendar/page.tsx`.
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { CalendarRow, type CalendarRowPost } from './CalendarRow';
import { formatLondon, EVENT_TIMEZONE } from '@/shared/format-event-time';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Identical to `CalendarRowPost` — exported under a domain-named alias
 * so the page boundary keeps the type-name explicit and future fields
 * can land here without touching every call site.
 */
export type AgendaPost = CalendarRowPost;

interface AgendaViewProps {
  posts: AgendaPost[];
  /** Caller's current moment, injected so the view is pure / testable. */
  now: Date;
}

const sectionStyle: CSSProperties = {
  marginBottom: 'var(--space-6)',
};

const dayHeaderStyle: CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--colour-text-secondary)',
  margin: 0,
  marginBottom: 'var(--space-2)',
};

const earlierTodayStyle: CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--colour-text-secondary)',
  margin: 0,
  marginTop: 'var(--space-3)',
  marginBottom: 'var(--space-2)',
  opacity: 0.8,
};

const footerStyle: CSSProperties = {
  marginTop: 'var(--space-6)',
  textAlign: 'center',
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
  fontFamily: 'var(--font-ui)',
};

const emptyWrapStyle: CSSProperties = {
  padding: 'var(--space-6) var(--space-4)',
  textAlign: 'center',
  color: 'var(--colour-text-secondary)',
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-md)',
};

interface DayBucket {
  /** yyyy-MM-dd in Europe/London. Used as the key + ordering anchor. */
  dayKey: string;
  /** UTC anchor for the start of that London day — used by header formatting. */
  anchorUtc: Date;
  posts: AgendaPost[];
}

export function groupPostsByLondonDay(posts: AgendaPost[]): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (const post of posts) {
    const at = new Date(post.eventAt);
    const dayKey = formatInTimeZone(at, EVENT_TIMEZONE, 'yyyy-MM-dd');
    let bucket = map.get(dayKey);
    if (!bucket) {
      bucket = { dayKey, anchorUtc: at, posts: [] };
      map.set(dayKey, bucket);
    }
    bucket.posts.push(post);
  }
  return Array.from(map.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

export function dayHeaderLabel(bucketAnchor: Date, now: Date): string {
  const todayKey = formatInTimeZone(now, EVENT_TIMEZONE, 'yyyy-MM-dd');
  const bucketKey = formatInTimeZone(bucketAnchor, EVENT_TIMEZONE, 'yyyy-MM-dd');
  if (bucketKey === todayKey) return 'Today';

  // Compute "tomorrow" key by formatting (now + 24h) — DST-safe because
  // we only compare the dateString, not arithmetic on UTC ms boundaries.
  const tomorrowKey = formatInTimeZone(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    EVENT_TIMEZONE,
    'yyyy-MM-dd',
  );
  if (bucketKey === tomorrowKey) return 'Tomorrow';

  // Anything else: "Sat 3 May".
  return formatLondon(bucketAnchor, 'EEE d MMM');
}

export function AgendaView({ posts, now }: AgendaViewProps) {
  if (posts.length === 0) {
    return (
      <div data-testid="calendar-agenda-empty" style={emptyWrapStyle}>
        <p style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>No upcoming events.</p>
        <Link
          href="/compose"
          data-testid="calendar-agenda-empty-compose"
          style={{ color: 'var(--colour-text-link)', fontSize: 'var(--text-sm)' }}
        >
          Compose a meeting or event →
        </Link>
      </div>
    );
  }

  const buckets = groupPostsByLondonDay(posts);
  const todayKey = formatInTimeZone(now, EVENT_TIMEZONE, 'yyyy-MM-dd');

  return (
    <section data-testid="calendar-agenda-list">
      {buckets.map((bucket) => {
        const isToday = bucket.dayKey === todayKey;
        const earlierToday: AgendaPost[] = isToday
          ? bucket.posts.filter((p) => new Date(p.eventAt).getTime() < now.getTime())
          : [];
        const upcomingForBucket: AgendaPost[] = isToday
          ? bucket.posts.filter((p) => new Date(p.eventAt).getTime() >= now.getTime())
          : bucket.posts;

        return (
          <div
            key={bucket.dayKey}
            data-testid="calendar-agenda-day"
            data-day-key={bucket.dayKey}
            style={sectionStyle}
          >
            <h2 data-testid="calendar-agenda-day-header" style={dayHeaderStyle}>
              {dayHeaderLabel(bucket.anchorUtc, now)}
            </h2>

            {earlierToday.length > 0 && (
              <>
                <h3 data-testid="calendar-agenda-earlier-today" style={earlierTodayStyle}>
                  Earlier today
                </h3>
                {earlierToday.map((p) => (
                  <CalendarRow key={p.id} post={p} />
                ))}
              </>
            )}

            {upcomingForBucket.map((p) => (
              <CalendarRow key={p.id} post={p} />
            ))}
          </div>
        );
      })}
      <p data-testid="calendar-agenda-footer" style={footerStyle}>
        Nothing further scheduled.
      </p>
    </section>
  );
}
