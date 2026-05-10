---
slug: bu-network-feed
status: stub
phase: 2
priority: medium
note: "Read-side surface for Grant's WhatsApp → Supabase pipe. 90% of the integration shape is settled with Grant; two items block ready: (a) Paul confirms placement (`/network` proposed), (b) column shape verified against Grant's updated doc (`sender_hash` vs `from_jid`)."
---

# SESSION BRIEF · bu-network-feed — render the GPS Action Network! WhatsApp link feed inside the app

_Author: Paul + Claude · Created: 2026-05-10_
_Type: New surface. Server-proxied read of an external Supabase view, plus a small workflow-state table on our side._

---

## 1 · Business Analyst — why this matters

### The problem in plain language

Members of the **GPS Action Network!** WhatsApp group share useful links
constantly — articles, briefings, action calls, evidence. That stream is
trapped inside the WhatsApp surface: searchable only by scrolling,
unreadable from a laptop without rejoining on each device, lost the
moment the group volume buries it.

Grant De Swardt (AIFA) has built a pipe — Whapi → Supabase — that captures
every link share from the group, deduplicates, filters to URL-bearing
messages, and exposes the result as a public Postgres view. **163
historical link shares** are already backfilled; new ones flow in
real-time as members post. The pipe is running today.

This BU is the last leg: read from Grant's view, render in the GPS app,
let coordinators triage what they find.

### Why this matters now

Three reinforcing reasons:

1. **It surfaces existing volunteer effort.** Members are already sharing
   evidence in the group. Today none of that work is visible to anyone
   outside the WhatsApp surface. Bringing it into the app converts a
   private chatter loop into queryable, searchable, attributable
   coordination material.
2. **It's the first concrete WhatsApp-replacement payoff.** The platform's
   pitch is "GPS Action replaces the WhatsApp loop." Until now we've only
   built outbound paths (compose-then-share-to-WhatsApp). This is the
   first inbound path — content from WhatsApp showing up *in the app*,
   readable on a laptop, addressable by URL, not lost to scroll.
3. **The integration cost is genuinely low.** Grant has done the hard
   work (allowlist, dedup, URL filtering, sender hashing). Our side is a
   tRPC proxy + a card list + a small workflow-state table. Build days,
   not build weeks.

### What this is NOT

- **Not a redesign of the existing `/feed`.** The existing feed renders
  in-app posts (the editorial / coordinator surface). This BU adds a
  separate `/network` route. The two are visually disambiguated by the
  styling lift in §2 / Q5. No move, no rename of `/feed`.
- **Not a write-back to WhatsApp.** Grant's view is read-only by design.
  Workflow state (triage / "owned by Bette" / "discarded") lives on
  our side only. Outbound-to-WhatsApp is covered by other BUs and
  parking-lot entries — out of scope here.
- **Not a multi-group surface yet.** The allowlist currently has
  GPS Action Network! + a test group. When Jeremy wants more groups in
  scope, Grant adds them on his side — no app change needed. Group
  picker / per-group filter UI is parking-lot, not v1.

### Reference precedent

Closest pattern in the wider tooling world: **Slack's "Saved items" or
"Threads I'm in"** — a passive, time-ordered stream of items pulled from
a noisier upstream surface, with light triage controls. Not the same
shape as a social feed; not the same shape as a board. A *reader's
inbox* of links worth chasing.

Grant has already shipped a working reference dashboard
(`~/Documents/Claude/gps-network-bridge/dashboard/index.html`, ~270 LoC).
This BU lifts the styling wholesale to disambiguate the new surface from
the existing `/feed` (per Paul's call). Subsequent polish can re-token
to GPS, but the v1 ship uses Grant's look.

---

## 2 · Tech Lead — the integration shape

### Already settled (locked in the Grant exchange, 2026-05-09 → 05-10)

| Decision | Resolution |
|---|---|
| Realtime vs polling | **Polling.** Server-side cache, ~5 min TTL + manual refresh. Volume is 5–10/day; refresh cost is rounding error |
| Architecture | **Server-side proxy** via tRPC procedure. Anon key never ships to the browser. Grant's view is one of several data sources behind the same router |
| `from_jid` exposure | **Dropped** by Grant. View now exposes `sender_hash` (SHA-256 of JID) — stable per-sender, no raw identifier ever leaves Supabase |
| "Hidden" semantics | **Exclude, not flag.** A hide on Grant's side = hard delete from the view. Cache must evict on refetch, not just append |
| Deletion detection | **Refetch the window.** ~600 rows for 90 days, sub-50ms PostgREST query. Optional `gps_message_states` incremental-sync view available later if refetching becomes annoying |
| Window size | **90 days.** ~600 rows max in current volume |
| `from_name` null UX | "Anonymous member" copy when `from_name` is NULL (~70% of senders are `@lid`-only). Group by `sender_hash` so cards from the same anonymous sender visually cluster |
| Card styling for v1 | **Lift Grant's reference dashboard** wholesale — disambiguates from `/feed` visually, ships fast |
| Workflow state | **Included in v1.** Own table on our side; tRPC mutations to mark triage state |
| Refresh UX | **Per-device best practice** — pull-to-refresh on touch viewports, manual refresh button on pointer viewports. Both surface the cache invalidation |

### Q1 · The data flow (concrete)

```
WhatsApp group (GPS Action Network!)
        │
        ▼
Whapi.cloud webhook
        │
        ▼
Supabase: gps.messages (raw)
        │  (filter: allowlist + URL-present + hidden=false)
        ▼
Supabase: public.gps_group_messages (view)  ── Grant's surface
        │
        │  PostgREST + anon key (server-side only)
        ▼
GPS Action: tRPC procedure  network.list({ window: 90d, limit: 50 })
        │
        │  joined with our gps_card_state(message_id, status, owner_user_id, updated_at)
        ▼
GPS Action: /network route — card list with triage controls
```

### Q2 · Column shape (NEEDS VERIFICATION — see Open Questions)

Per Grant's reply 2026-05-10, the view should expose `sender_hash`, not
`from_jid`. The doc Paul has on disk
(`~/Downloads/PAUL_INTEGRATION.md`) still lists `from_jid`. Either Paul
is reading a stale copy or Grant hasn't pushed the update yet. **Resolve
before the build session.**

Working assumption (subject to confirmation):

| column | type | use |
|---|---|---|
| `id` | bigint | cursor / join key into `gps_card_state` |
| `sent_at` | timestamptz | sort + display ("2h ago") |
| `from_name` | text? | display name; NULL → "anonymous member" |
| `sender_hash` | text | stable per-sender hash; group anonymous cards |
| `url` | text | click target |
| `link_title` | text? | card heading; fall back to URL hostname when null |
| `text_body` | text? | body / commentary, suppressed when it equals the URL |
| `chat_id` | text | join into `gps_chat_labels` for the group label |

Columns we **don't** need client-side: `received_at`, `message_type`,
`timestamp_unix`, `raw`, and (deliberately) `from_jid`.

### Q3 · The tRPC procedure

```
// server/routers/network.ts
network.list({ limit?, cursor?, window? })
  → { items: NetworkCard[], nextCursor: string | null }

network.setCardState({ messageId, status, ownerUserId? })
  → { ok: true }
```

`network.list`:

- Uses `@supabase/supabase-js` server-side, anon key from
  `SUPABASE_ANON_KEY` env var (server-only — *not* `NEXT_PUBLIC_*`).
- 5-minute in-memory cache keyed on `(window, limit, cursor)`. LRU,
  20 entries max. Manual refresh bypasses (cache-busting query).
- Joins each row against `gps_card_state` by `message_id` to attach
  triage status + owner.
- Returns shape consumed by the card component; no Supabase types
  leak past the procedure boundary.

`network.setCardState`:

- Owner must be authenticated. Triage state is per-app, not per-user
  initially (one global queue). If we later need per-user states, the
  schema is forward-compatible (status + owner_user_id are independent).

### Q4 · Workflow state — the schema

New table on our side:

```prisma
model NetworkCardState {
  id            String   @id @default(cuid())
  messageId     BigInt   @unique  // joins to Grant's gps_group_messages.id
  status        NetworkCardStatus  // enum below
  ownerUserId   String?
  ownerUser     User?    @relation(fields: [ownerUserId], references: [id])
  notes         String?  @db.Text
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([status])
  @@index([ownerUserId])
}

enum NetworkCardStatus {
  NEW         // default — not yet triaged
  TRIAGED     // someone looked, no action chosen yet
  PROMOTED    // promoted to a GPS Action post (link the post id later)
  DISCARDED   // not relevant
}
```

**Schema change → ADR required** per CLAUDE.md "Don't change
prisma/schema.prisma without an ADR." This is captured in **ADR-0017**
(`docs/adrs/0017-network-card-state.md`) — the cross-provider opaque-key
design, orphan tolerance, lazy row creation, and v2-ready ownerUserId
path are all detailed there. ADR-0017 + the schema migration land
ahead of this brief moving to `ready` (PR #310).

Grant's row id is `bigint`. Prisma supports `BigInt`. We don't FK into
Grant's view (it's an external system); we treat `messageId` as an
opaque identifier. Cleanup if a row disappears from Grant's view (a
hide): the state row is orphaned but harmless. A periodic reconcile
job can sweep orphans, but is post-v1.

### Q5 · The card UI

Lift Grant's reference dashboard
(`~/Documents/Claude/gps-network-bridge/dashboard/index.html`) wholesale
for v1. Each card:

- **Title:** `link_title`, fall back to URL hostname when null
- **Click target:** `url` (new tab, `rel="noopener noreferrer"`)
- **Meta row:** sender · group label · relative time (`sent_at`)
  - Sender: `from_name` if present, else "anonymous member" with a small
    cluster indicator showing other cards from the same `sender_hash`
- **Body:** `text_body` rendered only when it differs from the URL
  itself (often it's just the URL; that's noise)
- **Triage controls** (right edge of card, or footer — design pass to lock):
  Triaged / Promoted / Discarded buttons + an optional owner picker

Routing: `/network` (proposed; see Open Questions). New nav entry in
`AppNav` — design pass to lock the icon (parking-lot icon-strips
philosophy: one concept = one glyph; pick a non-conflicting lucide).

### Q6 · Refresh UX per device

- **Touch viewport** (mobile / tablet): native pull-to-refresh on the
  card list. A small "Last updated 3m ago" timestamp at the top of the
  list is the only persistent indicator.
- **Pointer viewport** (desktop): a manual refresh button next to the
  list header, plus the same "Last updated" timestamp. No
  pull-to-refresh on desktop (it's not a familiar idiom there).
- Both invalidate the server-side 5-min cache via cache-busting query.

### Q7 · Analytics events

Per `docs/product/analytics-events.md` (16 events, PII policy). Events
to instrument (final list to confirm during build):

- `network_list_viewed` — opened `/network`
- `network_card_clicked` — clicked through to the link (URL hostname
  only, no full URL)
- `network_card_triaged` — set state (status only, no message body)
- `network_refresh_triggered` — manual refresh button or pull-to-refresh

`sender_hash` is fine to log (it's already a hash); raw URLs are not
(may carry tracking parameters with PII).

### Q8 · Feature flag

Per D036 — any new feature behind a flag. Proposed flag:
`network_feed`. Default off in production until at least one
coordinator sign-off post-deploy.

---

## 3 · Layer boundary impact

| Layer            | Touched? | What |
| ---------------- | -------- | ---- |
| `/app`           | Yes | New route `/app/network/page.tsx` (server component shell) + `/app/network/network-feed.tsx` (client interactivity) |
| `/components`    | Yes | New `<NetworkCard />` (lifted styling) + `<NetworkRefreshControls />` |
| `/server/routers` | Yes | New `network.ts` router with `list` + `setCardState` |
| `/server/services` | Yes | New `network.service.ts` (Supabase client + cache + state-join logic) |
| `/server/db`     | No | New table goes via Prisma migration; no direct DB code |
| `/shared`        | Yes | New `NetworkCard` / `NetworkCardStatus` shape definitions |
| `prisma/schema.prisma` | Yes | New `NetworkCardState` model + enum — captured in **ADR-0017** / D083 (PR #310) |
| `prisma/migrations/` | Yes | New migration for the table; idempotent per D070 |

Env additions: `SUPABASE_URL` + `SUPABASE_ANON_KEY` (server-only — NOT
`NEXT_PUBLIC_*`). Document in `.env.example`.

New dependency: `@supabase/supabase-js`. Per global preference, search
npm before hand-rolling — the SDK is the right primitive here (REST
fetch works but the SDK's typed query builder is genuine value for
~300 bytes of bundle on the server only).

---

## 4 · Tests required

- **Unit** — `network.service.ts` cache hit/miss, anonymous-member
  grouping by `sender_hash`, body-equals-URL suppression.
- **Integration** — `network.list` round-trips against a mocked
  Supabase response; `network.setCardState` writes through to Prisma
  test DB. Per memory rule: integration tests hit a real Postgres,
  not mocks (incident: prior mock/prod divergence).
- **Manual sign-off** — open `/network`, click a card, triage one,
  refresh on mobile (pull) and desktop (button), confirm cache
  invalidation, confirm anonymous-member cluster cue.
- **F14 testid rule** — every actionable element gets a `data-testid`.

Not required:

- E2E against the real Supabase view (couples our CI to Grant's
  infra; mock the response in CI, sanity-check manually before merge).
- Performance benchmarks (sub-50ms per Grant's measurement; not a
  fold-changing concern at this scale).

---

## 5 · Risks / gotchas

- **Anon key in env.** `SUPABASE_ANON_KEY` is server-only by design. If
  a future change moves it to `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the key
  ships in the client bundle. Grant's audit confirms it's safe in that
  posture (read-only, scoped to two views), but the *threat model the
  brief locks* is server-side only. Don't drift.
- **Stale doc on disk.** Paul's local copy of `PAUL_INTEGRATION.md`
  still shows `from_jid`. The view shape may have moved. Verify before
  build; mismatched columns will fail tRPC validation at the boundary
  cleanly but waste a build cycle.
- **Workflow-state orphans.** When Grant hides a row, our state row
  for that `messageId` is orphaned. Harmless for v1 (joins just don't
  hit). Reconcile job is parking-lot, not blocking.
- **ESLint boundary plugin.** New router/service touches multiple
  layers. Confirm the import graph respects the rules before opening
  the PR (`/app` may not import from `/server/services` directly;
  must go via `/server/routers`).
- **Quiet WhatsApp moments.** Per CLAUDE.md "cultural moments are
  quiet" — when `/network` is genuinely empty (e.g. Shabbat, post-
  cultural-marker hours), the empty state should be calm, not "no
  results, try again." Design pass to confirm copy.
- **Sharon-warmth posture.** A live feed of WhatsApp links is exactly
  the kind of surface that can drift into "always-on urgency" framing.
  Per CLAUDE.md "permission to close": no dot badges, no notification-
  count, no auto-poll-while-app-open. The user comes to `/network`
  when they want to; nothing should pull them there.

---

## 6 · Out of scope (park)

- **Renaming `/feed` to `/feed-old`.** Considered and explicitly rejected
  in the planning conversation 2026-05-10 — the existing `/feed` is the
  app's primary editorial surface; demoting it to claim the URL for a
  passive stream of external content would muddle product positioning.
- **Group picker / multi-group filter.** Allowlist has one real group
  today (+ one test). Add when the allowlist grows.
- **Live updates / WebSocket subscribe.** Polling at 5 min is fine for
  current volume. Grant has a path to a trigger-fed mirror table when
  it's worth it (his quote: "Until then, poll").
- **Search inside the network feed.** `bu-search-surface` covers
  app-wide search; including network cards in that index is a
  follow-up, not v1.
- **Re-tokenising the card style to GPS.** v1 lifts Grant's look
  wholesale to disambiguate. A `bu-network-feed-restyle` follow-up
  can re-token once the surface has earned its place.
- **Per-user triage queues.** v1 is one global queue. Per-user is
  schema-forward-compatible (`ownerUserId` is nullable + indexed) but
  not built.
- **Reconcile job for orphaned state rows.** Periodic sweep is a
  housekeeping task; Grant hides infrequently and orphans don't break
  anything.
- **Promoting a network card to a GPS Action post.** The state machine
  has a `PROMOTED` value; the actual one-click-promote action is its
  own BU (`bu-network-card-promote`?), not v1.

---

## 7 · Acceptance for moving to `ready` status

This brief is `stub`. It moves to `ready` when:

- [x] Paul confirms placement: `/network` (confirmed 2026-05-10).
- [ ] Column shape verified with Grant — `sender_hash` is in the view
      and `from_jid` is gone (currently the doc disagrees with his
      reply).
- [x] ADR-0017 drafted: "NetworkCardState — own-the-workflow-state for
      external link feed" (PR #310).
- [ ] Polling cadence locked at 5 min (or revisited).
- [x] Feature flag `network_feed` added to the register
      (`docs/product/feature-flag-register.md`) — PR #310.
- [ ] Glyph for `/network` nav entry locked (per memory rule: same
      commit registers it in `docs/product/design-philosophy.md`).

Once all boxes tick, flip front-matter `status: stub` → `status:
ready`, fill in the Build / Don't-touch list, and the brief is ready
for a build session.

---

## 8 · Acceptance criteria (provisional — confirmed when ready)

- [ ] `/network` route exists, server-rendered, no anon key in client
      bundle (verify: `grep SUPABASE_ANON_KEY .next/static/` returns
      nothing).
- [ ] tRPC procedures `network.list` + `network.setCardState`
      implemented; layer boundaries clean.
- [ ] Card list renders 90-day window, max 50 per page, with
      pagination cursor.
- [ ] Anonymous-member cards group visibly by `sender_hash`.
- [ ] Triage state persists across reloads.
- [ ] Pull-to-refresh works on touch; manual button on pointer.
- [ ] 5-min cache observable in dev (second request within window
      doesn't hit Supabase; refresh button does).
- [ ] Empty state copy is calm (per Sharon-warmth posture).
- [ ] All actionable elements carry `data-testid` (F14).
- [ ] Feature flag `network_feed` gates the route in production.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean.
- [ ] `package.json` PATCH bumped.
- [ ] `prisma migrate deploy` works on a fresh DB; `NetworkCardState`
      table created idempotently.
- [ ] `README.md` files updated for `/app/network/`,
      `/server/routers/`, `/server/services/`.

---

## 9 · Open questions to surface (block ready)

1. **Naming / placement.** `/network` proposed (matches WhatsApp group
   name "GPS Action Network!" and BU slug). Alternatives: `/links`,
   `/sources`. Visual disambiguation handled by the styling lift in §2/Q5
   regardless. Paul to confirm.
2. **Column shape.** Confirm with Grant whether the live view exposes
   `sender_hash` (his reply) or still `from_jid` (Paul's local doc).
3. **Glyph for the nav entry.** Lucide options: `radio-tower`, `rss`,
   `inbox`, `link-2`. Design pass to lock; one concept = one glyph rule
   applies.
4. **Polling cadence.** 5 min server-side cache locked; manual refresh
   bypasses. Confirm during build that the cache TTL is configurable
   via env (`NETWORK_CACHE_TTL_SECONDS`) so we can tune without a
   redeploy.

---

## 10 · Context

- Integration doc (Grant): `~/Downloads/PAUL_INTEGRATION.md` (and the
  email thread with Grant 2026-05-09 → 05-10, captured verbatim in
  Paul's session prompt).
- Counterparty: Grant De Swardt (AIFA),
  `grant@aifusionautomations.com`. Owns the pipe + Supabase view; not
  the in-app surface.
- Source group: WhatsApp "GPS Action Network!" (multi-group ready when
  Jeremy expands scope).
- Reference dashboard:
  `~/Documents/Claude/gps-network-bridge/dashboard/index.html` (~270
  LoC, single static file). Style template for v1 cards.
- Layer boundaries: `CLAUDE.md` § "Layer boundaries (enforced by
  ESLint)".
- API contract discipline: `docs/process/api-contract-discipline.md`.
- Sharon-warmth posture: `CLAUDE.md` § "Voice and tone notes".
- Schema-change rule: `CLAUDE.md` § "What NOT to do" — ADR required.
- Reference-data rule (D070): not applicable here (no static slugs).
- Versioning: PATCH bump per `docs/process/versioning.md`.
- Feature-flag register: `docs/product/feature-flag-register.md`
  (D036).

---

## Status

`stub`. Holds remaining: (a) Grant column-shape verification, (b) glyph
register entry. Naming confirmed (`/network`, 2026-05-10). ADR-0017 +
feature-flag register entry shipped in PR #310.
