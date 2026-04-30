---
slug: bu-month-nav
status: shipped
phase: 2
priority: medium
shipped_in: "#153"
note: "Follow-up to bu-calendar-view: smart default anchor + prev/next chevrons in /calendar?view=month."
---

# SESSION BRIEF · BU-month-nav — Smart anchor + prev/next chevrons for `/calendar?view=month`

*Brief version: 1.0 · Author: Paul · Date: 2026-04-30*

---

## Objective

Tighten the month grid on `/calendar?view=month` so it actually
surfaces upcoming events without the user having to know to skip
ahead. Two tightly-related UX gaps fall out of bu-calendar-view:

- **A. Smart default anchor.** Today (30 Apr 2026) every seeded event
  falls on or after 1 May, so anchoring on "current month" lands the
  user on an empty April grid. The default anchor must be the month
  containing the *next upcoming event*, falling back to the current
  month only if there are no upcoming events at all.
- **B. Prev/next month navigation.** The grid currently has no
  chevrons; once rendered the user is stuck on whichever month
  was chosen. bu-calendar-view explicitly punted this to a follow-up
  BU — that's this one.

Both ship together so the UX gap closes in one PR.

---

## Scope

### Build in this session

**Client — calendar route:**

- `app/calendar/page.tsx` (MODIFY)
  - Parse `?month=YYYY-MM` from `searchParams`. Valid → anchor on
    first-of-that-month in Europe/London.
  - Invalid / missing `?month=` → query `listUpcoming({ from: today
    00:00 London, limit: 1 })`; if a row comes back, anchor on the
    month containing its `eventAt`. Otherwise fall back to current
    month.
  - Compute `monthEnd` TZ-safely via `toZonedTime` / `endOfMonth` /
    `fromZonedTime` (mirrors `MonthGrid.buildMonthGridDays`). The
    existing `endOfMonth(monthAnchor)` is buggy on UTC hosts.
  - Compute `prevMonthHref` / `nextMonthHref` URLs in `?view=month
    &month=YYYY-MM` form.
- `app/calendar/MonthView.tsx` (MODIFY)
  - Accept `prevMonthHref?: string`, `nextMonthHref?: string`.
  - Render `ChevronLeft` / `ChevronRight` `<Link>` icons flanking
    the existing month-label heading. Testids:
    `calendar-month-prev-link`, `calendar-month-next-link`. Aria
    labels: `Previous month`, `Next month`.

**Tests:**

- `tests/integration/calendar-route.test.tsx` (EXTEND)
  - `?month=2026-05` renders May.
  - No `?month=` and there are upcoming events → anchors on the
    next-event's month.
  - No `?month=` and no upcoming events → anchors on current month.
  - Invalid `?month=` (e.g. `2026-13`, `xyz`) → falls back to smart
    default.
- `tests/unit/calendar-month-view.test.tsx` (EXTEND)
  - Chevron testids + aria-labels render when hrefs are passed.
  - Hrefs absent → chevrons not rendered.

**Docs / housekeeping:**

- `app/calendar/README.md` — document `?month=YYYY-MM` URL contract +
  chevron behaviour.
- Bump `package.json` to `0.2.29`.
- Flip `status: shipped` + `shipped_in:` after PR opens.
- `npm run trackers` to regenerate `bu-sequence.md` AUTOGEN regions.
- `npm run trace:matrix` if the trace matrix touches anything.

### Do NOT touch

- `MonthGrid.tsx` — the grid math is already TZ-safe; no changes
  needed.
- `AgendaView.tsx` — agenda is unaffected.
- `server/services/post.ts` / `server/routers/post.ts` — query is
  unchanged; we just call it twice (once with `limit: 1` for the
  anchor probe, once for the visible-month posts).
- `prisma/schema.prisma`.
- `shared/format-event-time.ts` — reuse helpers; do not duplicate
  TZ math.

### Out of scope

- Year-jump / month picker dropdown.
- Keyboard shortcuts for prev/next (parking-lot).
- Caching the anchor probe (negligible — one row, indexed query).

---

## Acceptance criteria

- [ ] `/calendar?view=month` with no `?month=` defaults to **the
      month containing the next upcoming event**, not "today's month".
- [ ] `/calendar?view=month&month=2026-05` renders May 2026.
- [ ] Invalid `?month=` values are ignored and fall back to the
      smart default.
- [ ] Prev/next chevrons appear next to the month-label heading.
- [ ] Tapping prev/next updates the URL and renders the adjacent
      month.
- [ ] When viewing May 2026, the seeded events show as dots on the
      right days; tapping a dotted day reveals the events below.
- [ ] Prev chevron works even when prev month is in the past (no
      cap; agenda enforces "today onwards", not month).
- [ ] Next chevron works arbitrarily far into the future.
- [ ] aria-labels: `Previous month`, `Next month`. Testids:
      `calendar-month-prev-link`, `calendar-month-next-link`.
- [ ] All quality gates green (typecheck / lint / test) under
      `TZ=UTC`.
