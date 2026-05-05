# Feature flag register

> Live registry of every `FeatureFlag` row in the database, plus the
> rationale for each. Per **D036** every flag must be listed here
> alongside its purpose, default state, and rollout / TTL plan.
>
> **Per D070, every flag in this table must have an idempotent
> migration entry.** New flag → add a row to the latest
> `prisma/migrations/<ts>_seed_feature_flags*` migration (or a fresh
> follow-up) with `INSERT … ON CONFLICT (name) DO NOTHING`. Without
> the migration, prod boots with the row absent and the fail-closed
> evaluator returns `false` regardless of the default in this table.
>
> The discipline (D036, abridged):
>
> 1. Every new feature lands with `enabledGlobally=false`. Default OFF.
> 2. Every flag declares its `purpose`. Generic flags rejected in review.
> 3. Rollout flags must have `ttl_remove_after`. Default: 90 days.
> 4. Kill switches are permanent and have a named owner.
> 5. No nested flags. If a feature needs two flags, the feature is too big.
> 6. Flags evaluated server-side. Clients never see flag names.
> 7. Every flag flip is audit-logged: who, when, old state, new state, reason.
> 8. Test suite must cover feature behaviour in both states.

## Active flags

| Name               | Purpose | Default (prod)         | Default (dev) | TTL / owner     | Notes                                                                                                |
| ------------------ | ------- | ---------------------- | ------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| `ff_reactions`     | rollout | enabled (post-rollout) | ON            | TTL: 2026-09-01 | Quiet, multi-select reactions on posts. BU-reactions / D050. Live since BU-reactions shipped.        |
| `ff_comments`      | rollout | enabled (post-rollout) | ON            | TTL: 2026-09-01 | Post-detail page + flat comment thread. BU-comments / D052. Live since BU-comments shipped.          |
| `calendar_enabled` | rollout | OFF                    | ON            | TTL: 2026-10-30 | Calendar tab + agenda + month surfaces. BU-calendar-view (downstream of BU-event-time / D073).       |
| `coord_board_v1`   | rollout | OFF                    | OFF           | TTL: 2026-11-03 | Board tab in `AppNav` + `/board` placeholder. BU-coordination-board (planned, Direction A — kanban). |

## Flag rationale

### `calendar_enabled`

- **Build unit:** BU-calendar-view (consumes the flag). Schema +
  composer + edit + PostCard surfaces ship in **BU-event-time / D073**
  evergreen — they are NOT gated behind the flag.
- **What it gates:** the `/calendar` route, the calendar tab in
  `AppNav`, and the agenda + month views. Members in production see
  the structured event-time data on PostCards regardless; the flag
  only controls whether the dedicated calendar surface is reachable.
- **Default OFF in prod:** the agenda surface needs real-world testing
  with a non-trivial event volume before we expose it to all members.
  Coordinator preview goes first; gradual rollout follows.
- **Default ON in dev:** the seed (BU-event-time) plants ~8 future
  events so dev / preview can render a non-empty calendar from day
  one.
- **TTL:** 2026-10-30 (six months from registration). At TTL the flag
  is either fully rolled out (and removed) or the owner extends it
  with a named reason. The weekly cron opens an issue at TTL-7d.
- **Audit:** flag-flip rows captured in `audit_log` per D036 §7.

### `coord_board_v1`

- **Build unit:** BU-coordination-board (consumes the flag). Brief at
  `docs/build/session-briefs/bu-coordination-board.md` — currently
  `status: planned`, Direction A (kanban) settled, awaiting tech-review.
- **What it gates:** the Board tab (first slot in `AppNav`, before
  Feed) and the `/board` placeholder route. Nothing else lands behind
  this flag in this PR — schema, services, and the kanban surfaces
  arrive in subsequent BU-coordination-board PRs and remain gated by
  the same flag until the trio (board / ticket detail / notifications)
  is end-to-end demoable.
- **Default OFF in prod and dev:** the surface is a placeholder until
  the BU starts shipping. Admins flip it on for stakeholder demos via
  `/data/featureFlag` (admin CRUD creates the row with
  `enabledGlobally=true`). No row exists by default — the
  fail-closed evaluator returns `false`.
- **TTL:** 2026-11-03 (six months from registration). Extends as the
  BU progresses; removed when the kanban surface is fully rolled out.
- **Audit:** flag-flip rows captured in `audit_log` per D036 §7.

### `ff_reactions`

- **Build unit:** BU-reactions (D050).
- **What it gates:** the reaction pill on PostCard / detail and the
  comment-reaction surface that arrived in BU-comments-reactions.
- **Status:** rolled out, kept on for the foreseeable future. The
  flag stays in the registry as the kill-switch path if a feed
  problem needs to disable reactions across the live system.

### `ff_comments`

- **Build unit:** BU-comments (D052).
- **What it gates:** the post-detail page (`/post/[id]`) and its
  comment thread + composer.
- **Status:** rolled out, kept on. Same kill-switch rationale as
  `ff_reactions`.

## How to register a new flag

1. Add a row to the **Active flags** table above with: name,
   purpose (rollout / kill_switch / pilot_gate), prod + dev defaults,
   TTL or owner, one-sentence note.
2. Add a "Flag rationale" section below explaining what gates,
   why it's needed, and the rollout plan.
3. Land the migration (or the seed in dev) that creates the
   `FeatureFlag` row with `enabledGlobally=false` (or `true` if the
   dev default is ON).
4. Wire the flag check via `server/services/flags.isFeatureEnabled`.
5. Test both states.
6. The PR description must call out the new flag explicitly so review
   catches generic / nested / un-TTL'd flags.

## Removed / expired flags

(none yet — all current flags are active. Removed flags should be
listed here with date + reason for the audit trail.)

## Related

- D036 — Feature-flag discipline (the canonical rules)
- D050 — BU-reactions (the first feature behind a flag)
- D052 — BU-comments (the second)
- D073 — BU-event-time (registers `calendar_enabled` for BU-calendar-view)
- ADR-0001 — Structured event-time fields (the schema groundwork)
