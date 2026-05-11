---
slug: bu-network-source-chips
status: shipped
shipped_in: '#343'
phase: 2
priority: high
note: "Shipped 2026-05-11. Three rounds of Grant Q&A (#339 / #340 / #341) plus a Round-3 backend-shipped clarification (gps_chat_labels = view of gps.allowed_chats, slug NOT NULL via INSERT trigger). Chips above /network with URL-state filter, source meta-row on each card, forwarded badge. Pre-condition for retiring /feed as the canonical surface — still pending."
---

# SESSION BRIEF · bu-network-source-chips — multi-source `/network` with chip filtering

_Brief version: 0.1 (planning) · Author: Paul + Claude · Date: 2026-05-11_
_Pairs with: bu-network-feed (shipped), bu-network-unfurl-fixes (#338),
ADR-0017 (network-card-state), Grant's `public.gps_group_messages` +
forthcoming `public.gps_chat_labels`._

---

## Why now

`/network` is becoming the canonical feed. `/feed` will be retired (or
demoted to a coordinator surface) once members have a single front
page that shows what the network is sending. Today `/network` only
hosts a single chat ("GPS Action Network!"); Grant is about to enable
additional WhatsApp groups through the same pipe. We need a
disambiguator: which group is each card from, and which groups does
the current viewer want to see.

The disambiguator is **source chips** — a strip across the top of
`/network` that filters by chat label, URL-state-encoded so links
share cleanly.

---

## Two orthogonal axes (read carefully — these don't collapse)

| Axis | What it is | Source of truth |
|---|---|---|
| **Source** | Which WA group / chat the message came from | Grant's `gps_chat_labels` view, keyed by `chat_id` |
| **Content-flag** | A property of the message: AM-action, urgent, has-image, has-link, etc. | Mix of: URL host (AM, X/Twitter), text heuristic (Urgent), absence/presence of fields (has-image, has-link) |

This BU builds the **Source** axis. Content-flags are a follow-up BU
(`bu-network-content-flags`, not yet briefed). The two layers compose
multiplicatively — "Hendon JAG + AM only" is a valid filter intent.

---

## Objective

Members landing on `/network` see a chip strip across the top, one
chip per imported WA source plus an "All" chip. Tapping a chip
filters the card stream to that source (multi-select). Chips show
unread/new counts. URL-state-encoded. Coordinator-only sources
(if any — TBD with Grant) are hidden from non-coordinator viewers.

Success: Sharon lands on `/network`, sees chips
"All · GPS Network · Hendon JAG · Friends of GPS", taps two of
them, the URL becomes `/network?source=hendon-jag,friends-of-gps`,
the feed re-renders. Shareable, bookmarkable.

---

## Out of scope (parked)

- **Content-flag chips** (Urgent / AM / Has-image). Separate BU.
- **Per-source notification preferences** (Eddie wants pings from
  Hendon JAG only) — push notifications aren't shipped at all yet.
- **Cross-source dedup** (same URL appears in two groups) — defer
  until volume warrants. For now both rows render.
- **Source-level moderation actions** (mute a chat for everyone) —
  coordinator surface, not member-facing.
- **Coordinator-set "highlight" / "pin" per source** — author-side
  action, not part of the source filter.

---

## Locked from Grant

### Round 1 (2026-05-11) — URL extraction

Section B (URL-extraction) of the questions doc is fully answered.
The following are now contract, not guess:

- **URL extraction** = server-side regex on `body_text` (`https://…`
  → `www.…` → bare-domain with TLD allowlist). First match wins.
- **WA's own link-preview is captured first** when available
  (`link_preview.url` / `link_preview.title`); `link_title=null` +
  `message_type=text` ⇒ user typed the URL plain, no WA unfurl.
- **No host blocklist.** Top hosts: x.com (17), facebook.com (16),
  zoom.us (9), chat.whatsapp.com (9), instagram.com (8).
- **Shorteners stored as-is** — but our OG fetcher already follows
  redirects (`server/services/link-metadata.ts:84`), so no action
  required.
- **No-URL messages dropped by design** — `/network` is a link-feed
  by contract.
- **Forwards = ~28% of the feed** (47/167 rows). Currently render
  forwarder's name, not original sender. Grant will expose
  `is_forwarded: boolean` on the next view revision (requested
  2026-05-11). Original-sender preservation parked.
- **Curation CLI hides ~18 rows** — `id` gaps are deliberate; don't
  debug them as missing data.

**Three patches Grant offered, all shipped in Round 2 drop
(2026-05-11):**

1. **Email-domain false-positive regex fix** — bare-domain pattern
   now requires leading whitespace / start-of-string, not `@`.
   ~3–4 historical rows still have bad `url` extractions; Grant
   will re-extract from raw on request (Round 2 reply: yes).
2. **`urls text[]` column** for multi-URL messages
   (`regexp_matches` plural). Ordered by first appearance, deduped,
   trailing punctuation stripped. `url` (singular) preserved as
   `urls[0]` (or `link_preview.url` when WA preview present, in
   which case it's prepended so `urls[0] === url`). Existing rows
   backfilled. Build renders first URL as primary preview;
   "+N more links" UI is a follow-up.
3. **`is_forwarded boolean`** sourced from `context.forwarded`.
   47/167 existing rows backfilled to `true`. Sender remains the
   forwarder, as discussed. Build surfaces a "↪ forwarded" badge
   in the card meta row (1-line change in `NetworkCard.tsx` meta
   row).

### Round 2 (2026-05-11) — `gps_chat_labels` view shape

Section A is answered. The view ships with this shape:

| Column | Type | Notes |
|---|---|---|
| `chat_id` | text | The `@g.us` identifier (unchanged) |
| `slug` | text | Stable kebab-case, persistent across label renames — use as URL state key |
| `label` | text | Free-text display name (may change without breaking URLs) |
| `description` | text | 1–2 sentence summary; surface in tooltip / manage-sources view |
| `display_order` | int | Lower = earlier; default 100; sort `display_order ASC, label ASC` |
| `color` | text | Hex string (nullable). Treat as fallback — we override per-`slug` from our token palette |
| `icon` | text | Single emoji or icon hint (nullable). Emoji acceptable |
| `member_count` | int | Manually set for now; v2 = periodic Whapi sync. Display in manage-sources only, not on the chip itself |

**Seed (current state):**
- `gps-action-network` → "GPS Action Network!" · `#3fb950` · 🎯 ·
  190 members · `display_order=1`
- `test-group` → "Test (Grant + burner)" · `#8b949e` · 🧪 ·
  2 members · `display_order=999`

**Visibility model:** Grant-side returns everything in
`gps.allowed_chats`. We filter post-fetch in tRPC if/when role
gating becomes a need (deferred from this BU — no coordinator-only
chat exists yet).

**Renames:** `chat_id` stable upstream; Grant keeps `slug` stable
across label edits. URL state encoded via `slug` survives renames.
If Grant ever rotates a `slug` (rare, deliberate), risk is a
broken `?source=…` link — accepted.

**Rate limit + cache:** PostgREST anon ~200 req/min per IP soft-
throttled. Grant's recommendation, adopted:
- `gps_chat_labels` — 24h server-side cache + manual admin
  "Refresh sources" purge button (small follow-up; not in this
  BU's scope).
- `gps_group_messages` — existing 60s dev / 300s prod cache
  preserved.

## Still blocked

Section A is answered enough to build. Two minor follow-ups in the
Round 2 reply, **non-gating** for this BU:

- **A5 · onboarding SLA** — what happens to messages whose
  `chat_id` has no `gps_chat_labels` row? Build assumes every row
  joins (true today; both chats have labels).
- **A6 · backfill semantics** — does Whapi backfill history on
  group-add or only forward from join? Informs empty-state copy
  for new chips. Build ships a generic empty state; tighten copy
  if/when Grant answers.

Section C (operational — privacy, outage contract) and D (nice-to-
have — WA msg ID, WA-side reactions, threads) still outstanding;
none gate the build.

---

## Scope (when decisions are in)

### Build in this session (estimate: 1 session)

**Backend — source join:**
- `server/lib/supabase.ts` — extend `GpsGroupMessageRow` shape and
  the PostgREST query to embed `gps_chat_labels` columns:
  `chat_id, slug, label, description, display_order, color, icon,
  member_count`. Embedded-resource syntax (PostgREST
  `select=*,gps_chat_labels(slug,label,...)`).
- `server/services/network.ts` — add `source: { slug, label,
  description, displayOrder, color, icon, memberCount }` to
  `NetworkCard`. Extend `NetworkListInput` with `sources?: string[]`
  (slugs). Cache key includes the sorted source set. Add a separate
  `listSources()` call returning the active source set (24h cache).
- `shared/network-card.ts` — new `NetworkCardSource` type. Serialise
  through to `SerializedNetworkCard`.
- `shared/validation/network.ts` — accept `sources` array in the
  input schema. Slug validation: kebab-case, max length 64.

**Frontend — chip strip:**
- New `components/NetworkSourceChipStrip.tsx` (or reuse the existing
  `FilterChipStrip` from `/feed` if its shape generalises cleanly).
- `app/(member)/network/page.tsx` — read `sources` from `searchParams`,
  pass to the tRPC call, render chips above the card list.
- URL-state-encoded: `?source=slug-a,slug-b`. Empty = "All".
- **Chip ordering** = `display_order ASC, label ASC` (Grant's
  recipe; answers open product Q1).
- **Brand colours** = per-`slug` map maintained in
  `styles/source-palette.ts` (new), keyed off our token palette
  (`styles/tokens.css`). Grant's `color` column is the fallback for
  unknown slugs. Initial map: `gps-action-network` →
  `var(--token-brand-primary)` (or whatever reads as "core
  network" in our palette); `test-group` → `var(--token-muted)`.
- **Icon** = Grant's `icon` column rendered as-is (emoji). No
  lucide mapping in v1.

**Visibility gating:** Deferred. Grant returns everything in
`gps.allowed_chats`; both currently-seeded chats are effectively
public. When the first coordinator-only source ships (e.g. a
steward channel), add a local `NetworkSource.visibleToRole` mirror
or hard-code the filter — design choice deferred to that BU.

**NetworkCard:**
- Meta row's hard-coded `'GPS Action Network!'` string
  (`NetworkCard.tsx:88`) replaced by `card.source.label`.
- Small per-source colour dot rendered before the label, sourced
  from `styles/source-palette.ts` lookup (fallback to
  `card.source.color`).
- Per-source emoji `icon` rendered inline with the label
  (subtle; `opacity: 0.7` or similar).
- "↪ forwarded" badge when `card.isForwarded` is true (new field,
  populated from Grant's `is_forwarded` column shipped in Round 2).

**Tests:**
- Unit: service returns correct chip set; filter narrows the list;
  visibility gate works.
- Unit: chip strip renders correct counts, URL state round-trips.
- Integration: end-to-end with a mocked `gps_chat_labels` join.

### NOT in this session

- Retiring `/feed` itself. That's a separate sequence:
  1. Add a redirect / banner to `/feed` first.
  2. Move any feed-only features (Calendar, Composer, FAB) under
     `/network` or relevant subroutes.
  3. Update navigation glyph in `AppNav`.
  4. Flip the default route last.
  This BU lays the groundwork (multi-source UX); the retirement is
  its own BU once we're confident on the new shape.

---

## What we can / can't promise as more sources arrive

### Can (no new work beyond this BU)

- **Per-source label, chip, count, filter.**
- **AM auto-detection** on link previews — already domain-based, works
  for any source.
- **X / Twitter compact thumbnail** — already host-based, works for any
  source.
- **Reactions, shares, share-counter, triage** — message-level, source-
  agnostic.
- **Link-preview enrichment + favicon fallback** — URL-level, source-
  agnostic.

### Can with a follow-up BU

- **Per-source urgent / content-flag chips** (`bu-network-content-flags`).
- **Per-source role gating** if Grant doesn't expose visibility (we'd add
  it on our side via a `NetworkSource` table with a `visibleToRole`
  column).
- **Cross-source dedup** (single canonical card for the same URL
  appearing in N groups).
- **Comments on network cards** (currently reactions + notes only;
  comments would need a polymorphic target like ShareEvent in ADR-0018).
- **Forwarded badge on cards** — once Grant exposes `is_forwarded`,
  surface a small "↪ forwarded" indicator in the meta row (~28% of
  the feed today). Sets honest expectations re sender identity.
- **`chat.whatsapp.com` group-invite treatment** — 9/167 rows are
  WA group-invite links that OG-unfurl to nothing useful. A specific
  card variant ("Join WhatsApp group: X") would read more cleanly.
- **"+N more links" surfacing** for multi-URL messages once the
  `urls text[]` column lands.

### Can't (and what to do instead)

| Want | Why no | Alternative |
|---|---|---|
| Reliable per-author identity | ~70% of WA senders are `@lid`-only; no User row | Cluster by `senderHash`; show "anonymous member" — already shipped |
| Authoritative "urgent" flag from WA | WA doesn't carry one | Coordinator post-hoc flag on `NetworkCardState`; or PROMOTED triage → GPS post with urgent |
| Edit / pin / schedule network cards | Inbound, immutable on our side | PROMOTE to a GPS post, then those affordances become available |
| Regional routing per message | Sender→region map doesn't exist | Per-source regional tagging (the chat itself is "Hendon JAG") |
| Cultural-moment treatment (Shabbat etc.) | No signal in WA | Coordinator promotes to a GPS post and tags there |

---

## Done when

1. `/network` renders chips above the card list, one per source.
2. Multi-select chip state is URL-encoded.
3. Cards show their source label in the meta row (replacing the
   hard-coded string).
4. Visibility gating works if Grant exposes it.
5. `pnpm typecheck && pnpm lint && pnpm test` clean.
6. README in `app/(member)/network/` updated.
7. `package.json` version bumped (PATCH).

---

## Open product questions to surface (separate from Grant)

1. ~~**Chip ordering**~~ — **Resolved 2026-05-11.** Use Grant's
   `display_order ASC, label ASC`. Grant left wide gaps (1, 999)
   so we can ask him to slot new sources at deliberate priorities.
2. **Default selection** — "All" (no chip active = everything) or
   the viewer's regional/affiliated chats by default? Recommend
   "All" for v1 (simpler, no regional model on `gps_chat_labels`
   yet); revisit when `region_slug` lands.
3. **Empty state** — chip selected but window empty. Copy?
   Depends partly on A6 backfill semantics (raised in Round 2
   reply). Recommend a generic line for v1: "No links from
   `<label>` in the current window. Try widening the time range
   or selecting another source."
4. **Counts on chips** — total in window, or "new since last
   visit" (requires per-user `lastSeenAt` per source)? Recommend
   **no count on chip** for v1 — chips are filters, not roster
   metrics. Counts of unread items are a separate feature when
   per-user state exists.
5. **Long chip list** — 10+ groups. Horizontal scroll, overflow
   menu, or a separate "Manage sources" page? Recommend
   horizontal scroll for v1; "Manage sources" overlay (using
   `description` + `member_count`) when source count ≥ 8 — but
   that's a follow-up, not v1.

---

## Appendix · Companion documents

- `bu-network-source-chips--grant-questions.md` — outstanding
  questions for Grant blocking the build.
- `bu-network-content-flags.md` — follow-up BU for orthogonal
  content-flag chips (not yet drafted).
