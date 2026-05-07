---
slug: bu-search-includes-kanban
status: ready
phase: 3
priority: high
---

# SESSION BRIEF · bu-search-includes-kanban — Search includes kanban tickets

_Author: Paul + Claude · Created: 2026-05-07 · Type: incremental extension of BU-search-surface (#189) + BU-search-result-cards (#190)._

---

## Why

Today `/search` covers Posts, People, Regions and (placeholder) Partner orgs. The coord-board ships kanban Requests as first-class artefacts of the network's day-to-day work, and members can't find them via search. Sharon types "Hendon" expecting to land on every Hendon-shaped thing — a school-gate Post, a Hendon team member, the Hendon Region — but the kanban ticket called "Hendon school-gate roster" is invisible.

The fix is mechanical: add a fifth entity group ("Tickets") to the existing search service and its UI, mirroring the Posts pattern. The headline complication is the **permission gate** — kanban Requests are members-only, so the service must restrict ticket hits to groups the caller already belongs to (sysadmin bypass).

Small, bounded, ships on its own.

---

## Build in this session

**Migration**

- `prisma/migrations/20260507120000_request_search_indexes/migration.sql` — `gin_trgm_ops` GIN indexes on `Request.title` and `Request.body`. `IF NOT EXISTS` for idempotency. Mirrors `20260503100000_search_trgm_indexes` (no schema-level index decl — same pattern as Post / User / Region).

**Validation**

- `shared/validation/search.ts`: append `'tickets'` to `SEARCH_ENTITY_TYPES`.
- `app/api/analytics/search/route.ts`: append `'tickets'` to the `VALID_ENTITY_TYPES` set so analytics events for ticket clicks are not bounced.

**Service**

- `server/services/search.ts`: new `searchTickets(q, callerId, limit)` mirrors `searchPosts`. Returns `TicketSearchHit { id, href, title, status, urgency, groupSlug, groupDisplayName, createdAt }`. Status filter: `{ in: ['backlog', 'active'] }` — `done` and `abandoned` are excluded from default search. Soft-delete: `deletedAt: null` on Request and on the joining `RequestGroup` row.
- Permission gate: `callerId === null` short-circuits to `[]`. Active sysadmins (`RoleGrant.role === 'admin' AND revokedAt IS NULL`) skip the membership filter. Everyone else is gated to tickets linked via a non-deleted `RequestGroup` to a `Group` they have an active `GroupMembership` (`leftAt: null AND deletedAt: null`) in.
- `searchAll`: extend `Promise.all` and the result object; `emptyResults` carries `tickets: []`.

**Router**

- `server/routers/search.ts`: re-export `TicketSearchHit` for `/app` + `/components`.

**UI**

- `components/SearchHitRows.tsx`: new `SearchTicketHitRow` — `lucide-react` `Kanban` glyph + originating group name + status/urgency pills + title. Same row pattern as the others.
- `components/SearchShell.tsx`: add `tickets` to `GROUPS` (tail of the order), wire the row into `ResultList`, extend `EMPTY_RESULTS` and the `totalHits` sum, update placeholder copy.
- `docs/product/design-philosophy.md`: register `kanban` glyph for ticket search rows (one-glyph-one-concept rule).

**Tests**

- `tests/unit/search-service.test.ts`: extend prisma mock with `request.findMany` + `roleGrant.count`. New blocks cover: unauth → empty; member → membership gate in `where`; sysadmin → no gate; status filter; result shape; rows without an originating `RequestGroup` are dropped; type filter (`type=tickets` runs only the request query; other types skip it).
- `tests/unit/search-hit-rows.test.tsx`: new `SearchTicketHitRow` block — href, entity_type, status pill, conditional urgency pill, title.
- `tests/unit/search-shell.test.tsx`: existing tests carry through (added `tickets: []` to `emptyResults`).

## Out of scope (park)

- "Include closed" toggle (done/abandoned tickets).
- Per-link `RequestGroup.isUrgent` in result shape — only `Request.urgency` is surfaced; per-share state is a UI concern.
- Comments-on-tickets search (D078 §2 — privacy review still parked).

---

## Acceptance

- [ ] Migration adds GIN trigram indexes on `Request.title` + `Request.body` (idempotent).
- [ ] Search caller for "hendon" with a member of `hendon-team` returns Hendon tickets (active+backlog) in the `tickets` group.
- [ ] Same query for a non-member (no overlapping group) returns `tickets: []`.
- [ ] Sysadmin bypasses membership gate and sees every matching ticket.
- [ ] `/search?q=hendon&type=tickets` full-mode renders the ticket group.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean.
- [ ] `package.json` patch bumped (v0.2.156).

## Status

Ready.
