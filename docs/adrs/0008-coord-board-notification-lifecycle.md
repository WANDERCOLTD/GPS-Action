# ADR-0008 · `Notification` lifecycle and `reasonKind`

**Status:** Accepted (additive; coexists with `readAt` and `type` until consolidation)
**Date:** 2026-05-04
**Deciders:** Paul (product), Claude Code Session A (schema PR)

## Context

Surface 3 (Notifications pane) shows a thin list of alerts. Per
the brief v0.4: rows are tinted (unacknowledged) until clicked,
then become plain white. There is no separate "mark read" gesture
— clicking a row opens the source ticket and auto-acknowledges.

The current `Notification` model has two relevant fields:

- `type: NotificationType` (5 values: `request_status_changed | request_mention | request_resolved | request_published | request_archived`).
- `readAt: DateTime?` — null = unread, non-null = read.

The brief proposes two new fields:

- `lifecycle: NotificationLifecycle` (`new | acknowledged | dismissed`).
- `reasonKind: NotificationReasonKind` (`assignment | mention | status_change | comment | urgent_flip | team_blast`).

`lifecycle` is a 3-state superset of the current 2-state
`readAt` flag — it adds an explicit `dismissed` value (member
swiped away, distinct from "acknowledged via click-through").

`reasonKind` is a coord-board-aware reframing of `type` — values
overlap (e.g. `mention` ≈ `request_mention`) but the new set is
trigger-shaped (what caused the notification) rather than
target-shaped (what kind of object it points to).

This ADR records the additive shape and explains why we keep
the existing fields in place rather than collapse.

## Options considered

- **Option A — Add `lifecycle` and `reasonKind` as new fields;
  keep `readAt` and `type` for backward compat.** Both pairs run
  alongside. New code writes the new fields; legacy queries
  read `type` / `readAt` until migrated.
  - Pros: zero risk to existing notification consumers.
    Truly additive PR. Coord-board reads what it needs.
  - Cons: two pairs of overlapping fields. Sync drift risk
    if writers populate one but not the other.

- **Option B — Reuse `readAt` for lifecycle.** Add a separate
  `dismissedAt: DateTime?` for the dismissed state. Derive
  lifecycle: `dismissedAt != null → dismissed`, `readAt != null → acknowledged`, else → `new`.
  - Pros: no enum, just two timestamps.
  - Cons: 3-state with two timestamps is a derived calculation
    every reader does; an explicit enum is more legible.
    `acknowledged-then-dismissed` ordering must be enforced
    in service code (no DB constraint).

- **Option C — Replace `type` with `reasonKind` directly,
  expand the enum to cover the existing 5 values.** Migrate
  existing rows.
  - Pros: one enum to maintain.
  - Cons: existing `type` values aren't all reason-shaped (e.g.
    `request_published` is a target-state event, not a reason).
    Forcing a one-to-one mapping loses fidelity. Plus this is
    a breaking rename — defeats the additive-only PR plan.

- **Option D — Drop both `lifecycle` and `reasonKind`; reuse
  the current `type` enum with new values added.** No new
  fields.
  - Pros: minimal schema delta.
  - Cons: doesn't model the 3-state lifecycle at all (no
    "dismissed"). Loses Surface 3's swipe-to-dismiss UX target.

## Decision

We adopt **Option A**: add `lifecycle` and `reasonKind` as
additive fields, keep `readAt` and `type`.

```prisma
enum NotificationLifecycle {
  new
  acknowledged
  dismissed
}

enum NotificationReasonKind {
  assignment
  mention
  status_change
  comment
  urgent_flip
  team_blast
}

model Notification {
  // …existing fields (recipientUserId, type, requestId, fromUserId, message, createdAt, readAt, …)
  lifecycle  NotificationLifecycle  @default(new)
  reasonKind NotificationReasonKind?
}
```

Defaults: `lifecycle = new`, `reasonKind = null`. The migration
sets `lifecycle = acknowledged` for any existing row where
`readAt != null` so the two flags remain consistent at cutover.
`reasonKind` is nullable on existing rows (legacy code never
populates it; Surface 3 readers can fall back to `type` when
`reasonKind` is null).

Service-layer dispatch (PR #2 onwards):

| Caller                    | Reads                      | Writes                     |
| ------------------------- | -------------------------- | -------------------------- |
| Existing notifications UI | `type` + `readAt`          | `type` + `readAt`          |
| Surface 3 (kanban)        | `lifecycle` + `reasonKind` | `lifecycle` + `reasonKind` |

When Surface 3 acknowledges via click-through it sets BOTH
`lifecycle = acknowledged` AND `readAt = now()` so legacy
consumers stay correct. Dismiss writes `lifecycle = dismissed`
plus `readAt = now()` (dismissal implies read).

Future BU may consolidate (e.g. drop `type` once all surfaces
read `reasonKind`); that's a separate ADR.

## Reasoning

- **3-state lifecycle is the brief's UX contract.** `new` (tinted),
  `acknowledged` (plain after click-through), `dismissed`
  (swiped away, never re-tinted). Two timestamps cover only
  two of the three; an explicit enum is the simpler model.
- **`reasonKind` is trigger-shaped, `type` is target-shaped.**
  Different mental models. The new field is what Surface 3
  groups by ("3 mentions, 1 status change"); the old field is
  what the legacy inbox displays by ("you have a request_published"). Both shapes have callers; collapsing
  forces one shape on both.
- **Sync writes for the cutover period.** Surface 3 writes both
  `lifecycle` and `readAt` on acknowledge/dismiss so legacy
  queries that filter `WHERE readAt IS NULL` keep working.
  Cost is low (one extra column write per transition).
- **Additive is safe.** Adding two enum-typed fields with sane
  defaults plus an UPDATE for the readAt-derived initial
  lifecycle can't break any existing reader.
- **`reasonKind` is nullable on existing rows.** Backfilling
  legacy rows from `type` would require a one-to-one mapping
  that loses information (`request_published` doesn't map to
  any reason). The brief's reasoning surface (Surface 3) only
  shows kanban-era notifications anyway, which always have
  `reasonKind` set; legacy rows displaying their `type` is
  acceptable.

## Consequences

- **Easier:**
  - Surface 3 renders `WHERE lifecycle = 'new' ORDER BY createdAt` cleanly.
  - Dismiss is a single UPDATE, no new table.
  - Reason-kind grouping ("3 mentions") is a `GROUP BY reasonKind`.
  - PR #1 stays additive.

- **Harder:**
  - Two pairs of overlapping fields. New contributors need the
    dispatch table to know which surface reads which.
  - Writers in PR #2 must populate both fields on cross-cutting
    notifications (e.g. an assignment that's also a status
    change). Documented as the convention in this ADR's
    Notes section below.

- **Forward-only migration.** Two enums + two columns + a
  back-fill UPDATE setting `lifecycle = acknowledged` where
  `readAt != null`. Reversible by drop-column-drop-enum if ever
  needed; not expected.

## Notes

- **Cross-cutting reasons.** A status transition that also
  mentions someone yields one notification per recipient with
  `reasonKind = mention` (the more specific reason wins). The
  service-layer rule lives in PR #2; this ADR notes the
  convention.
- **Capacity callout.** Surface 3's "limited list + auto-scroll
  - View all" UX is a render-side pagination concern — no
    schema impact. The full history `View all` is a separate
    page that pages over the whole table.
- **Trigger rules (Defaults vs Opt-in).** Defaults
  (subscriber-driven) and Opt-in (team-blast) are author-side
  routing logic that lives in `notifications` service code (PR
  #2). The schema is agnostic — every row is just a
  notification with a recipient, lifecycle, and reasonKind.
- **`team_blast` reason** corresponds to opt-in announcements
  per Tier-2 default. Recipients are computed from the target
  group's membership at send time. Mute-per-flag is a per-user
  preference handled in account settings; the notification
  table doesn't need a "muted" state — muted users simply
  don't get the row.

## Related

- D057 — Notification model (BU-requests-vetting).
- D058 — `Request.urgency` (referenced by `reasonKind = urgent_flip`).
- ADR-0007 — `Comment.source = system` (kanban transitions
  written as system comments; some also generate
  notifications).
- bu-coordination-board v0.4 — Surface 3 spec.
