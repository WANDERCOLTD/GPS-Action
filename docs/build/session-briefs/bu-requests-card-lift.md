---
slug: bu-requests-card-lift
status: planned
phase: 2
priority: medium
note: 'Visual-weight lift for /requests rows so they read with the same care as PostCard rows on /feed. No behaviour changes — restructure existing fields plus surface priority.'
---

# SESSION BRIEF · bu-requests-card-lift — RequestRow visual lift

_Brief version: 0.1 · Author: Paul (via Claude) · Date: 2026-04-30_

---

## Why this exists / why now

`/requests` rows currently render as a flat metadata blob: a bold
type label, a status pill, a timestamp, and grey 13px context text
below. The contextual summary — the actual "what is this request
about" — is the smallest, faintest text in the row. Compared to a
PostCard on `/feed` (kind chip beside title, byline with avatar,
prominent body), the requests workspace looks unfinished.

This BU lifts the row to the same visual idiom without changing
behaviour:

1. Tone-coded type chip per `RequestType` (matches PostCard kind chip).
2. Submitter byline — avatar + display name — at the top.
3. Context summary promoted to the primary readable line.
4. Priority chip for non-`normal` priorities (queue ordering already
   lives in the schema; surfacing it costs nothing).

---

## Scope

### Build in this session

- `components/RequestRow.tsx` — restructure: type chip + priority chip
  beside content title, submitter byline (avatar + name), summary as
  primary content, metadata row (timestamp + status + claimed-by) at
  the bottom.
- `server/services/request.ts` — extend `RequestListItem` and
  `REQUEST_INCLUDE` so `createdBy` includes `avatarUrl`. Same for
  `claimedBy` (for symmetry; cheap).
- `tests/unit/request-row.test.tsx` (new) — assertions for the four
  new affordances + preserves `requests-row-card` testid + the
  `data-urgent` attribute.
- `tests/integration/request-list-shape.test.ts` (new) — cover the
  service shape change.

### Deliberately out of scope

- Server-side pagination, filtering, sorting changes
- Role badges on the byline (defer — needs RoleGrant join + N+1
  consideration; chip palette only requires `displayName + avatarUrl`)
- Detail page (`/requests/[id]`) restyle (separate concern)
- Notifications row restyle (separate concern)

---

## Contracts to honour

- F14 testid rule. New testids: `requests-row-type-chip`,
  `requests-row-priority-chip`, `requests-row-submitter-byline`,
  `requests-row-summary`. Preserve `requests-row-card` and its
  `data-urgent` attribute.
- Layer boundaries — components → components + shared + styles.
- Design tokens only (no hex literals; use `gps-chip--*` tones).
- Per-PR PATCH version bump (0.2.39 → 0.2.40).

---

## Definition of done

- All four affordances render correctly in the list (manual smoke).
- `requests-row-card` testid + `data-urgent` attribute preserved.
- `RequestListItem.createdBy.avatarUrl` flows from Prisma → component.
- `npm run typecheck && npm run lint && npm test` all green.
- Brief flipped to `status: shipped` + `shipped_in: "#NNN"` on PR open.
