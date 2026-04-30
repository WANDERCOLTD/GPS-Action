---
slug: bu-calendar
status: planned
phase: 2
priority: medium
note: "Bundles schema (event_at fields), composer + edit date pickers, /calendar tab (agenda + month), and seed events into one BU per user direction. Risk-flagged for size — see Open questions for split points if scope creeps."
---

# SESSION BRIEF · BU-calendar — Date/time fields + Calendar tab (agenda + month)

*Brief version: 0.1 (stub) · Author: Paul · Date: 2026-04-30*

---

## Objective

Give time-bearing posts (`meeting`, `event`, `happening_now` — and possibly
`cultural`) structured start/end times so they can be surfaced on a new
`/calendar` tab between Feed and Requests. Members get an agenda view (default,
today-onwards, grouped by day) with an optional month overview. The composer
gains a date/time picker shown conditionally on the chosen kind; the same
picker appears in the post-edit surface. Seed dataset gains a handful of
suitable upcoming events so the calendar isn't empty in dev.

This is a single bundled BU per user direction — schema, composer/edit, view,
and seed all ship together. **Note:** without `event_at` data the existing
`/feed` "Meetings" / "Events" chips already do everything a calendar tab
could do, so the schema half is the value-creator and the view half is the
visible delivery — both must land for this BU to mean anything.

---

## Pre-requisites (do these before opening the brief proper)

- **ADR required.** `prisma/schema.prisma` is contract-locked per CLAUDE.md;
  adding `event_at` (and friends) to `Post` needs a fresh ADR drafted from
  `docs/adrs/0000-template.md` and merged (or merged in the same PR with
  reviewer ack). The ADR fixes:
  - exact field names, types, nullability
  - which post kinds make `event_at` required vs optional vs irrelevant
  - timezone storage convention (recommend UTC in DB; render Europe/London
    in UI for v1 since membership is UK-based)
- **Read** `docs/product/parking-lot.md` sections "Schedule a post for
  later" and "Add to calendar" — calendar-adjacent ideas already parked.
  Confirm whether any are now ABSORBING for v0.6.

---

## Scope

### Build in this session

**Schema + migration:**
- `prisma/schema.prisma` (MODIFY — add `event_at DateTime?`,
  `event_ends_at DateTime?`, `location_text String?` to `Post`. Index
  `event_at` for calendar range queries.)
- `prisma/migrations/<timestamp>_add_event_time_to_post/migration.sql`
  (new — generated via `prisma migrate dev`; idempotent forward-only.)

**Server — services:**
- `server/services/post.ts` (MODIFY — `createPost` and `updatePost` accept
  `eventAt` / `eventEndsAt` / `locationText`; new `listUpcomingEvents`
  returning posts with `event_at >= startOfToday` ordered ascending,
  filtered to time-bearing kinds.)

**Server — router:**
- `server/routers/post.ts` (MODIFY — `.create` and `.update` input schemas
  accept the new fields; new `.listUpcoming` query for the calendar view.)

**Shared:**
- `shared/validation/post.ts` (MODIFY — Zod schemas for new fields; rule
  enforcement for which kinds permit/require `event_at`.)
- `shared/post-kinds.ts` (MODIFY — add a `timeBearing: boolean` flag per
  kind so composer + calendar logic share the same source of truth.)

**Client — composer:**
- `app/compose/page.tsx` and the form components (MODIFY — when selected
  kind has `timeBearing: true`, show date/time picker fields. Hide
  otherwise. Match existing form visual register.)

**Client — edit surface (verify before building):**
- *If* `app/post/[id]/edit/` exists: MODIFY to add the same picker.
- *If not:* this is an open question (see below). Edit surface scope may
  defer to a follow-up brief.

**Client — calendar tab (new route):**
- `app/calendar/page.tsx` (new — server component, agenda by default;
  `?view=month` for month overview.)
- `app/calendar/AgendaView.tsx` (new — flat list grouped by day:
  "Today" · "Tomorrow" · "Sat 3 May" headers; each row is a compact
  post card with prominent time + location.)
- `app/calendar/MonthView.tsx` (new — month grid, dot/badge per day with
  events; tap day → that day's agenda inline or in a sheet.)
- `app/calendar/CalendarToggle.tsx` (new — agenda ↔ month switch; URL-
  driven so back button works.)

**Client — nav:**
- `components/AppNav.tsx` (MODIFY — insert Calendar tab between Feed and
  Requests. Icon: `calendar-days` (lucide). Label: see Open questions
  re "Calendar" vs "Coming up" vs "Diary".)

**Client — post card:**
- `components/PostCard.tsx` (MODIFY — when `event_at` is set, render
  absolute date + time prominently above the relative `createdAt`.
  Cultural kind keeps bordeaux (#6B3045) styling.)

**Seed:**
- `scripts/seed.ts` (MODIFY — add ~6–10 dev events spread across the next
  4 weeks. Mix of `meeting`, `event`, `happening_now`, and (if confirmed)
  one `cultural` Shabbat post. Idempotent — keyed on a stable seed-only
  identifier so re-running doesn't duplicate.)

**Tests:**
- `tests/integration/calendar.test.ts` (new — `listUpcomingEvents`
  filters correctly; ordering; respects visibility.)
- `tests/integration/post-event-fields.test.ts` (new — create/update
  with event fields; validation rules.)
- `tests/components/AgendaView.test.tsx` (new — grouping by day,
  empty state.)
- `tests/components/MonthView.test.tsx` (new — dot rendering, day-tap.)

**Docs / READMEs touched:**
- `app/calendar/README.md` (new)
- `docs/architecture/decision-log.md` (new D-entry for the schema add)
- README updates per CLAUDE.md "update README.md in directories you touch"

### Do NOT touch

- `prisma/migrations/` historical migrations (forward-only).
- `REQUIRED_POST_KIND_SLUGS` / reference data — no new kinds in this BU.
- Feed filter chips (`shared/feed-filters.ts`, `app/feed/`) — calendar is
  additive, not a replacement. Chips stay kind-slug based for now; their
  filtering does not need to start considering `event_at`.
- WhatsApp dispatch surface — calendar doesn't dispatch.
- `components/AppNav.tsx` for anything beyond inserting the Calendar tab.
- Composer FAB intent picker logic — only the date/time field block changes.

### Out of scope

- **Recurring events.** Single-instance only. Defer to Phase 3.
- **All-day events as a flag.** v1: if `event_ends_at` is null, treat as
  point-in-time; if both set, render as a range. No `is_all_day` boolean.
- **iCal / .ics export, "add to my calendar" button.** Tracked in
  parking-lot — separate BU.
- **Schedule-a-post-for-later.** This BU adds `event_at` (when the event
  happens), NOT `publish_at` (when the post becomes visible). Parking-
  lot item; separate BU.
- **Notification reminders before events.** Separate BU.
- **Week view.** Recommendation in exploration was to skip; do not build.
- **Day view (hourly grid).** Skip — agenda covers it.

---

## Contracts

### Inputs consumed

- `Post`, `PostKind` types from existing Prisma client + `shared/types`.
- `formatDistanceToNow` from `date-fns` (already used).
- Existing visibility / authz logic in `server/services/post.ts` —
  calendar respects the same visibility rules as `/feed`.
- `AppNav` icon set (lucide).

### Outputs produced

- `Post.event_at`, `Post.event_ends_at`, `Post.location_text` columns
  (nullable; indexed on `event_at`).
- `post.listUpcoming` tRPC query (input: optional `from`/`to` range,
  optional `kindSlugs[]`; output: posts ordered by `event_at` asc).
- `kindIsTimeBearing(slug): boolean` helper in `shared/post-kinds.ts`.
- `/calendar` route, `?view=agenda|month` URL contract.
- New AppNav tab: `Calendar` between Feed and Requests.

---

## Acceptance criteria

- [ ] Composer with kind = `meeting` shows date + time pickers; with
      `link_share` does not.
- [ ] Submitting an event-bearing post persists `event_at` (and optional
      end / location); appears on `/calendar` and `/feed`.
- [ ] Editing an existing post updates `event_at` (or scope deferred —
      see open questions).
- [ ] `/calendar` (default agenda) shows posts with `event_at >= today
      00:00 Europe/London`, grouped by day, ordered ascending by time.
- [ ] `/calendar?view=month` shows current month grid with a dot/badge
      per day that has events; tapping a day reveals that day's items.
- [ ] Empty state: "No upcoming events" with a link to compose.
- [ ] Past events do not appear in agenda; "Earlier today" header
      shows items earlier today only (decision: confirm).
- [ ] PostCard with `event_at` shows absolute date + time prominently;
      cultural posts keep bordeaux styling.
- [ ] AppNav: tabs render in order Feed · Calendar · Requests · Data ·
      Settings; active state on `/calendar` highlights correctly.
- [ ] Seed produces visible events in `npm run dev`; re-seed is
      idempotent.
- [ ] iOS standalone (PWA): in-tab refresh affordance present; pull-
      to-refresh isn't relied on.
- [ ] Visibility rules: a logged-out viewer sees only public events;
      logged-in members see public + members-only.
- [ ] Accessibility: pickers keyboard-operable; agenda day headers are
      proper landmarks; month grid is screen-reader navigable.
- [ ] `npm run typecheck && npm run lint && npm test` all pass.

---

## Permission matrix

| Action                          | Member | Writer | Coordinator | Director |
|---------------------------------|:------:|:------:|:-----------:|:--------:|
| Create post with `event_at`     |   ✓    |   ✓    |      ✓      |    ✓     |
| Edit own post's `event_at`      |   ✓    |   ✓    |      ✓      |    ✓     |
| Edit others' posts' `event_at`  |   —    |   —    |   ✓ (region)|    ✓     |
| View `/calendar` (public)       |   ✓    |   ✓    |      ✓      |    ✓     |
| View members-only events        |   ✓    |   ✓    |      ✓      |    ✓     |

(Logged-out: public events only.)

---

## UI states

| State              | Trigger                                  | What user sees                                               |
|--------------------|------------------------------------------|--------------------------------------------------------------|
| Agenda — populated | Default `/calendar`, events exist        | Day-grouped list, today highlighted                          |
| Agenda — empty     | No events ≥ today                        | "No upcoming events" + link to compose                       |
| Month — populated  | `?view=month`, events exist              | Month grid with dots; today ringed                           |
| Month — day tap    | User taps a day                          | That day's events expand inline or in a bottom sheet         |
| Month — empty      | No events in month                       | Greyed grid + "Nothing scheduled this month"                 |
| Composer — toggled | Kind switched to/from time-bearing       | Date/time block fades in/out; values preserved if re-toggled |
| Edit — bearing     | Editing a meeting/event                  | Picker pre-filled with stored value                          |
| Validation error   | End before start, or start in past       | Inline error; submit disabled                                |
| Loading            | Initial fetch                            | Skeleton day rows / month grid                               |
| Error              | Query fails                              | Retry banner                                                 |

---

## Tests required

- Unit: `kindIsTimeBearing` source-of-truth helper.
- Integration: `listUpcomingEvents` filters by date range, kind, visibility.
- Integration: create + update with event fields; reject invalid ranges.
- Component: AgendaView grouping; MonthView dot rendering + day expansion.
- Manual click-through: composer toggle, agenda + month, iOS PWA shell.

Not required:

- E2E browser automation.
- Performance benchmarks (small dataset assumption).

---

## Scenarios to verify against

- Any meeting/event scenarios in `docs/product/scenarios.md` (executing
  session: grep for "meeting" / "event" / "Shabbat" and walk each).
- Cultural moment scenarios — confirm bordeaux styling on calendar rows.
- Logged-out viewer scenario — confirm public-only filtering.

---

## Known gotchas

- **Timezone.** Store UTC; render in `Europe/London` for v1. Don't lean
  on the browser's locale — UK membership means assumed local time.
- **DST transitions.** Use `date-fns-tz` (or equivalent already in deps)
  for safe conversion at the render boundary; never construct local
  times via raw `new Date()` arithmetic.
- **iOS standalone PWA.** No native pull-to-refresh on the home-screen
  app — calendar must include an in-tab refresh affordance (per existing
  project memory). A stale calendar is worse than a stale feed.
- **Event-only-today vs ongoing.** A meeting that started 30 min ago
  but ends in 2 hours: still shows under "Today" with a "Now" badge.
- **Past edits.** Editing a past event's `event_at` to the future is
  allowed — the post simply re-enters the calendar. No special-case.
- **Index pressure.** `event_at` index makes range queries cheap, but
  the column is nullable and most posts will have it null — ensure the
  index is partial (`WHERE event_at IS NOT NULL`) if Postgres supports
  it cleanly via Prisma raw SQL, otherwise plain index is fine for
  current volume.
- **Cultural Shabbat posts.** If `cultural` becomes time-bearing, the
  weekly Shabbat post will appear every Friday on the calendar — confirm
  this is desired UX, not noise.
- **Composer kind toggle preserving values.** If a user types a date,
  switches kind to non-bearing, then back, preserve their date in form
  state (per Sharon-warmth — don't punish exploration).

---

## Definition of done

- [ ] All files in "Build" list created/modified; "Don't touch" untouched.
- [ ] ADR merged for `Post` schema additions (or in same PR, with reviewer ack).
- [ ] Migration runs forward cleanly; no destructive ops.
- [ ] `npm run typecheck && npm run lint && npm test` green.
- [ ] Manual click-through: compose meeting → see on agenda → switch
      to month → tap day → confirm appearance.
- [ ] iOS PWA tested: refresh affordance works.
- [ ] README files in touched directories updated.
- [ ] `package.json` version bumped per `docs/process/versioning.md`.
- [ ] Brief front-matter flipped to `status: shipped`, `shipped_in: "#NNN"`.
- [ ] `npm run trackers` run; `bu-sequence.md` AUTOGEN regions updated.
- [ ] No `any`, no `@ts-ignore`, no skipped pre-commit hooks.

---

## Open questions to surface

1. **Edit surface.** `/app/post/[id]/edit/` doesn't appear to exist. Three
   options: (a) build a minimal edit page as part of this BU, (b) defer
   edit support to a follow-up BU once a generic edit surface lands,
   (c) ship compose-only and accept that fixing a typo means delete +
   recreate. **Recommendation:** (b). User decides.
2. **Should `cultural` (Shabbat / remembrance) become time-bearing?**
   It conceptually has a date/time. Pro: fits naturally on calendar,
   gives Shabbat its own weekly anchor. Con: cultural is meant to be
   "quiet" — calendar surfacing might over-amplify. **Recommendation:**
   yes, but rendered with bordeaux marker styling and no urgency cues.
3. **Required vs optional `event_at` per kind.** Suggest:
   - `meeting`, `event`: required (UI enforces, server validates)
   - `happening_now`: optional (often genuinely "right now, no end time")
   - `cultural`: optional (depends on Q2)
   - all others: not offered
4. **Tab label.** "Calendar" vs "Coming up" vs "Diary" vs "What's on".
   "Coming up" reads warmest (Sharon-warmth) but is longer. Need user pick.
5. **Past-items policy.** Drop everything before today 00:00? Show
   "Earlier today" header for items earlier today? "Yesterday" header
   for one day back? **Recommendation:** today 00:00 is the cutoff;
   "Earlier today" appears as the first header if any items are past
   in the current day. No yesterday rollback.
6. **Month view day-tap.** Inline expansion below the grid, or a bottom
   sheet, or navigation to `/calendar/<date>`? **Recommendation:** inline
   expansion below the tapped row of the grid — minimum navigation, mobile-
   friendly.
7. **Agenda horizon.** How far forward does it scroll? Infinite? 90 days?
   Until-no-more-events? **Recommendation:** until-no-more-events with a
   "Nothing further scheduled" footer. No pagination at current volume.
8. **Bottom-sheet vs full-page month.** On narrow screens does month
   view scroll independently or live in a sheet over the agenda?
   **Recommendation:** full-page route with toggle, not a sheet.
9. **Feature flag?** Per D036, new features go behind a flag by default.
   Confirm `calendar_enabled` flag is wanted; if so, register in
   `docs/product/feature-flag-register.md`.
10. **Scope size.** This bundles schema + composer + edit + view + seed.
    If the executing session feels it's too much for one PR, the natural
    split is: (i) schema + composer + seed + PostCard display, (ii)
    `/calendar` tab (agenda + month) + nav. Each is independently shippable.

---

## Context

- Feature spec: `docs/feature-spec/v0.5.docx` — meeting/event kinds
  defined; calendar view not yet specified.
- Decision log: `docs/architecture/decision-log.md` — new D-entry needed
  for the schema add. Cross-reference D017 (add-to-calendar action) and
  D051 (BU naming).
- Parking lot: `docs/product/parking-lot.md` — "Schedule a post for
  later" (separate BU), "Add to calendar action" (separate BU), naming
  exploration (Calendar vs Coming up).
- Design philosophy: `docs/product/design-philosophy.md` —
  Sharon-warmth, no anxiety amplification, permission to close.
- Tokens / components: `styles/tokens.css`, `styles/components.css`.
- Existing nav: `components/AppNav.tsx`.
- PostKind seed: `prisma/migrations/20260428120000_seed_remaining_postkinds/`.
- Existing relative-time pattern: `components/PostCard.tsx`
  (`formatDistanceToNow`).

---

## Sequencing note

If the executing session needs to split this BU mid-stream (per Open
Questions Q10), the natural break is between **schema/composer/seed/
PostCard** (BU-event-time) and **calendar tab/agenda/month/nav**
(BU-calendar-view). Both are independently shippable; BU-event-time
is the prerequisite. Document the split in a follow-up brief and a
`/handoff` doc rather than ploughing on tired.
