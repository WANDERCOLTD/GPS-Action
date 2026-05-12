---
slug: bu-search-network-and-scope-prefs
status: ready
phase: 3
priority: medium
---

# SESSION BRIEF · bu-search-network-and-scope-prefs — Search the network feed; admin + per-user scope toggles

_Author: Paul + Claude · Created: 2026-05-12 · Type: incremental extension of BU-search-surface (#189) + BU-search-result-cards (#190) + BU-search-includes-kanban (#279) + bu-search-includes-comments (#283)._

---

## Why

`/search` currently spans Posts, People, Regions, Tickets, Comments and (placeholder) Partner orgs — but **not** `/network`, the WhatsApp-mirror feed that's become the most active surface in the app. Members want to find a sender, a link, or a phrase from a group conversation the same way they find a post. This BU adds **Network messages** as a sixth real result group.

While we're touching scope plumbing, this BU also resolves a related discomfort: every scope is currently always-on, with no operational off-switch and no per-member preference. Network in particular ships pilot-soft, so an admin-controllable default plus per-user opt-in is the right shape. We're putting **one feature flag per search scope**, with Network as the only one defaulted ON for this BU, and surfacing the per-user overrides under `/settings` (linked from the avatar `UserMenu` shipped in #361).

---

## Decisions captured (2026-05-12)

| # | Decision | Note |
|---|----------|------|
| 1 | **One flag per scope.** Names: `ff_search_network`, `ff_search_posts`, `ff_search_people`, `ff_search_regions`, `ff_search_partner_orgs`, `ff_search_tickets`, `ff_search_comments`. | Independent admin toggles, simple eval. No nested-array flag. |
| 2 | **Defaults: Network ON, all others OFF (globally).** | `enabledGlobally: true` only for `ff_search_network` in the seed migration. The other six ship OFF; admin flips them on once we're ready to expose them per-user. |
| 3 | **Network search uses `ILIKE`, no GIN index.** | TODO captured in this brief for a future `pg_trgm` upgrade. Rationale: `public.gps_group_messages` is Grant's Supabase view — we can't `CREATE INDEX` on it from this repo, and row counts are still small. |
| 4 | **Per-user override wired in this BU.** | New `UserSearchScopePreference` model is the source of truth for "is scope X on for user Y". |
| 5 | **Admin OFF = default-only, not hard kill.** | If `ff_search_<scope>.enabledGlobally` is false, the scope is off **only for users who have not set an explicit preference**. Members can opt themselves in via `/settings/search`. |
| 6 | **Cascade with surface flags.** | If the surface's own flag is off (e.g. `network_feed`), the corresponding search scope evaluates off regardless of admin or per-user state. You can't search a surface you can't see. |
| 7 | **Per-user prefs UI lives at `/settings/search`,** linked from `UserMenu`. | Sub-page, not inline in the dropdown. Six rows currently (one per available scope). |

### Scope-eval order (canonical)

For a given `(userId, scope)`:

1. **Cascade gate.** If the scope's own surface flag is off (e.g. `network_feed`, or `ff_comments` for comments), return `false`. No further checks.
2. **Per-user override.** If a `UserSearchScopePreference` row exists for `(userId, scope)`, return its `enabled`.
3. **Admin default.** Return `ff_search_<scope>.enabledGlobally`.

Anonymous callers skip step 2 and read the admin default directly.

---

## Scope

### Build in this session

**Schema + migration**

- `prisma/schema.prisma`: new model

  ```prisma
  model UserSearchScopePreference {
    id        String      @id @default(cuid())
    userId    String
    scope     SearchScope
    enabled   Boolean
    createdAt DateTime    @default(now())
    updatedAt DateTime    @updatedAt
    user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@unique([userId, scope])
    @@index([userId])
  }

  enum SearchScope {
    posts
    people
    regions
    partner_orgs
    tickets
    comments
    network
  }
  ```

  Add the reverse relation on `User`.
- ADR alongside (per "no schema change without ADR" rule): `docs/adrs/00NN-search-scope-prefs.md` covering the `UserSearchScopePreference` table + the eval order above.
- Migration `prisma/migrations/<ts>_user_search_scope_preferences/migration.sql`:
  - `CREATE TYPE "SearchScope" AS ENUM (…)`.
  - `CREATE TABLE "UserSearchScopePreference" …`.
  - Idempotent data-migration inserts for the seven `FeatureFlag` rows (`ff_search_*`). Network row is `enabledGlobally = true`; the other six are `enabledGlobally = false`. Each row sets `purpose = 'rollout'`, `ttlRemoveAfter = '2026-11-30'`, `createdBy = 'system-migration'`. Per CLAUDE.md / D070 — reference data lives in migrations, not seed scripts.

**Validation**

- `shared/validation/search.ts`:
  - Append `'network'` to `SEARCH_ENTITY_TYPES` (between `'comments'` and end is fine; group order is enforced separately in `SearchShell.GROUPS`).
- `app/api/analytics/search/route.ts`: append `'network'` to `VALID_ENTITY_TYPES`.

**Feature flags + register**

- `docs/product/feature-flag-register.md`: add seven rows (see Decisions §1). One paragraph note above the table explaining the new "per-scope search flag" pattern (default-only semantics; per-user overrides live elsewhere).
- `docs/architecture/decision-log.md`: new entry **D079** — "Search scopes are feature-flagged + per-user-tunable" — citing this brief and ADR-00NN.

**Service**

- `server/services/flags.ts`: keep the existing `isFeatureEnabled(name)` signature unchanged. **Do not** mix per-user search prefs into the general flag evaluator — search-scope prefs are a domain concept, not a flag rollout. (D036 per-user flag eval can land in a separate BU.)
- `server/services/searchScopePrefs.ts` (new):
  - `getEnabledScopes(callerId: string | null): Promise<Set<SearchEntityType>>` — implements the eval order in this brief. Reads:
    - `network_feed`, `ff_comments`, `ff_reactions`, plus any other surface flags relevant to a scope (cascade step).
    - All seven `ff_search_*` rows (admin defaults).
    - For authenticated callers, all `UserSearchScopePreference` rows for that user (overrides).
  - `setScopePreference(userId, scope, enabled): Promise<void>` — upsert by `(userId, scope)`.
  - `resetScopePreference(userId, scope): Promise<void>` — delete the row so the admin default applies again.
- `server/services/search.ts`:
  - New `searchNetworkMessages(q, callerId, limit)`. Reads from the Supabase `gps_group_messages` view via the existing `server/lib/supabase.ts` client. Joins with `NetworkCardState` so the result row can show triage status. ILIKE-matches `text_body`, `link_title`, `from_name`. **No** `chat_id` matching in v1 — channel chips already handle group narrowing.
  - Returns `NetworkSearchHit { messageId, sentAt, fromName | null, textExcerpt, linkTitle | null, url | null, chatId, isForwarded, triageStatus }`.
  - **Visibility:** any authenticated caller (no membership check needed — `/network` is currently network-wide for any signed-in member). Anonymous callers get zero network hits.
  - **TODO comment:** `// TODO(search-perf): no GIN index on gps_group_messages — ILIKE only. Revisit when row count > 50k or p95 latency > 500ms. See brief bu-search-network-and-scope-prefs §3.`
  - `searchAll(q, callerId, limit?)`:
    - Before running the per-entity queries, call `getEnabledScopes(callerId)` and only run the searches for enabled scopes. Disabled scopes return `[]` in the result shape (so the consumer doesn't have to special-case missing keys).
    - Extend the `Promise.all` and result object to include `network`; `emptyResults` carries `network: []`.

**Router**

- `server/routers/search.ts`:
  - Re-export `NetworkSearchHit` for `/app` + `/components`.
  - No new procedure for search itself — `searchAll` returns the new group naturally.
- `server/routers/user.ts` (or a new `userPreferences` router if cleaner — pick at build):
  - `searchScopePreferences.list` — authenticated; returns `Array<{ scope, enabled, source: 'user' | 'admin' }>` for all seven scopes, where `source: 'admin'` means no user row exists. Used by the settings page to render.
  - `searchScopePreferences.set` — authenticated; `{ scope, enabled }`. Upserts.
  - `searchScopePreferences.reset` — authenticated; `{ scope }`. Deletes the user row so admin default re-applies.

**UI**

- `components/SearchHitRows.tsx`: new `SearchNetworkHitRow`:
  - `lucide-react` `MessagesSquare` glyph (re-use rule — already used for network surface elsewhere; verify in glyph register, add if missing).
  - Layout: sender name (or `Anonymous`) · group / `chatId` label · short body excerpt (clamped ~120 chars) · `<RelativeTime>` for `sentAt`.
  - Forwarded badge if `isForwarded` — re-use `<ForwardedBadge>` from `bu-network-source-chips` (#343) if exported, else inline.
  - Click → `/network?focus=<messageId>` (the network surface already supports row-focus via this param — verify at build; if not, link to `/network` with no focus and surface the row by `sent_at` proximity).
- `components/SearchShell.tsx`: append `'network'` to `GROUPS` (place after `'comments'`, before any deferred groups), wire row into `ResultList`, extend `EMPTY_RESULTS` and `totalHits`, update placeholder copy. Group label: **"From the network feed"**.
- `app/settings/search/page.tsx` (new sub-page):
  - Server component. Fetches `searchScopePreferences.list` via tRPC SSR.
  - Renders an `<h1>Search preferences</h1>` plus one toggle row per scope:
    ```
    [toggle]  Network feed              (Default: on)
    [toggle]  Posts                     (Default: off)
    [toggle]  People                    (Default: off)
    [toggle]  Regions                   (Default: off)
    [toggle]  Tickets                   (Default: off)
    [toggle]  Comments                  (Default: off)
    [toggle]  Partner organisations     (Default: off)
    ```
  - Toggle that matches the admin default shows "Reset to default" greyed out / hidden; toggle that diverges shows a "Reset" link beside it that calls `searchScopePreferences.reset`.
  - Honest copy: "Your choices take effect on your next search. Admins can change the defaults at any time — your preferences override the admin default for you."
  - **Cascade visibility:** if a scope's surface flag is off (e.g. `network_feed` off in this env), grey out the toggle and replace the "(Default: …)" with **"Unavailable in this environment"**. The toggle is still rendered (so the surface is discoverable as you roll things out) but disabled.
- `app/settings/page.tsx`: add a navigation entry "Search preferences →" linking to `/settings/search`. If `/settings` is currently a single page, add a section; if it's already a sub-nav, register the route.
- `components/UserMenu.tsx`: **no change needed** — the existing `<Settings>` item already links to `/settings`. Verify at build that the new sub-page is discoverable from there.

**Telemetry**

- Append to `docs/product/analytics-events.md`:
  - `search_scope_pref_toggled` — `{ scope, enabled, source_before: 'admin' | 'user' }`.
  - `search_scope_pref_reset` — `{ scope }`.
  - `search_result_clicked` already covers network hits via existing `entity_type` field — just add `'network'` to the enum docs.
- No raw query strings (PII policy — existing rule).

**Tests**

- `tests/unit/search-scope-prefs.test.ts` (new):
  - Eval order: admin-default-only (no user row) → returns admin value.
  - Per-user override turns on a scope that admin defaults off.
  - Per-user override turns off a scope that admin defaults on (Network).
  - Cascade: `network_feed` off → network scope returns disabled even if both admin and user are on.
  - Anonymous caller: per-user prefs ignored; admin defaults only.
  - Reset: `setScopePreference` then `resetScopePreference` returns to admin default.
- `tests/unit/search-service.test.ts`:
  - Extend prisma mock with `userSearchScopePreference.findMany`.
  - New blocks: search with Network disabled → `network: []` returned; search with all scopes off → all empty arrays, query never runs.
- `tests/unit/search-shell.test.tsx`: existing tests carry through (added `network: []` to `emptyResults`).
- `tests/unit/search-hit-rows.test.tsx`: new `SearchNetworkHitRow` block — href, sender name fallback, excerpt clamp, forwarded badge, `RelativeTime`.
- `tests/unit/settings-search.test.tsx` (new): renders one row per scope; toggle calls `set` mutation; reset calls `reset` mutation; unavailable scopes are disabled.

### Out of scope (park)

- **`pg_trgm` GIN index on network messages.** Captured as TODO in `searchNetworkMessages`. Revisit at scale (>50k network rows or p95 > 500ms) — likely requires a Supabase-side migration in coordination with Grant (AIFA).
- **Per-region or per-group scoping.** The per-user pref is binary on/off per scope; no finer-grained scope shaping (e.g. "search network but only my groups") in v1.
- **`chat_id` text match.** Channel chips on `/network` already cover source filtering — duplicating it in search adds noise. Revisit only if pilot signal shows it's needed.
- **General-purpose per-user flag override.** Per-user *flag* evaluation (the `FeatureFlag.enabledForUserIds[]` array, deferred in D036) is **not** wired by this BU. Search-scope prefs live in their own table; the general flag system stays untouched.
- **Admin UI for per-user-pref inspection.** Admins manage the seven `ff_search_*` flags via the existing `/data/featureFlag` CRUD page. There is no admin surface for "show me what scope prefs user X has set" in this BU.
- **Saved searches / search history sync** — still parked (was deferred in D078).
- **Network sender clustering** ("messages from this sender" group) — not a search concern; row click already lands on `/network` where source chips help.

---

## Acceptance

- [ ] `UserSearchScopePreference` model + `SearchScope` enum migrate cleanly on a fresh DB and existing DB.
- [ ] Seven `ff_search_*` rows exist after `prisma migrate deploy`; only `ff_search_network` has `enabledGlobally = true`.
- [ ] Authenticated member with no prefs set searches "hendon" → sees Network results group populated and visible; other groups respect their admin defaults (off → empty arrays).
- [ ] Authenticated member toggles `ff_search_posts` ON via `/settings/search` → next search shows the Posts group populated even though admin default is OFF.
- [ ] Authenticated member toggles `ff_search_network` OFF → next search omits Network group.
- [ ] Member taps "Reset to default" on a diverged toggle → the row is deleted; the admin default applies again on the next list fetch.
- [ ] Admin flips `ff_search_network.enabledGlobally` to false in `/data/featureFlag` → members with no user pref see Network empty; members with explicit user override (true) still see Network results.
- [ ] Admin flips `network_feed` to false → Network scope returns empty for **every** caller regardless of per-user pref (cascade).
- [ ] Anonymous caller searching anything → all scopes evaluated against admin defaults only; never reads `UserSearchScopePreference`.
- [ ] `/settings/search` renders seven toggles, correct default labels, "Unavailable in this environment" for scopes whose surface flag is off.
- [ ] Network search hit row links to `/network?focus=<messageId>` (or `/network` if focus param isn't wired yet).
- [ ] Forwarded network messages render the forwarded badge in the result row.
- [ ] `search_scope_pref_toggled` and `search_scope_pref_reset` telemetry fire on the settings page.
- [ ] No raw query strings or message bodies in analytics payloads.
- [ ] D079 entry added to decision log; ADR-00NN added for the schema change; D078 §2 cross-referenced (comment-search flag now governs the existing surface).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean.
- [ ] `package.json` patch bumped per versioning rule.
- [ ] `pnpm trackers` run if any `@spec` annotations move (per memory note on traceability matrix drift).

---

## Open questions for the build session

1. **`/network?focus=<id>` support.** Verify whether the network surface already accepts a `focus` query param (set by `bu-network-source-chips` or follow-ups). If not, either ship the focus support in this BU or fall back to plain `/network` + a polite anchor.
2. **`searchScopePreferences` namespace.** Add to existing `user` router, or carve out a new `userPreferences` router so future per-user prefs have a home? Pick the cleaner option at build.
3. **Glyph for network result row.** Confirm `MessagesSquare` is already in the glyph register; if not, add it in the same commit (memory note: one-glyph-one-concept, same-commit register update).
4. **Toggle defaults beyond v1.** Once admin observes pilot usage, the OFF-by-default for non-Network scopes will likely flip. Capture that operational follow-up in the brief's "Status" block at ship time.

---

## Immediate-need split (Paul, 2026-05-12)

> "I need current search to return /network items — how can we do that now? Is it done?"

**It is not done.** Current `search.query` covers Posts / People / Regions / Partner orgs / Tickets / Comments. Network messages are unreachable from search today.

**Phase 1 fast lane — ship network search without flags or prefs.** A minimal PR that lands the user-visible behaviour ("type 'hendon' → see network messages") and leaves the admin/per-user machinery for Phase 2:

- Append `'network'` to `SEARCH_ENTITY_TYPES` in `shared/validation/search.ts`.
- Add `searchNetworkMessages(q, callerId, limit)` to `server/services/search.ts` per the "Service" section above (ILIKE only; TODO comment in place).
- Extend `searchAll`'s `Promise.all` + result shape with `network`. **Skip** the `getEnabledScopes` gate in Phase 1 — every authenticated caller gets network results unconditionally.
- Add `SearchNetworkHitRow` to `components/SearchHitRows.tsx`; append `'network'` to `SearchShell.GROUPS`.
- Re-export `NetworkSearchHit` from `server/routers/search.ts`.
- Update `app/api/analytics/search/route.ts` `VALID_ENTITY_TYPES`.
- Tests for the network branch only; no migration, no ADR, no decision-log entry, no settings page.

**Phase 2 — the rest of this brief.** Schema (`UserSearchScopePreference` + `SearchScope` enum), the seven `ff_search_*` flag rows, `searchScopePrefs` service with the cascade-eval order, `/settings/search` page, telemetry, ADR-00NN, D079. Lands on top of Phase 1.

**Why split:** Phase 1 unblocks the immediate "find that message" use case in one session. Phase 2 carries the heavier load (schema + ADR + UI + tests) and benefits from Phase 1 being live so we can pilot defaults against real usage before flipping the other six scopes on.

---

## Related

- BU-search-surface (#189, D078 / ADR-0004) — the foundation
- BU-search-result-cards (#190), bu-search-includes-kanban (#279), bu-search-includes-comments (#283) — prior scope extensions
- bu-network-source-chips (#343) — the network surface foundation
- D036 — feature-flag discipline (per-scope flag pattern fits here; per-user flag eval intentionally deferred)
- D070 — reference data in migrations (the seven `ff_search_*` rows seed via migration)
- ADR-0017 §4 (`NetworkCardState`) + memory note on Grant/AIFA pipe ownership
- `components/UserMenu.tsx` (#361) — the avatar dropdown that links to `/settings`
