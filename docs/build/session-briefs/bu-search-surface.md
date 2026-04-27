---
slug: bu-search-surface
status: planned
phase: 2
priority: medium
note: "Stub — parked, not yet ready to start"
---
# SESSION BRIEF · BU-search-surface — App-wide member search

_Brief version: 0.1 (stub — parked, not yet ready to start) · Author: Paul + Claude · Date: 2026-04-27_
_Priority: Phase 2 follow-up to BU-feed-filter._
_Pairs with: `feat/feed-filter-and-search` (filter chips ship first; search is the second surface)._

---

## Objective

Members can search the whole app — posts, people, regions, partner
orgs, comments — from any page, with results that respect the
context they're searching from (current filter / current entity).
Success: a member on the `Urgent` filter taps the magnifier in the
sticky AppNav, the overlay opens with `× Urgent` scope chip
auto-applied, member types "hendon", sees Posts/People/Regions
groupings in the typeahead, taps `See all 14 posts`, lands on a
URL-addressable `/search?q=hendon&type=posts&filter=urgent` page.

The full design rationale lives in
**`docs/product/research/search-surfaces.md`** — read that first.
This brief is the build-time companion; the research doc is the
"why".

---

## Scope

### Build in this session

**To be filled in when this brief is promoted from stub to ready.**

Skeleton:

- Magnifier icon in `components/AppNav.tsx` (right of the nav
  links, before the unread-count area).
- New route `app/search/page.tsx` — full-screen overlay layout
  (header back arrow, autofocus input, optional scope chip,
  grouped result sections).
- Server action / tRPC `search.query({ q, scope, filter })` →
  grouped `{ posts, people, regions, partnerOrgs, comments }`.
  Each group capped at 3 in typeahead; full results page paginates
  per-group.
- URL-addressable: `/search?q=...&type=posts&filter=...&scope=...`
  must reproduce results 1:1. Aligns with D018 inbound sharing.
- Empty-state ("Recently viewed", "Your regions",
  "Bookmarked") — bookmarks remains future work; gate that section
  behind feature presence.
- PWA ergonomics: `inputmode="search"`, `enterKeyHint="search"`,
  `autoComplete="off"`, `visualViewport.resize` listener for
  results-above-keyboard. Reuse `HeaderRefreshButton`.
- Honest empty results copy: "Nothing matching that yet. Try a
  region name or a person." Not "No results found."

### Out of scope (park)

- Saved searches.
- Cross-region partner-org graph search (needs ERD work for §3.30).
- Voice / dictation (iOS handles natively).
- Search-as-you-scroll filter narrowing inside the feed (the chip
  strip is the filter surface).

---

## Pre-build decisions still needed

1. **Search backend.** Postgres `ILIKE` for v1 vs. a real index
   (pg_trgm, tsvector, or external like Meilisearch). Recommend
   `pg_trgm` + GIN index for v1 — local, no infra add.
2. **Comment search.** Indexable, or excluded for v1? (Comments are
   non-vetted member text — privacy review needed.)
3. **Per-region scoping.** Members see all regions today; should
   search default-scope to "your regions" with a chip to widen?

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

## Status

**Stub.** Promoted from `docs/product/research/search-surfaces.md`
on 2026-04-27. Not yet ready for a session — pre-build decisions
above need a user call before scope is locked.
