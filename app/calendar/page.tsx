/**
 * @build-unit BU-calendar-view
 * @spec architecture/decision-log.md (D036, D073)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 *
 * `/calendar` route — agenda + month surfaces for time-bearing posts.
 * Server component. Reads `?view=agenda|month` from the URL
 * (default: `agenda`) and renders the matching subview. Gated by the
 * `calendar_enabled` feature flag — when off, the route redirects to
 * `/feed` (the AppNav tab is also hidden).
 *
 * Visibility rules: anonymous callers see public events only;
 * authenticated callers see public + authenticated_only. Same rules
 * as `/feed`. The query (`post.listUpcoming`) handles the filter
 * server-side.
 *
 * For the agenda view, `from` defaults to "today 00:00 Europe/London"
 * (set inside the service). For the month view, the page narrows the
 * window to the visible month so the grid only counts events that
 * actually fall inside it.
 */

import { redirect } from 'next/navigation';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { endOfMonth } from 'date-fns';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { EVENT_TIMEZONE, todayStartLondonUtc } from '@/shared/format-event-time';
import { CalendarToggle } from './CalendarToggle';
import { AgendaView, type AgendaPost } from './AgendaView';
import { MonthView, type MonthPost } from './MonthView';
import { parseCalendarView, type CalendarView } from './view';

export const metadata = {
  title: 'Calendar — GPS Action',
};

interface CalendarPageProps {
  searchParams: Promise<{ view?: string | string[] }>;
}

/** Wire-shape mapper: tRPC `listUpcoming` returns Date instances; the
 * client components consume ISO strings (the same pattern `/feed`
 * uses for the event-time fields). */
type UpcomingPost = Awaited<
  ReturnType<ReturnType<typeof createCaller>['post']['listUpcoming']>
>['posts'][number];

function toCalendarPost(p: UpcomingPost): AgendaPost {
  return {
    id: p.id,
    title: p.title,
    body: p.body,
    kindSlug: p.kindSlug,
    kindDisplayName: p.kindDisplayName,
    urgency: p.urgency,
    // `eventAt` is non-null because `listUpcoming` filters on `eventAt: { gte }`.
    eventAt: (p.eventAt as Date).toISOString(),
    eventEndsAt: p.eventEndsAt ? p.eventEndsAt.toISOString() : null,
    locationText: p.locationText,
  };
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const flagEnabled = await isFeatureEnabled('calendar_enabled');
  if (!flagEnabled) {
    redirect('/feed');
  }

  const view: CalendarView = parseCalendarView((await searchParams).view);
  const now = new Date();

  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);

  if (view === 'month') {
    // Narrow the listUpcoming window to the visible month so the grid
    // counts only events inside it. We anchor on "now" — prev/next
    // month navigation is parking-lot for this BU.
    const monthAnchor = monthStartLondonUtc(now);
    const monthEnd = endOfMonth(monthAnchor);
    const monthLabel = formatInTimeZone(now, EVENT_TIMEZONE, 'MMMM yyyy');

    const result = await caller.post.listUpcoming({
      from: monthAnchor.toISOString(),
      to: monthEnd.toISOString(),
      limit: 50,
    });
    const posts: MonthPost[] = result.posts.map(toCalendarPost);

    return (
      <main style={mainStyle}>
        <CalendarToggle active="month" />
        <MonthView
          posts={posts}
          now={now.toISOString()}
          monthAnchor={monthAnchor.toISOString()}
          monthLabel={monthLabel}
        />
      </main>
    );
  }

  // Default: agenda view.
  const result = await caller.post.listUpcoming({
    from: todayStartLondonUtc(now).toISOString(),
    limit: 50,
  });
  const posts: AgendaPost[] = result.posts.map(toCalendarPost);

  return (
    <main style={mainStyle}>
      <CalendarToggle active="agenda" />
      <AgendaView posts={posts} now={now} />
    </main>
  );
}

const mainStyle = {
  padding: 'var(--space-6) var(--space-4)',
  maxWidth: 720,
  margin: '0 auto',
};

/**
 * UTC anchor for the first day of the visible month, in Europe/London.
 * Mirrors `todayStartLondonUtc` but for the start of the month.
 */
function monthStartLondonUtc(now: Date): Date {
  const monthStr = formatInTimeZone(now, EVENT_TIMEZONE, 'yyyy-MM');
  return fromZonedTime(`${monthStr}-01T00:00:00`, EVENT_TIMEZONE);
}
