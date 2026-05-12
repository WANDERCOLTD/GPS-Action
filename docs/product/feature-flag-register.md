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

| Name                    | Purpose | Default (prod)         | Default (dev) | TTL / owner     | Notes                                                                                                                             |
| ----------------------- | ------- | ---------------------- | ------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ff_reactions`          | rollout | enabled (post-rollout) | ON            | TTL: 2026-09-01 | Quiet, multi-select reactions on posts. BU-reactions / D050. Live since BU-reactions shipped.                                     |
| `ff_comments`           | rollout | enabled (post-rollout) | ON            | TTL: 2026-09-01 | Post-detail page + flat comment thread. BU-comments / D052. Live since BU-comments shipped.                                       |
| `calendar_enabled`      | rollout | OFF                    | ON            | TTL: 2026-10-30 | Calendar tab + agenda + month surfaces. BU-calendar-view (downstream of BU-event-time / D073).                                    |
| `coord_board_v1`        | rollout | OFF                    | OFF           | TTL: 2026-11-03 | Board tab in `AppNav` + `/board` placeholder. BU-coordination-board (planned, Direction A — kanban).                              |
| `network_feed`          | rollout | OFF                    | OFF           | TTL: 2026-11-10 | `/network` surface — read-only feed of WhatsApp links from Grant (AIFA)'s pipe. BU-network-feed / ADR-0017 / D083.                |
| `network_link_previews` | rollout | OFF                    | ON            | TTL: 2026-11-10 | OpenGraph hero/title/description on `/network` cards. BU-network-link-previews. Reuses `fetchLinkMetadata` + `<LinkPreviewCard>`. |
| `network_first`         | rollout | OFF                    | OFF           | TTL: 2026-11-11 | Root `/` redirects to `/network` (was `/feed`); Feed/Calendar/Requests AppNav tabs dim to 40% opacity. bu-network-first.          |
| `hide_feed_tab`         | rollout | OFF                    | OFF           | TTL: 2026-11-11 | When on, the Feed tab is removed from AppNav entirely. Pairs with `network_first` for "Network is the only home" IA.              |
| `network_unread_chip`   | rollout | OFF                    | OFF           | TTL: 2026-11-12 | Display gate for the sparkles "Unread only" chip on `/network`. `?unread=1` URL and client filter stay wired regardless.          |

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

### `network_feed`

- **Build unit:** BU-network-feed (consumes the flag). Brief at
  `docs/build/session-briefs/bu-network-feed.md` — currently
  `status: stub`, awaiting Paul's placement confirmation
  (`/network` proposed) and Grant's column-shape verification
  (`sender_hash` / `from_jid`).
- **What it gates:** the `/network` route, the new nav entry in
  `AppNav`, and the `network.list` / `network.setCardState` tRPC
  procedures behind it. Schema (`NetworkCardState` per ADR-0017)
  lands evergreen — empty tables on a flag-off DB are zero-cost.
- **Default OFF in prod:** the surface reads an external pipe (Grant
  /AIFA's Whapi → Supabase ingest); we want at least one coordinator
  sign-off post-deploy before exposing the surface broadly. Pipe
  health, anonymous-member UX, and triage-state behaviour all want
  real-world eyeballs first.
- **Default OFF in dev:** the upstream view sits on Grant's Supabase
  project, not on local Postgres. Flipping ON in dev requires the
  `SUPABASE_URL` / `SUPABASE_ANON_KEY` env wired to his project (see
  `.env.example` once the build session lands them) — without those,
  a dev render returns an empty list. Off-by-default avoids confusing
  developers who haven't set up the credentials.
- **TTL:** 2026-11-10 (six months from registration). Extends as the
  BU progresses; removed when the surface is fully rolled out across
  the coordinator population.
- **Audit:** flag-flip rows captured in `audit_log` per D036 §7.
- **Kill-switch posture:** if Grant's pipe goes down or returns
  malformed rows, flipping the flag OFF removes the surface
  immediately. The empty 5-min cache means worst-case staleness is
  bounded.

### `network_link_previews`

- **Build unit:** BU-network-link-previews. Brief at
  `docs/build/session-briefs/bu-network-link-previews.md`.
- **What it gates:** server-side OpenGraph fetch + render of
  `<LinkPreviewCard>` inside `<NetworkCard>` on `/network`. Card
  list still loads unchanged when the flag is off — only the
  enrichment is suppressed.
- **Default OFF in prod:** the fetcher reaches arbitrary
  third-party URLs from the WhatsApp stream. The fetch path itself
  is hardened (5s timeout, 1MB cap, SSRF guard at hostname layer)
  but coordinator sign-off post-deploy verifies the rendered cards
  look right against real traffic before exposing broadly.
- **Default ON in dev:** picked up automatically by the bulk
  flag-flip in `scripts/seed.ts`. No per-flag dev wiring needed.
- **TTL:** 2026-11-10 (six months from registration). Extends or
  removes when the surface settles.
- **Audit:** flag-flip rows captured in `audit_log` per D036 §7.
- **Kill-switch posture:** if the fetcher starts misbehaving (slow
  third-party hosts, malformed OG data, render glitches), flipping
  the flag OFF removes every preview block immediately. The list
  itself keeps working — preview is decorative, not load-bearing.

### `network_first`

- **Build unit:** bu-network-first (this PR — root redirect + nav
  dim). Lightweight IA shift; no new surface, no new data.
- **What it gates:** two things, both UI:
  1. `app/page.tsx` — root `/` redirects authenticated users to
     `/network` instead of `/feed`.
  2. `components/AppNav.tsx` — Feed, Calendar, and Requests tabs
     render at 40% opacity to signal "legacy surface" while
     `/network` is the primary one. Active state still takes
     precedence (clicked tab returns to full opacity).
- **Default OFF in prod and dev:** the demotion is a deliberate IA
  signal. Coordinator alignment first; flip on via admin UI when
  ready to demo the network-first orientation.
- **TTL:** 2026-11-11. At TTL: either fully rolled out (legacy tabs
  permanently dim or removed) or we revert and the flag retires.
- **Audit:** flag-flip rows captured in `audit_log` per D036 §7.
- **Kill-switch posture:** flipping OFF restores the prior IA
  (`/feed` is the root home, all tabs at full opacity) — no data
  changes, no migrations needed.

### `hide_feed_tab`

- **Build unit:** bu-network-first (same PR).
- **What it gates:** the `/feed` tab in `AppNav`. When on, the tab
  is removed from the rendered nav entirely — the `/feed` route
  itself still works (direct URL, bookmarks, links from elsewhere
  in the app).
- **Default OFF in prod and dev:** Feed stays visible. Flip on
  only after `network_first` is on and `/feed` is genuinely
  obsolete for the cohort.
- **TTL:** 2026-11-11. At TTL: either Feed is fully retired and
  this flag (plus the tab JSX) is removed, or we walk it back.
- **Audit:** flag-flip rows captured in `audit_log` per D036 §7.
- **Kill-switch posture:** trivial — flip OFF and Feed reappears.

### `network_unread_chip`

- **Build unit:** bu-network-unread-icon (same PR). Sits on top of
  `bu-network-seen-state` which shipped the underlying filter and the
  `?unread=1` URL contract.
- **What it gates:** display of the sparkles "Unread only" chip in
  the `PageHeader` sort cluster on `/network`. The `?unread=1` URL
  param and the client-side filter inside `NetworkFeed` remain wired
  up regardless — flag OFF only hides the visible affordance, it
  does not break existing bookmarked filter URLs.
- **Default OFF in prod and dev:** the seen-state UX is still being
  evaluated (first-visit fallback shipped in #365 was a recent
  correction). Flip ON once the desktop + iPhone behaviour is
  validated end-to-end with a real Whapi pipe trickle.
- **TTL:** 2026-11-12 (six months from registration). At TTL: either
  the chip is fully rolled out (flag + this row removed) or the
  owner extends with a reason.
- **Audit:** flag-flip rows captured in `audit_log` per D036 §7.
- **Kill-switch posture:** trivial — flip OFF, chip disappears, URL
  filter continues to work for anyone who has the bookmarked link.

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
- D083 — BU-network-feed (registers `network_feed`)
- BU-network-link-previews — registers `network_link_previews`
- ADR-0001 — Structured event-time fields (the schema groundwork)
- ADR-0017 — `NetworkCardState` (the own-side workflow-state schema gated by `network_feed`)
