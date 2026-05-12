/**
 * @build-unit BU-calendar-view
 * @build-unit BU-month-nav
 * @build-unit BU-calendar-near-me
 * @spec architecture/decision-log.md (D036, D073, D076)
 * @spec docs/build/session-briefs/bu-calendar-view.md
 * @spec docs/build/session-briefs/bu-month-nav.md
 * @spec docs/build/session-briefs/bu-calendar-near-me.md
 *
 * `/calendar` route — agenda + month + near-me surfaces for
 * time-bearing posts. Server component. Reads `?view=agenda|month|near`
 * from the URL (default: `agenda`) and renders the matching subview.
 * Gated by the `calendar_enabled` feature flag — when off, the route
 * redirects to `/feed` (the AppNav tab is also hidden).
 *
 * Visibility rules: anonymous callers see public events only;
 * authenticated callers see public + authenticated_only. Same rules
 * as `/feed`. The query (`post.listUpcoming`) handles the filter
 * server-side.
 *
 * Month-view anchor selection (BU-month-nav):
 *  1. `?month=YYYY-MM` (valid) → anchor on first-of-that-month London.
 *  2. Otherwise probe `listUpcoming({ from: today, limit: 1 })` and
 *     anchor on the month containing that event's `eventAt`.
 *  3. If no upcoming events at all → anchor on the current month.
 *
 * Prev/next month hrefs are computed here and passed into `MonthView`
 * so the chevrons are plain server-rendered `<Link>`s (back button +
 * shareable URL).
 */

import { redirect } from 'next/navigation';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { addMonths, endOfMonth } from 'date-fns';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { EVENT_TIMEZONE, todayStartLondonUtc } from '@/shared/format-event-time';
import { PageHeader } from '@/components/PageHeader';
import { CalendarToggle } from './CalendarToggle';
import { AgendaView, type AgendaPost } from './AgendaView';
import { MonthView, type MonthPost } from './MonthView';
import { NearMeView, type NearMeCandidate } from './NearMeView';
import { parseCalendarView, parseNearSort, type CalendarView } from './view';

export const metadata = {
  title: 'Calendar — GPS Action',
};

interface CalendarPageProps {
  searchParams: Promise<{
    view?: string | string[];
    month?: string | string[];
    sort?: string | string[];
  }>;
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

  const params = await searchParams;
  const view: CalendarView = parseCalendarView(params.view);
  const now = new Date();

  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);

  // BU-calendar-near-me / D076 — third tab. Server fetches the same
  // listUpcoming candidate set the agenda uses, then narrows to the
  // in-person rows with structured coords. Distance ordering happens
  // client-side once the user supplies their location (geolocation
  // API or postcode lookup) — `listNearby` is reserved for callers
  // that already have coords.
  if (view === 'near') {
    const nearSort = parseNearSort(params.sort);
    const result = await caller.post.listUpcoming({
      from: todayStartLondonUtc(now).toISOString(),
      limit: 50,
    });
    const candidates: NearMeCandidate[] = result.posts
      .filter(
        (p): p is typeof p & { latitude: number; longitude: number } =>
          !p.isOnline && p.latitude !== null && p.longitude !== null && p.eventAt !== null,
      )
      .map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        kindSlug: p.kindSlug,
        kindDisplayName: p.kindDisplayName,
        urgency: p.urgency,
        eventAt: (p.eventAt as Date).toISOString(),
        eventEndsAt: p.eventEndsAt ? p.eventEndsAt.toISOString() : null,
        locationText: p.locationText,
        latitude: p.latitude,
        longitude: p.longitude,
      }));
    return (
      <>
        <PageHeader
          title="Calendar"
          description="What's happening near you"
          actions={<CalendarToggle active="near" />}
        />
        <main style={mainStyle}>
          <NearMeView posts={candidates} initialSort={nearSort} />
        </main>
      </>
    );
  }

  if (view === 'month') {
    // Resolve the month anchor:
    //  1. ?month=YYYY-MM (if valid) wins.
    //  2. Else probe listUpcoming for the next event and anchor on
    //     that event's month.
    //  3. Else fall back to the current month.
    const monthParam = parseMonthParam(params.month);
    let monthAnchor: Date;
    if (monthParam) {
      monthAnchor = monthParam;
    } else {
      const probe = await caller.post.listUpcoming({
        from: todayStartLondonUtc(now).toISOString(),
        limit: 1,
      });
      const firstEvent = probe.posts[0];
      monthAnchor = firstEvent?.eventAt
        ? monthStartLondonUtc(firstEvent.eventAt as Date)
        : monthStartLondonUtc(now);
    }

    // Compute the visible month's end TZ-safely. `endOfMonth` operates
    // in local time, so project monthAnchor → London, take endOfMonth,
    // project back to UTC. Mirrors MonthGrid.buildMonthGridDays.
    const monthAnchorLondon = toZonedTime(monthAnchor, EVENT_TIMEZONE);
    const monthEnd = fromZonedTime(endOfMonth(monthAnchorLondon), EVENT_TIMEZONE);
    const monthLabel = formatInTimeZone(monthAnchor, EVENT_TIMEZONE, 'MMMM yyyy');

    const result = await caller.post.listUpcoming({
      from: monthAnchor.toISOString(),
      to: monthEnd.toISOString(),
      limit: 50,
    });
    const posts: MonthPost[] = result.posts.map(toCalendarPost);

    const prevMonthHref = `/calendar?view=month&month=${monthParamFor(monthAnchor, -1)}`;
    const nextMonthHref = `/calendar?view=month&month=${monthParamFor(monthAnchor, 1)}`;

    return (
      <>
        <PageHeader
          title="Calendar"
          description="What's happening near you"
          actions={<CalendarToggle active="month" />}
        />
        <main style={mainStyle}>
          <MonthView
            posts={posts}
            now={now.toISOString()}
            monthAnchor={monthAnchor.toISOString()}
            monthLabel={monthLabel}
            prevMonthHref={prevMonthHref}
            nextMonthHref={nextMonthHref}
          />
        </main>
      </>
    );
  }

  // Default: agenda view.
  const result = await caller.post.listUpcoming({
    from: todayStartLondonUtc(now).toISOString(),
    limit: 50,
  });
  const posts: AgendaPost[] = result.posts.map(toCalendarPost);

  return (
    <>
      <PageHeader
        title="Calendar"
        description="What's happening near you"
        actions={<CalendarToggle active="agenda" />}
      />
      <main style={mainStyle}>
        <AgendaView posts={posts} now={now} />
      </main>
    </>
  );
}

const mainStyle = {
  padding: 'var(--space-6) var(--space-4)',
  maxWidth: 720,
  margin: '0 auto',
};

/**
 * UTC anchor for the first day of the month containing `at`, in
 * Europe/London. Mirrors `todayStartLondonUtc` but for the start of
 * the month. Accepts any UTC `Date` (today, an event's `eventAt`, or
 * a month-param string already converted) — we only read the
 * London-local `yyyy-MM` from it.
 */
function monthStartLondonUtc(at: Date): Date {
  const monthStr = formatInTimeZone(at, EVENT_TIMEZONE, 'yyyy-MM');
  return fromZonedTime(`${monthStr}-01T00:00:00`, EVENT_TIMEZONE);
}

/**
 * Parse `?month=YYYY-MM`. Returns the UTC anchor for the first day
 * of that month in Europe/London, or `null` for missing / malformed
 * values. Strict on shape: month must be 01–12, year must be a
 * 4-digit positive integer. Anything else (e.g. `2026-13`, `xyz`,
 * an array) → null and the caller falls back to the smart default.
 */
function parseMonthParam(raw: string | string[] | undefined): Date | null {
  if (raw === undefined) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;
  const [, year, month] = match;
  // Build the canonical first-of-month string and round-trip through
  // fromZonedTime; if `date-fns-tz` rejects it, treat as invalid.
  const local = `${year}-${month}-01T00:00:00`;
  let utc: Date;
  try {
    utc = fromZonedTime(local, EVENT_TIMEZONE);
  } catch {
    return null;
  }
  return Number.isNaN(utc.getTime()) ? null : utc;
}

/**
 * Compute the `month=` query value (`YYYY-MM`) for the month at
 * `offset` months from `monthAnchor`, expressed in Europe/London.
 * `offset` is signed: -1 = previous month, +1 = next month.
 */
function monthParamFor(monthAnchor: Date, offset: number): string {
  const anchorLondon = toZonedTime(monthAnchor, EVENT_TIMEZONE);
  const target = addMonths(anchorLondon, offset);
  return formatInTimeZone(fromZonedTime(target, EVENT_TIMEZONE), EVENT_TIMEZONE, 'yyyy-MM');
}
