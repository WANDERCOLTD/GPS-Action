---
slug: bu-search-surface
status: shipped
shipped_in: '#189'
phase: 2
priority: medium
---
# SESSION BRIEF · BU-search-surface — App-wide member search

_Brief version: 0.5 (ready) · Author: Paul + Claude · Created: 2026-04-27 · Decisions locked: 2026-05-01 · Promoted to D078 / ADR-0004: 2026-05-02_
_Priority: Phase 2 follow-up to BU-feed-filter._
_Pairs with: `feat/feed-filter-and-search` (filter chips ship first; search is the second surface)._

---

## Objective

Members can search the whole app — posts, people, regions, partner
orgs — from any page, with results that respect the context they're
searching from (current filter / current entity). Success: a member
on the `Urgent` filter taps the magnifier in the sticky AppNav, the
overlay opens with `× Urgent` scope chip auto-applied, member types
"hendon", sees Posts/People/Regions groupings in the typeahead, taps
`See all 14 posts`, lands on a URL-addressable
`/search?q=hendon&type=posts&filter=urgent` page.

The full design rationale lives in
**`docs/product/research/search-surfaces.md`** — read that first.
This brief is the build-time companion; the research doc is the
"why".

Companion scenario: **SCN-31** in `docs/product/scenarios.md`.

---

## Decisions captured (2026-05-01) — promoted to D078 / ADR-0004 (2026-05-02)

Canonical reference: **D078** in `docs/architecture/decision-log.md`
captures all 9 sub-decisions; **ADR-0004** in `docs/adrs/` covers
the schema-touching subset (`pg_trgm` extension + GIN indexes).
Cite individual decisions as `D078 §N` from commits and PRs.

| # | Decision | Cite | Note |
|---|----------|------|------|
| 1 | **Backend = native Postgres.** No third-party (Algolia / Meilisearch). | D078 §1, ADR-0004 | No infra add. |
| 2 | **Comment search excluded from v1.** Comments are non-vetted member text — privacy review required before indexing. Park for a later BU. | D078 §2 | |
| 3 | **All regions, no default narrowing.** Search defaults to app-wide; no auto "in your regions" scope. | D078 §3 | Matches current feed behaviour — members already see all regions. |
| 4 | **Per-entity ranking: Posts → People → Regions → Partner orgs.** Default order when results match multiple types. Comments excluded (per #2). | D078 §4 | Posts are the primary content; people-find is the second-most-asked use case. |
| 5 | **Permissioned visibility: reuse `listPosts` visibility filter.** Members-only posts must not surface to logged-out viewers; the existing visibility predicate is the source of truth. Search MUST NOT bypass it. | D078 §5 | Server-enforced — share a single visibility predicate between `listPosts` and `search.query`. |
| 6 | **Index strategy = `pg_trgm` + GIN from day one.** `CREATE EXTENSION pg_trgm` in a migration, GIN indexes (`gin_trgm_ops`) on the searched columns: `posts.title`, `posts.body`, `users.display_name`, `regions.name`. (Partner-orgs index gated on §9.) | D078 §6, ADR-0004 | Picks typo tolerance up-front (`henden` → `hendon`) instead of shipping `ILIKE` and re-doing this work later. |
| 7 | **Scope chip inherits from filter only in v1.** No "in this thread" / per-post scope, because comment search is excluded (#2). Revisit when comment search ships. | D078 §7 | The chip is the small `× Urgent` pill below the search input — auto-set when search is opened from a filtered feed; tap-X widens to app-wide. |
| 8 | **Recently-viewed source = `localStorage` (last 5 posts).** Client-side, no schema change. Doesn't sync across devices — acceptable for v1. | D078 §8 | Surfaces only inside the search overlay's zero-query empty state. No `/history` route, no profile section in v1. |
| 9 | **Partner orgs entity deferred to §3.30 BU.** The Partner orgs result group renders empty/hidden until partner-orgs ships as an entity. | D078 §9 | Added 2026-05-02 — search v1 ships without partner-orgs as a result entity; group label and trigram index gated on §3.30. |

---

## Scope

### Build in this session

**UI**

- Magnifier icon in `components/AppNav.tsx`, right of the nav links,
  before the unread-count area. `aria-label="Search"`,
  `data-testid="appnav-search-trigger"`. Tapping navigates to
  `/search` (real route, not modal-only — survives back-button per
  PWA gotchas).
- New route `app/search/page.tsx` — full-screen overlay layout:
  - Sticky header: back arrow, "Search" title, `HeaderRefreshButton`
    (reused from sticky-nav work).
  - Autofocused `<input type="search">` with
    `inputmode="search"`, `enterKeyHint="search"`,
    `autoComplete="off"`.
  - Optional removable scope chip below the input (auto-populated
    from referring filter, e.g. `× Urgent`). Tap-X widens to
    app-wide.
  - Grouped result sections in fixed order: **Posts → People →
    Regions → Partner orgs** (decision #4). Each group capped at 3
    in the typeahead overlay, with a `See all N posts` link → full
    results page.
- Full-results page at `/search?q=...&type=posts&filter=...` —
  paginated per group (no infinite-scroll — preserves "feed has an
  end").
- Empty-state for zero query: **Recently viewed** (last 5 posts the
  member opened, sourced from `localStorage` per decision #8) ·
  **Your regions**. **Bookmarked** is gated behind feature presence
  (bookmarks BU is later). No "trending", no "hot now" — anxiety-
  amplification rule. This is the **only** UI surface for recently-
  viewed in v1 — no profile section, no `/history` route.
- Honest empty-results copy: "Nothing matching that yet. Try a
  region name or a person." Not "No results found."

**Glyph inventory & re-use**

See the **glyph register** in `docs/product/design-philosophy.md`
for the app-wide source of truth (re-use rules + AppNav + shipped
glyphs). The table below is the build-scoped subset for this BU.
When this BU ships, move the "Locked, not yet shipped" rows in the
register into "In-content glyphs (shipped)".

`lucide-react` is the project-wide icon family
(`AppNav`, `PostCard`, `IntentFab`, `HeaderRefreshButton`, etc.).
Re-use shipped glyphs wherever the surface admits them; only
platform-standard icons are new.

| Surface | Glyph | Status |
|---------|-------|--------|
| AppNav magnifier trigger | `Search` | New — sits alongside `Home` / `CalendarClock` / `Inbox` / `BarChart3` / `Settings` from `AppNav.tsx` (Tab inventory) |
| Overlay header back | `ChevronLeft` | New — platform-standard |
| Overlay header refresh | `HeaderRefreshButton` (component, not glyph) | **Re-use** — `components/HeaderRefreshButton.tsx` from sticky-nav work |
| Scope-chip dismissal | `X` | **Re-use** — already used in `IntentFabSheet`, `PostPublishModal` |
| Posts group label (optional) | `MessageSquare` | **Re-use** — `PostCard` comment-count icon |
| Regions group label (optional) | `MapPin` | **Re-use** — `PostCard` location icon |
| People group label (optional) | `User` | New |
| Partner orgs group label (optional) | `Building2` | New (gated on §3.30) |
| Recently-viewed item marker (optional) | `Clock` | New |

Group-label and recently-viewed item glyphs are nice-to-have, not
blocking — text labels first, glyphs layered if time permits. No new
icon families introduced; size and `strokeWidth` should match
`AppNav`'s existing conventions.

**Server**

- New tRPC router `server/routers/search.ts` exposing
  `search.query({ q, scope?, filter?, type?, cursor? })`.
  - Returns grouped shape:
    `{ posts: { items, nextCursor }, people: {...}, regions: {...}, partnerOrgs: {...} }`.
  - Typeahead mode (no `type` arg): each group capped at 3, no
    cursor.
  - Full mode (`type` arg set): only that group, paginated.
  - Min query length 2 (server enforces; UI also enforces to avoid
    chatter).
  - Visibility filter reused from `listPosts` (decision #5) — posts
    visibility check is server-enforced, never client-side.
- Service layer in `server/services/search.ts`:
  - Postgres-native query using `pg_trgm` similarity (decisions #1
    and #6). Use `%` operator (or `similarity()`) against the GIN-
    indexed columns; threshold tuneable via `pg_trgm.similarity_threshold`
    or explicit `similarity() > 0.3` predicate.
  - Per-entity ranking (decision #4) implemented as a fixed group
    order in the response shape — clients render in receipt order.

- Migration `prisma/migrations/<ts>_search_trgm/migration.sql`:
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
  - GIN indexes (`gin_trgm_ops`) on `posts.title`, `posts.body`,
    `users.display_name`, `regions.name`, `partner_orgs.name`.
  - ADR alongside, per CLAUDE.md "no schema change without ADR" rule.

**Telemetry**

- New analytics events (add to `docs/product/analytics-events.md`):
  - `search_opened` — { source: "appnav" | "deep_link" | "scope_chip" }
  - `search_query_submitted` — { q_length, has_scope_chip }
  - `search_result_clicked` — { entity_type, position_in_group, group_position }
  - `search_see_all_clicked` — { entity_type }
- No raw query strings in analytics (PII policy — query may contain
  member names).

**Routing & PWA**

- Both routes URL-addressable; `/search?q=...&type=...` MUST
  reproduce the result set 1:1 server-side. Aligns with D018.
- `visualViewport.resize` listener for keeping results above the
  iOS keyboard.

### Out of scope (park)

- **Comment search** — see decision #2.
- **Saved searches.**
- **Cross-region partner-org graph search** (needs ERD work for §3.30
  partner orgs).
- **Voice / dictation** (iOS handles natively).
- **Search-as-you-scroll filter narrowing inside the feed** — the
  chip strip is the filter surface (research §4).
- **Bookmarked posts in zero-state empty state** — gated until the
  bookmarks BU ships.
- **Per-region scoping default** — see decision #3; can revisit if
  pilot shows members are overwhelmed by cross-region noise.

---

## Open questions for the build session

All pre-build questions resolved. The session can start straight
from this brief.

Operational details to confirm in-session (not blocking):

1. **`pg_trgm` similarity threshold.** Default is 0.3 — likely fine
   for `henden`/`hendon`. Tune if pilot shows too many or too few
   matches.
2. **GIN index column list.** Brief lists 5 columns (decision #6);
   confirm at build whether `posts.body` is large enough that
   `tsvector` would be a better fit than trigram for body alone
   (trigram on long bodies is index-heavy).

---

## Why this is a separate BU from BU-feed-filter

Research §4 lands on chips and search as **distinct, side-by-side
surfaces** — not one conflated input. Filter is a closed
preset-view picker on the feed; search is open-text against the
whole app. Different routes, different UI shells, different
backend shapes. Building them together would conflate
"where am I looking" with "find one specific thing" and produce a
worse version of both.

---

## Acceptance

- [ ] Magnifier icon visible in `AppNav` on every authenticated page.
- [ ] `/search` opens autofocused; iOS keyboard up; results visible.
- [ ] Typeahead returns grouped Posts/People/Regions/Partner orgs
      within 300ms p50 on warm cache; min query length 2; debounce
      150ms.
- [ ] `See all N` link navigates to `/search?q=...&type=...` and the
      URL alone reproduces the same result set.
- [ ] Members-only posts do NOT appear in results when logged-out
      (visibility filter test — decision #5).
- [ ] Comments do NOT appear in results (decision #2).
- [ ] Zero-state shows Recently viewed + Your regions (Bookmarked
      hidden if feature absent).
- [ ] Typo `henden` returns `hendon` results (pg_trgm verification —
      decision #6).
- [ ] `pg_trgm` migration runs cleanly on a fresh DB and existing DB.
- [ ] Recently-viewed list reads from `localStorage`, caps at 5,
      survives reload (decision #8).
- [ ] Honest empty-results copy renders verbatim.
- [ ] Analytics events fire as specified; no raw query strings in
      payloads.
- [ ] Back button: typeahead → previous page in one pop; full
      results → typeahead → previous page in two pops.
- [ ] `npm run typecheck && npm run lint && npm test` clean.
- [ ] `package.json` patch bumped per versioning rule.

---

## Status

**Shipped** in 4 PRs (May 2026):

| PR   | Scope                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------- |
| #183 | PR A — `pg_trgm` extension + 4 GIN indexes (ADR-0004)                                                          |
| #184 | PR B — `search.query` tRPC procedure + service layer + visibility                                              |
| #188 | PR C — AppNav magnifier + `/search` route shell                                                                |
| #189 | PR D — typeahead grouped results + full-results page + recently-viewed (localStorage) + 4 telemetry events     |

Operational follow-ups parked:

- **pg_trgm typo tolerance (`henden → hendon`).** Service uses `ILIKE`
  in v1; trigram indexes already in place for the v2 upgrade.
  Service-only swap when a pilot signal warrants it.
- **Comment search.** Excluded from v1 per D078 §2 (privacy review).
- **Partner-orgs entity.** Result group ships empty-hidden until §3.30
  partner-orgs lands (D078 §9).

---

## Related

- Research: `docs/product/research/search-surfaces.md`
- Pairs with: BU-feed-filter (`feat/feed-filter-and-search`)
- D018 — inbound sharing endpoint (URL-addressable shape)
- §3.30 partner orgs (referenced for partner-org search; not blocking)
- SCN-31 — Sharon searches for Hendon (companion scenario)
