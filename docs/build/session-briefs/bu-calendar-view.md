---
slug: bu-calendar-view
status: planned
phase: 2
priority: high
note: "Depends on bu-event-time (schema + listUpcoming query). Branch from bu-event-time's branch for parallel work; do not merge before bu-event-time merges. Split from bu-calendar on 2026-04-30."
---

# SESSION BRIEF · BU-calendar-view — /calendar tab with agenda + month views

*Brief version: 1.0 · Author: Paul · Date: 2026-04-30*

---

## Objective

Add a new `/calendar` route between Feed and Requests in `AppNav`,
showing all upcoming time-bearing posts. Default view is **agenda**:
a vertical list grouped by day ("Today" · "Tomorrow" · "Sat 3 May"),
ordered ascending by event time. A toggle switches to **month**: a
calendar grid with dots/badges on days that have events; tapping a
day reveals that day's events in a panel below the grid.

Gated by the `calendar_enabled` feature flag (registered by
bu-event-time per D036).

---

## Pre-requisites

- **bu-event-time must be in flight or merged.** This BU consumes:
  - `Post.event_at`, `Post.event_ends_at`, `Post.location_text`
  - `post.listUpcoming` tRPC query
  - `kindIsTimeBearing(slug)` helper
  - `calendar_enabled` flag entry
- **Branch strategy** — base this BU's branch on bu-event-time's
  branch (not main) so you can compile against the new schema while
  bu-event-time is still in PR review. Rebase as bu-event-time evolves.
  PR for bu-calendar-view targets main but cannot merge until
  bu-event-time has merged first.

---

## Scope

### Build in this session

**Client — calendar route (NEW):**
- `app/calendar/page.tsx` (new — server component, defaults to
  agenda. Reads `?view=agenda|month` from URL. Gated by
  `calendar_enabled`; redirects to `/feed` when off.)
- `app/calendar/AgendaView.tsx` (new — flat list of upcoming posts
  grouped by day. Day headers: "Today", "Tomorrow", "Sat 3 May".
  Within "Today", an "Earlier today" mini-header for items past
  current time. Each row is a compact PostCard variant with the
  event time prominent. **Past-cutoff: today 00:00 Europe/London**
  per Q5. **Forward horizon: until no more events**, footer reads
  "Nothing further scheduled" per Q7.)
- `app/calendar/MonthView.tsx` (new — month grid (7 cols × ~5 rows).
  Each cell shows day number; cells with events show a coloured
  dot (or stacked dots up to 3, then "+N"). Today is ringed.
  Tapping a cell highlights it and renders that day's events in
  a panel **below the entire grid** per Q6. No bottom sheet, no
  navigation away. Default selected day = today.)
- `app/calendar/CalendarToggle.tsx` (new — segmented control:
  Agenda / Month. URL-driven; back button works. Active state
  matches existing chip-strip styling on `/feed`.)
- `app/calendar/CalendarRow.tsx` (new — compact row used in both
  agenda and month-day-panel. Title, kind icon, event time + range,
  location, primary CTA from existing card affordances.)
- `app/calendar/MonthGrid.tsx` (new — pure presentational grid
  component, takes a month + events array.)
- `app/calendar/README.md` (new.)

**Client — nav:**
- `components/AppNav.tsx` (MODIFY — insert Calendar tab between
  Feed and Requests. Tab order becomes: Feed · Calendar · Requests
  · Data · Settings. Tab is conditionally rendered based on
  `calendar_enabled`. Match existing tab idiom (icon + label or
  icon-only depending on current AppNav style — do not change other
  tabs' styling here; icons-only nav redesign is out of scope).
  Use `calendar-clock` lucide icon per Q4 picks. Label "Calendar".)

**Tests:**
- `tests/components/AgendaView.test.tsx` (new — day grouping;
  empty state; "Earlier today" mini-header behaviour; today/tomorrow
  formatting; ordering.)
- `tests/components/MonthView.test.tsx` (new — dot rendering;
  today ring; day-tap selection; below-grid panel update; empty
  state.)
- `tests/integration/calendar-route.test.ts` (new — flag-gating
  redirects when off; renders agenda by default; switches to
  month on `?view=month`.)

**Docs:**
- `app/calendar/README.md` (new — describe agenda/month patterns,
  URL contract, flag dependency.)
- README updates per CLAUDE.md.

### Do NOT touch

- `prisma/schema.prisma` — schema work is bu-event-time's job.
- `server/services/post.ts` — `listUpcoming` is bu-event-time's job.
- `server/routers/post.ts` — same.
- `shared/post-kinds.ts` — `timeBearing` flag is bu-event-time's job.
- `app/compose/`, `app/post/[id]/edit/` — composer/edit surfaces are
  bu-event-time's job.
- `components/PostCard.tsx` — event display on standard PostCard is
  bu-event-time's job. (CalendarRow is a new compact variant; it
  does not modify PostCard.)
- Feed filter chips — calendar is additive.
- Other AppNav tabs (Feed/Requests/Data/Settings styling) — out of
  scope. Icons-only nav redesign is a separate brief.
- Seed (`scripts/seed.ts`) — bu-event-time seeds; this BU consumes.

### Out of scope

- Week view / day view (hourly grid). Skip per exploration.
- Recurring events, all-day flag, iCal export, reminders. All
  separate BUs / parking-lot.
- Icons-only nav redesign across all tabs (Feed/Requests/Data/Settings).
  Tracked separately as a follow-up brief; this BU only adds the
  Calendar tab in the existing nav idiom.
- Editing event time from the calendar tab. Use `/post/[id]/edit`
  (built by bu-event-time).

---

## Contracts

### Inputs consumed (from bu-event-time)

- `post.listUpcoming({ from?, to?, kindSlugs? })` tRPC query.
- `Post.event_at`, `Post.event_ends_at`, `Post.location_text` fields.
- `kindIsTimeBearing(slug)` helper.
- `calendar_enabled` feature flag.
- `date-fns` + `date-fns-tz` for grouping/formatting.

### Outputs produced

- `/calendar` route with `?view=agenda|month` URL contract.
- New AppNav tab: Calendar (icon `calendar-clock`).
- `CalendarRow` component (consumable by future BUs that want a
  compact date-prominent post row).

---

## Acceptance criteria

- [ ] `/calendar` (default agenda) shows posts with `event_at >=
      today 00:00 Europe/London`, grouped by day, ordered ascending.
- [ ] Day headers render as "Today", "Tomorrow", weekday + date for
      ≤6 days out, full date for further out.
- [ ] If items earlier today exist, "Earlier today" mini-header
      appears at the top of "Today" with those items below.
- [ ] Past events (before today 00:00) do not appear.
- [ ] Forward horizon is unbounded; footer "Nothing further
      scheduled" appears after the last event.
- [ ] `/calendar?view=month` shows current month grid; today ringed;
      days with events show coloured dot(s).
- [ ] Tapping a day highlights it in the grid and shows that day's
      events in a panel below the entire grid (not a sheet, not a
      page navigation).
- [ ] Toggle between agenda and month is URL-driven; back button
      preserves state.
- [ ] Empty states: "No upcoming events" (agenda) with link to
      `/compose`; "Nothing scheduled this month" (month).
- [ ] AppNav: tabs render Feed · Calendar · Requests · Data ·
      Settings; active state on `/calendar` highlights correctly.
- [ ] Calendar tab + route hidden when `calendar_enabled` is OFF.
- [ ] Visibility rules: logged-out viewers see only public events;
      logged-in members see public + members-only.
- [ ] iOS standalone (PWA): in-tab refresh affordance present per
      project memory.
- [ ] Accessibility: agenda day headers as landmarks; month grid
      keyboard-navigable (arrow keys move selection); screen reader
      announces day + event count.
- [ ] `npm run typecheck && npm run lint && npm test` all pass.

---

## Permission matrix

| Action                       | Logged-out | Member | Coordinator | Director |
|------------------------------|:----------:|:------:|:-----------:|:--------:|
| View `/calendar` agenda      |     ✓      |   ✓    |      ✓      |    ✓     |
| View `/calendar` month       |     ✓      |   ✓    |      ✓      |    ✓     |
| See public events            |     ✓      |   ✓    |      ✓      |    ✓     |
| See members-only events      |     —      |   ✓    |      ✓      |    ✓     |

(Calendar respects the same visibility rules as `/feed`.)

---

## UI states

| State                | Trigger                    | What user sees                                     |
|----------------------|----------------------------|----------------------------------------------------|
| Agenda — populated   | Default `/calendar`        | Day-grouped list, today highlighted                |
| Agenda — earlier today | Items past current time  | "Earlier today" mini-header at top of "Today"      |
| Agenda — empty       | No events ≥ today          | "No upcoming events" + link to compose             |
| Month — populated    | `?view=month`, events exist| Grid with dots; today ringed; today selected by default |
| Month — day-tap      | User taps a cell           | Cell highlights; that day's events render below grid |
| Month — empty month  | No events in current month | Greyed grid + "Nothing scheduled this month"       |
| Loading              | Initial fetch              | Skeleton day rows / month grid                     |
| Error                | Query fails                | Retry banner                                       |
| Flag OFF             | `calendar_enabled` off     | Tab hidden; `/calendar` redirects to `/feed`       |

---

## Tests required

- Component: AgendaView grouping; "Earlier today" header logic;
  empty state.
- Component: MonthView dot rendering; today ring; day-tap selection
  + below-grid panel update; empty month.
- Component: CalendarToggle URL behaviour; CalendarRow rendering.
- Integration: route flag-gating; default-view rendering;
  view=month switching; visibility filtering.
- Manual click-through: agenda + month, iOS PWA shell, flag flip.

---

## Scenarios to verify against

- Any meeting/event/cultural scenarios in `docs/product/scenarios.md`.
- Logged-out viewer scenario — confirm public-only filtering.
- iOS PWA — confirm refresh affordance.

---

## Known gotchas

- **iOS standalone PWA.** No native pull-to-refresh — calendar must
  include an in-tab refresh affordance per existing project memory.
  A stale calendar is worse than a stale feed.
- **Timezone at the boundary.** Group by Europe/London day, not UTC
  day. A 23:30 UTC event on a Friday is "Saturday" in London during
  BST.
- **Month boundaries.** Showing a 5-row grid means leading days from
  prev month + trailing days from next month. Their cells are dimmed.
  Tapping them is allowed (jumps to that day's panel).
- **Dot count per day.** Cap visible dots at 3 + "+N" — more than
  that overflows the cell.
- **Timezone-aware date-fns.** Use `formatInTimeZone` from
  `date-fns-tz`; do not lean on the browser locale.
- **CalendarRow vs PostCard.** CalendarRow is compact (event time
  primary, body truncated). PostCard remains the standard. Don't
  merge them — they serve different surfaces.

---

## Definition of done

- [ ] All files in "Build" list created/modified; "Don't touch" untouched.
- [ ] `npm run typecheck && npm run lint && npm test` green.
- [ ] Manual click-through: compose meeting (depends on bu-event-time)
      → see on agenda → switch to month → tap day → confirm panel.
- [ ] iOS PWA tested: refresh affordance works.
- [ ] Flag flip tested: tab hidden + route redirects when OFF.
- [ ] README files updated.
- [ ] `package.json` version bumped.
- [ ] Brief front-matter flipped to `status: shipped`, `shipped_in: "#NNN"`.
- [ ] `npm run trackers` run; `bu-sequence.md` AUTOGEN regions updated.
- [ ] **Does NOT merge before bu-event-time merges.**
- [ ] No `any`, no `@ts-ignore`, no skipped pre-commit hooks.

---

## Open questions to surface

1. **Icons-only nav redesign.** User wants all tabs to drop text
   labels, not just Calendar. That's a wider change touching every
   tab; out of scope for this BU. Recommendation: file a separate
   `bu-icon-nav` brief stub. Current bu-calendar-view ships Calendar
   with the same icon+label idiom as existing tabs (whatever that is).
   Captured Q4 picks for the future redesign:
   - Feed → `home` (lucide)
   - Calendar → `calendar-clock` (lucide)
   - Requests/Data/Settings → still TBD; revisit when bu-icon-nav lands.
2. **Refresh affordance UI.** Reuse whatever the existing `/feed`
   uses on iOS standalone, or build calendar-specific? Recommendation:
   reuse — investigate at session start.
3. **Default selected day in month view on a future month.** When
   user navigates to next month via prev/next chevrons, what's
   selected? Recommendation: first day of that month.

---

## Context

- Bu-event-time brief (the prerequisite).
- Feature spec: `docs/feature-spec/v0.5.docx`.
- Decision log: D036 (feature flags), D017 (add-to-calendar action).
- Parking lot: calendar-adjacent items.
- Design philosophy: Sharon-warmth, no anxiety amplification,
  permission to close.
- Tokens / components: `styles/tokens.css`, `styles/components.css`.
- AppNav: `components/AppNav.tsx`.
- Lucide icons: <https://lucide.dev/icons/>
