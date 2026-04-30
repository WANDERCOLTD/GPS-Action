---
slug: bu-event-time
status: planned
phase: 2
priority: high
note: "Prerequisite for bu-calendar-view. Independently shippable: enriches /feed Meeting/Event cards with absolute date+time even before the calendar tab lands. Split from bu-calendar on 2026-04-30."
---

# SESSION BRIEF · BU-event-time — Structured event fields on Post (schema + composer + edit + display)

*Brief version: 1.0 · Author: Paul · Date: 2026-04-30*

---

## Objective

Add structured event-time data to `Post` so meeting/event posts carry
a real date, end-time, and location instead of burying it in body text.
Surface those fields in the composer and the post-edit page; render
them prominently on PostCard. Seed dev events so downstream UIs have
data to render.

This BU is the **prerequisite for bu-calendar-view**. It is also
independently valuable: once shipped, the existing `/feed` "Meetings"
and "Events" chips show "Sat 3 May · 6pm" on each card, and the
composer no longer asks members to put the time in free text.

---

## Pre-requisites

- **ADR required.** `prisma/schema.prisma` is contract-locked. Draft an
  ADR from `docs/adrs/0000-template.md` covering:
  - field names: `event_at`, `event_ends_at`, `location_text`
  - types: `DateTime?`, `DateTime?`, `String?`
  - index on `event_at` (partial where `event_at IS NOT NULL` if
    Prisma + Postgres allow cleanly; plain index is acceptable fallback)
  - timezone convention: store UTC; render `Europe/London` at the
    UI boundary using `date-fns-tz`
  - decision: **`event_at` is optional for all kinds** (per
    Q3 of bu-calendar walk-through). UI nudges; server does not block.
  ADR can land in the same PR as this BU with reviewer ack.
- **Read** `docs/product/parking-lot.md` — "Schedule a post for later"
  and "Add to calendar" sections are calendar-adjacent but **not** in
  this BU. This BU does not add `publish_at`.

---

## Scope

### Build in this session

**Schema + migration:**
- `prisma/schema.prisma` (MODIFY — add `event_at`, `event_ends_at`,
  `location_text` to `Post`; add index on `event_at`.)
- `prisma/migrations/<timestamp>_add_event_time_to_post/migration.sql`
  (new — generated via `prisma migrate dev`; idempotent forward-only.)

**Shared / source-of-truth:**
- `shared/post-kinds.ts` (MODIFY — add `timeBearing: boolean` to each
  PostKind config. v1 values: `meeting: true`, `event: true`,
  `happening_now: true`, all others `false`. Export
  `kindIsTimeBearing(slug): boolean` helper. **This flag is the single
  source of truth** consumed by composer (show/hide picker), PostCard
  (show/hide event row), and bu-calendar-view (filter inclusion).
  Per Q2 — flipping a kind on/off in future is a one-line change here.)
- `shared/validation/post.ts` (MODIFY — Zod schemas accept new fields;
  enforce `event_ends_at >= event_at` when both present; otherwise
  optional.)

**Server — services:**
- `server/services/post.ts` (MODIFY — `createPost` and `updatePost`
  accept `eventAt` / `eventEndsAt` / `locationText`. Add new
  `listUpcoming({ from?, to?, kindSlugs? })` returning posts where
  `event_at >= from` (default: today 00:00 Europe/London) ordered
  ascending. Respects existing visibility rules.)

**Server — router:**
- `server/routers/post.ts` (MODIFY — `.create` and `.update` input
  schemas accept new fields; new `.listUpcoming` query.)

**Client — composer:**
- `app/compose/page.tsx` and the form components (MODIFY — when
  `kindIsTimeBearing(selectedKind)` is true, show date + time pickers
  for start and (optional) end + a `location_text` input. Hide
  otherwise. Preserve form-state values across kind toggles per
  Sharon-warmth.)

**Client — edit page (NEW SURFACE):**
- `app/post/[id]/edit/page.tsx` (new — server component, full edit
  surface for own posts: title, body, visibility, link, event fields.
  Coordinator/director can edit others' posts within their region/all.)
- `app/post/[id]/edit/actions.ts` (new — server action `updatePostAction`
  wrapping the tRPC `.update` mutation, mirrors compose pattern.)
- `app/post/[id]/edit/EditForm.tsx` (new — shares date/time picker
  components with compose; pre-filled with stored values.)

**Client — display:**
- `components/PostCard.tsx` (MODIFY — when `event_at` is set, render
  absolute date + time prominently above the relative `createdAt`.
  If `event_ends_at` set, render as range. If `location_text` set,
  render below time. Cultural kind keeps bordeaux (#6B3045) styling.)

**Seed:**
- `scripts/seed.ts` (MODIFY — add ~6–10 dev events spread across the
  next 4 weeks. Mix of `meeting`, `event`, `happening_now`. Idempotent —
  keyed on a stable seed-only identifier so re-running doesn't
  duplicate.)

**Feature-flag register:**
- `docs/product/feature-flag-register.md` (MODIFY — register
  `calendar_enabled`. Default OFF for members in production, ON in
  dev. **Note:** this BU does **not** gate composer/PostCard/edit
  changes behind the flag — those are evergreen improvements.
  bu-calendar-view consumes the flag at the route + nav-tab boundary.)

**Tests:**
- `tests/integration/post-event-fields.test.ts` (new — create + update
  with event fields; validation rules; visibility filtering on
  `listUpcoming`.)
- `tests/integration/list-upcoming.test.ts` (new — `today 00:00`
  cutoff, ordering, kind filter, range query.)
- Existing PostCard / composer tests updated to cover new fields.

**Docs / READMEs:**
- ADR file in `docs/adrs/`.
- `docs/architecture/decision-log.md` (new D-entry referencing ADR).
- README updates per CLAUDE.md "update README.md in directories you
  touch."

### Do NOT touch

- Feed filter chips (`shared/feed-filters.ts`, `app/feed/`) — chips
  stay kind-slug based. Calendar-style filtering is bu-calendar-view's
  surface.
- AppNav (`components/AppNav.tsx`) — no nav changes here. Calendar tab
  is bu-calendar-view's job.
- `REQUIRED_POST_KIND_SLUGS` / reference data — no new kinds.
- Historical migrations (forward-only).
- WhatsApp dispatch surface.
- Composer FAB intent picker logic — only the field block changes.

### Out of scope

- `/calendar` route, agenda view, month view → bu-calendar-view.
- Recurring events. Single-instance only. Defer to Phase 3.
- All-day events as a flag. v1: range = both set; point-in-time = end null.
- iCal / .ics export, "add to my calendar" button. Parking-lot.
- Schedule-a-post-for-later (`publish_at`). Parking-lot.
- Notification reminders before events. Separate BU.

---

## Contracts

### Inputs consumed

- `Post`, `PostKind` types from existing Prisma client + `shared/types`.
- `formatDistanceToNow` from `date-fns` (already used).
- `date-fns-tz` (add to deps if not present) for UTC ↔ Europe/London.
- Existing visibility / authz logic in `server/services/post.ts`.

### Outputs produced (consumed by bu-calendar-view)

- `Post.event_at`, `Post.event_ends_at`, `Post.location_text` columns
  (nullable; indexed on `event_at`).
- `post.listUpcoming` tRPC query — input: optional `from` / `to` /
  `kindSlugs[]`; output: posts ordered by `event_at` asc.
- `kindIsTimeBearing(slug): boolean` helper in `shared/post-kinds.ts`.
- `calendar_enabled` flag registered (consumed by bu-calendar-view).

---

## Acceptance criteria

- [ ] `event_at` migration runs forward cleanly; rollback path documented in ADR.
- [ ] Composer with kind = `meeting` shows date + time pickers + location;
      with `link_share` does not. Toggling between preserves typed values.
- [ ] Submitting an event-bearing post persists all three fields.
- [ ] Editing an existing post via `/post/[id]/edit` updates all fields,
      including the event fields where the kind permits.
- [ ] PostCard with `event_at` shows absolute date + time prominently;
      if `event_ends_at` set, shows as range; cultural posts keep
      bordeaux styling.
- [ ] `listUpcoming` returns posts with `event_at >= today 00:00
      Europe/London` ordered ascending; respects visibility.
- [ ] `kindIsTimeBearing` is the source of truth for all UI gating.
      Flipping a kind's flag changes composer behaviour without code
      branches elsewhere.
- [ ] Validation: `event_ends_at < event_at` is rejected at server +
      shown inline in composer/edit.
- [ ] Permission: a Member can edit own posts; Coordinator can edit
      within region; Director can edit all.
- [ ] Seed produces visible events in `npm run dev`; re-seed idempotent.
- [ ] Accessibility: pickers keyboard-operable; date and time inputs
      have proper labels.
- [ ] `npm run typecheck && npm run lint && npm test` all pass.

---

## Permission matrix

| Action                          | Member | Writer | Coordinator | Director |
|---------------------------------|:------:|:------:|:-----------:|:--------:|
| Create post with event fields   |   ✓    |   ✓    |      ✓      |    ✓     |
| Edit own post (any field)       |   ✓    |   ✓    |      ✓      |    ✓     |
| Edit others' posts              |   —    |   —    |   ✓ (region)|    ✓     |
| View posts (public)             |   ✓    |   ✓    |      ✓      |    ✓     |

---

## UI states

| State                  | What user sees                                     |
|------------------------|----------------------------------------------------|
| Composer — bearing on  | Date + time + (optional) end + location fields     |
| Composer — bearing off | No event fields                                    |
| Composer — toggled     | Values preserved across kind switches              |
| Edit — bearing         | Picker pre-filled with stored value                |
| Edit — non-bearing     | No event fields rendered (data preserved if exists)|
| Validation: end<start  | Inline error; submit disabled                      |
| PostCard — point-in-time | "Sat 3 May · 6pm"                                |
| PostCard — range       | "Sat 3 May · 6–8pm" or "Sat 3 May 6pm – Sun 4 May 9am" |
| PostCard — with location | Time line + small location below                 |

---

## Tests required

- Unit: `kindIsTimeBearing` source-of-truth helper.
- Unit: Zod validation rules (end before start; optional fields).
- Integration: `listUpcoming` filters, ordering, visibility, today-cutoff.
- Integration: create + update with event fields.
- Component: PostCard event display, composer toggle, edit form.

---

## Known gotchas

- **Timezone.** Store UTC; render Europe/London. Use `date-fns-tz`.
  Never construct local times via raw `new Date()` arithmetic.
- **DST transitions.** Verify a post created at 1:30am clock-change
  weekend renders correctly on both sides of the boundary.
- **Composer kind toggle.** Preserve typed values across toggles per
  Sharon-warmth.
- **Past edits.** Editing a past event's `event_at` to the future is
  allowed — the post simply re-enters the upcoming window.
- **Index strategy.** Most posts will have `event_at` null. Partial
  index preferred (`WHERE event_at IS NOT NULL`); plain index is fine
  fallback.
- **Edit page is new.** No prior `app/post/[id]/edit/` exists. Build
  the full edit surface, not just an event-fields shim.

---

## Definition of done

- [ ] All files in "Build" list created/modified; "Don't touch" untouched.
- [ ] ADR merged (or in same PR with ack).
- [ ] Migration runs forward cleanly.
- [ ] `npm run typecheck && npm run lint && npm test` green.
- [ ] Manual click-through: compose meeting → edit it → see updated
      time on /feed PostCard.
- [ ] README files in touched directories updated.
- [ ] `package.json` version bumped.
- [ ] Brief front-matter flipped to `status: shipped`, `shipped_in: "#NNN"`.
- [ ] `npm run trackers` run; `bu-sequence.md` AUTOGEN regions updated.
- [ ] No `any`, no `@ts-ignore`, no skipped pre-commit hooks.

---

## Parallel-execution note for the team

This BU produces the schema + query that bu-calendar-view consumes.
Two execution paths:

1. **Sequential merge:** Land this BU's PR first; bu-calendar-view
   branches from main after merge.
2. **Parallel work, sequential merge:** bu-calendar-view starts
   immediately, branched from this BU's branch (not main). Rebases
   periodically. Merges only after this BU merges. Recommended for
   speed if both agents are available.

Either way, **bu-calendar-view should not merge before this one.**

---

## Context

- Feature spec: `docs/feature-spec/v0.5.docx` — meeting/event kinds
  defined; structured time not yet specified.
- Decision log: `docs/architecture/decision-log.md` — new D-entry needed
  for the schema add. Cross-reference D017 (add-to-calendar action).
- Parking lot: `docs/product/parking-lot.md` — calendar-adjacent items.
- Design philosophy: `docs/product/design-philosophy.md`.
- Tokens / components: `styles/tokens.css`, `styles/components.css`.
- PostKind seed: `prisma/migrations/20260428120000_seed_remaining_postkinds/`.
- ADR template: `docs/adrs/0000-template.md`.
