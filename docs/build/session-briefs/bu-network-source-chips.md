---
slug: bu-network-source-chips
status: planned
phase: 2
priority: high
note: "Draft 2026-05-11. Blocked on Grant decisions captured in bu-network-source-chips--grant-questions.md. Pre-condition for retiring /feed as the canonical surface."
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

## Decisions needed BEFORE build starts

All in `bu-network-source-chips--grant-questions.md`. Until those
land:
- We don't know if `gps_chat_labels` carries a stable `slug` or just
  a `label` (affects URL state encoding).
- We don't know the visibility model (does Grant filter on his side
  by role, or do we filter post-fetch?).
- We don't know if a `priority` / `display_order` column exists for
  chip ordering.

Plus the URL-extraction questions from the prior conversation (also
captured in the same questions doc).

---

## Scope (when decisions are in)

### Build in this session (estimate: 1 session)

**Backend — source join:**
- `server/lib/supabase.ts` — extend `GpsGroupMessageRow` shape and the
  PostgREST query to include the new `gps_chat_labels` columns
  (assume: `chat_id, slug, label, display_order, visibility`).
  Likely a server-side join via PostgREST's `gps_chat_labels(...)`
  embedded-resource syntax.
- `server/services/network.ts` — add `source: { slug, label }` to
  `NetworkCard`. Extend `NetworkListInput` with `sources?: string[]`
  (slugs). Cache key includes the sorted source set.
- `shared/network-card.ts` — new `NetworkCardSource` type. Serialise
  through to `SerializedNetworkCard`.
- `shared/validation/network.ts` — accept `sources` array in the
  input schema.

**Frontend — chip strip:**
- New `components/NetworkSourceChipStrip.tsx` (or reuse the existing
  `FilterChipStrip` from `/feed` if its shape generalises cleanly).
- `app/(member)/network/page.tsx` — read `sources` from `searchParams`,
  pass to the tRPC call, render chips above the card list.
- URL-state-encoded: `?source=slug-a,slug-b`. Empty = "All".

**Visibility gating (if Grant exposes a `visibility` column):**
- Service-side filter: drop rows whose source has `visibility != 'public'`
  unless the caller has the relevant role. Source list returned to the
  client likewise filtered.

**NetworkCard:**
- Meta row's hard-coded `'GPS Action Network!'` string (NetworkCard.tsx:88)
  is replaced by `card.source.label`. Optional: a small per-source
  colour dot / glyph hint when the labels table includes one.

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

1. **Chip ordering** — alphabetical, `display_order` from Grant,
   "most active in last 7 days", or pinned-first? Affects whose
   group sits where.
2. **Default selection** — "All" (no chip active = everything) or
   the viewer's regional/affiliated chats by default?
3. **Empty state** — chip selected but window empty. Copy?
4. **Counts on chips** — total in window, or "new since last visit"
   (requires a per-user lastSeenAt per source)?
5. **Long chip list** — 10+ groups. Horizontal scroll, overflow menu,
   or a separate "Manage sources" page?

---

## Appendix · Companion documents

- `bu-network-source-chips--grant-questions.md` — outstanding
  questions for Grant blocking the build.
- `bu-network-content-flags.md` — follow-up BU for orthogonal
  content-flag chips (not yet drafted).
