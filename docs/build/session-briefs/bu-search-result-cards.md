---
slug: bu-search-result-cards
status: shipped
shipped_in: '#TBD'
phase: 2
priority: high
---

# SESSION BRIEF · BU-search-result-cards — Search results in project UI style

_Author: Paul + Claude · Created: 2026-05-03 · Type: design-consistency follow-up to BU-search-surface (#189)._

---

## Why

PR D of BU-search-surface (#189) shipped grouped typeahead and full-results, but the result rows are bare `<Link>` elements with a label and an ISO date. They don't look like the rest of the app — no kind chip, no avatar, no role chips, no signal badge, no `.gps-card` shell. A member moving from `/feed` to `/search` sees a stylistic break.

The fix is mechanical: re-use the canonical row primitives (`KindChip`, `AvatarBubble`, `SignalBadgeRow`, `formatRole`) the same way `PostCard`, the post-detail page, and request lists already do. We also lock in a design rule so future entity-list surfaces (network directory, regions index, etc.) don't drift the same way.

This is a **follow-up to BU-search-surface**, not a continuation of it — small, bounded, ships on its own.

---

## Build in this session

**Service (per-entity rich types)**

- `server/services/search.ts`: split the single `SearchHit` into per-entity hit types so each row has the fields its row component needs. Posts: `id`, `href`, `title`, `kindSlug`, `kindDisplayName`, `urgency` (bool), `signal` (`'promote' | 'remove' | null`), `createdAt` (ISO), `author { displayName, roles[] }`. People: `id`, `href`, `displayName`, `roles[]`. Regions: `id`, `href`, `displayName`, `slug`. Partner orgs: still `[]` per D078 §9.
- Update the Prisma `select` blocks to fetch the new fields. Post author roles use the same `roleGrants` filter as `post.list` (`admin` / `queue_manager`).
- Re-export the new types from `server/routers/search.ts` so `/app` and `/components` can consume them without crossing layer boundaries.

**Components (canonical primitives, compact rows)**

- `components/SearchPostHit.tsx` — pure presentational row. `KindChip` with `kindSlug` + `urgency`, `AvatarBubble` + display name + `formatRole(role)` chips, title, relative time. Wraps the row in `<Link>` (tap-anywhere navigation, mirrors PostCard's behaviour). When `signal` is set, mini ✅/❌ badge inline (smaller than `SignalBadgeRow` — search rows are dense).
- `components/SearchPersonHit.tsx` — `AvatarBubble` + `displayName` + role chips, same byline pattern as the PostCard header.
- `components/SearchRegionHit.tsx` — `MapPin` glyph + `displayName` + slug subtitle.
- `components/SearchShell.tsx` — replace the bare `<Link>` rows in `ResultList` with a switch on `entityType` that renders the appropriate hit component. Telemetry stays exactly as it is (the row component receives an `onClick` for `search_result_clicked`).

**Design rule (locked into the philosophy doc)**

- `docs/product/design-philosophy.md`: add a "List-of-entities surfaces re-use the entity's row primitives" rule under the existing rules block. One-line summary + a short rationale + a pointer to `post-meta.tsx` as the canonical primitives module.

**Tests**

- Update `tests/unit/search-shell.test.tsx` to assert each row component is rendered with the right props (kind chip, role chip, etc.) — the existing tree-walk pattern handles function components after PR D's helper update.
- Add `tests/unit/search-post-hit.test.tsx`, `search-person-hit.test.tsx`, `search-region-hit.test.tsx` for the row components in isolation.

## Out of scope (park)

- **Hero image / link card thumbnails in search rows.** Search is a navigator, not a feed — the compact byline + kind chip is enough. Revisit if pilot members ask for it.
- **Reactions / comment counts on search rows.** Same reasoning — keeps the row scannable.
- **Partner-orgs row component.** Group still ships empty per D078 §9.
- **Recently-viewed row styling upgrade.** Out of scope here; PR D's plain-link list stays as it is for now (low traffic, simple).

---

## Acceptance

- [ ] Post search rows show `KindChip` (with urgency=Alert when set), `AvatarBubble` + author byline, title, relative time. Visually consistent with `PostCard` byline.
- [ ] Person search rows show `AvatarBubble` + display name + role chips (admin / queue_manager when granted).
- [ ] Region search rows show `MapPin` + display name + slug subtitle.
- [ ] `tick_or_cross` posts in search render the ✅/❌ glyph inline.
- [ ] Telemetry events still fire with the same payloads (no change to the wire format).
- [ ] `npm run typecheck && npm run lint && npm test` clean.
- [ ] `package.json` patch bumped.
- [ ] `design-philosophy.md` carries the new "list-of-entities re-use" rule.

## Status

**Shipped** in the PR that flipped this front-matter — replaces the
bare-link search rows with the canonical row primitives and locks the
"surface consistency" rule into `design-philosophy.md`.
