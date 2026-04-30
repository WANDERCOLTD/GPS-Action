# ADR-0001 · Structured event-time fields on Post (`event_at`, `event_ends_at`, `location_text`)

**Status:** Accepted
**Date:** 2026-04-30
**Deciders:** Paul (product), Claude Code Session A (implementation)

## Context

`Post` currently has no structured place to store _when_ an event or
meeting happens. Authors of `event` / `meeting` / `happening_now` posts
bury the date, time, and venue in free-form `body` text, which means:

- The feed's "Meetings" / "Events" chips can't render a sortable date.
- The forthcoming **bu-calendar-view** (agenda + month view) has nothing
  structured to query.
- Members reading a card see the time only after parsing prose.

The bu-event-time brief calls for three new nullable columns on `Post`,
an index on `event_at`, and a `kindIsTimeBearing(slug)` helper that
becomes the single source of truth for which kinds surface the new
fields in the composer / PostCard / future calendar.

This ADR documents the schema decision because `prisma/schema.prisma`
is contract-locked (CLAUDE.md "Don't change `prisma/schema.prisma`
without an ADR").

## Options considered

- **Option A — Three columns directly on `Post`** (`event_at DateTime?`,
  `event_ends_at DateTime?`, `location_text String?`). Plain index on
  `event_at`. UTC storage; render `Europe/London` at the UI boundary
  via `date-fns-tz`.
  - Pros: Simplest schema, no joins, fits Prisma's nullable-column
    pattern that already covers `linkUrl`, `heroImageUrl`, etc. Index
    keeps `listUpcoming` fast even when the table grows.
  - Cons: Most posts (currently ~95% of dev seed) will have
    `event_at = NULL`; a plain index spends a few extra bytes per row.

- **Option B — Sidecar table `PostEvent`** with `postId` PK + the three
  fields. Joined when needed.
  - Pros: Zero null storage on non-event posts. Future-proof if events
    grow (recurring rules, ticket links, capacity).
  - Cons: Adds a join + a nullable include path on every list query.
    Premature for a single set of fields; the brief explicitly defers
    recurring + tickets to Phase 3 / parking-lot.

- **Option C — Partial Postgres index** on `event_at WHERE
event_at IS NOT NULL` (still on `Post`, three columns).
  - Pros: Same query shape as Option A, smaller index on disk.
  - Cons: Prisma's `@@index` syntax does not (today) support partial
    indexes cleanly. Would require a raw SQL `CREATE INDEX … WHERE …`
    in the migration that Prisma's introspection can't round-trip.
    Rejected for now per the brief's "plain index is acceptable
    fallback" guidance; can be promoted to a partial index later via
    a follow-up migration once the table grows.

## Decision

We will adopt **Option A**: three nullable columns on `Post` with a
plain B-tree index on `event_at`.

Specifically:

```prisma
model Post {
  // … existing fields …

  // Structured event time (BU-event-time / ADR-0001).
  // UTC storage; UI renders Europe/London via date-fns-tz.
  // Optional for ALL kinds — composer NUDGES (shows pickers) for
  // time-bearing kinds (per kindIsTimeBearing) but the server does
  // not block submission when absent.
  eventAt      DateTime?
  eventEndsAt  DateTime?
  locationText String?

  @@index([eventAt])
}
```

Field shape:

| Column         | Type        | Nullable | Notes                                       |
| -------------- | ----------- | -------- | ------------------------------------------- |
| `eventAt`      | `DateTime?` | yes      | Start of the event, UTC                     |
| `eventEndsAt`  | `DateTime?` | yes      | End of the event, UTC. ≥ `eventAt` if set   |
| `locationText` | `String?`   | yes      | Free-text venue / address line, ≤ 500 chars |

Validation invariant (server + client): if both timestamps are set,
`eventEndsAt >= eventAt`. The composer renders an inline error and
disables submit; the service throws on violation.

Timezone convention:

- **Storage:** all timestamps are UTC (`DateTime` in Prisma → Postgres
  `timestamp(3)`).
- **Render:** `Europe/London` at the UI boundary, via `date-fns-tz`
  (added as a dep in this PR). Never construct local times via raw
  `new Date()` arithmetic.
- **Composer input:** the date+time pickers run in the user's local
  timezone (in practice Europe/London for ~all members); the action
  converts to UTC via `zonedTimeToUtc` before persisting.

**`event_at` is optional for all kinds** — the UI nudges (shows
pickers when `kindIsTimeBearing(kind.slug)` is true) but the server
does not require the field for any kind. This matches Q3 of the
bu-calendar walk-through — keep the schema permissive and let the
composer / edit surface drive the UX nudge.

## Reasoning

- **Single source of truth for "is this kind time-bearing?"** lives in
  `shared/post-kinds.ts` (`kindIsTimeBearing(slug)`). Composer / PostCard
  / bu-calendar-view all consume the same flag. Flipping a kind on or
  off is a one-line change there.
- **Optional-on-server, nudged-in-UI** keeps backward compatibility:
  every existing post in production gets `eventAt = NULL` after the
  migration runs. No data backfill required.
- **Plain index is fine for now.** At MVP scale the index is small
  even with mostly-null values; we can promote to a partial index
  via a follow-up migration when the table grows.
- **UTC + date-fns-tz** matches the established Node ecosystem pattern
  and avoids the DST-edge-case bugs that come from manual timezone
  arithmetic. The brief calls out the 1:30am clock-change weekend as a
  test case — `date-fns-tz` handles that correctly.

## Consequences

- **Easier:**
  - bu-calendar-view can `findMany({ where: { eventAt: { gte: now } }, orderBy: { eventAt: 'asc' } })` directly.
  - The composer renders a real date+time picker for `event` / `meeting` / `happening_now` kinds, replacing the "Date and time fields are coming" hint banner in `PostForm.tsx`.
  - PostCard renders "Sat 3 May · 6pm" prominently for time-bearing posts.

- **Harder:**
  - Three more nullable columns on `Post` (the table is already wide;
    one more dose of the existing pattern, but worth flagging).
  - The composer + edit page must convert local-input → UTC at
    persist time and UTC → local at render time. The `date-fns-tz`
    dep + helpers in `shared/format-event-time.ts` keep that boundary
    in one place.

- **Forward-only migration.** Adding three nullable columns and one
  index is reversible by a follow-up migration; it is not a destructive
  change. The migration runs cleanly on environments where the prior
  Phase 2 PRs have been applied.

- **Layer boundaries respected.** All UTC conversion lives in
  `shared/format-event-time.ts` (services / components both import
  from `shared`). No `app` → `services` import gets added.

## Notes

- Recurring events, "all-day" semantics, iCal export, "add to my
  calendar" buttons, and `publish_at` (schedule-a-post-for-later) are
  explicitly **out of scope** here. They live in
  `docs/product/parking-lot.md`.
- The `calendar_enabled` feature flag is registered in
  `docs/product/feature-flag-register.md` for **bu-calendar-view** to
  consume. This BU's composer / PostCard / edit changes are NOT
  gated behind it — they are evergreen improvements.
- See decision-log entry **D073** (this PR) for the cross-reference.

## Related

- D013 — Self-dispatch is the default (calendar is read-only routing surface).
- D017 — Add-to-calendar action — parked, not in this BU.
- D062 — PostKind as managed table (extended here with `kindIsTimeBearing`).
- D064 — Hero image (the precedent for "optional, member-picked, additive column").
- D070 — Reference data ships in migrations (no new PostKind rows here, only column adds).
- bu-event-time brief — the implementation contract.
- bu-calendar-view brief — the downstream consumer of these fields.
