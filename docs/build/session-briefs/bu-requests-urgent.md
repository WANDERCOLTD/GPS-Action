# SESSION BRIEF · BU-requests-urgent — alerts + claim/resolve + polling + FAB tile

_Brief version: 1.0 · Author: Paul (via Claude) · Date: 2026-04-26._

Pairs with **D058** (urgent flag, AlertCategory, polling), **D061** (tap pattern), and **SCN-23** (Maya raises an urgent alert at the school gate). Read those first — every decision below is downstream of them. Sequencing context: `docs/build/session-briefs/bu-requests-sequencing.md` — this is "Path B" — the brand-promise demo.

---

## Objective

Land SCN-23 end-to-end. Maya at the school gate raises an urgent alert; every reviewer with relevant scope sees it within 10 seconds; Sharon picks it up, acts, and resolves it. This is the brand-promise demo — what distinguishes GPS Action from a WhatsApp group.

Success looks like: log in as Maya → tap the alert FAB tile on the feed → fill a streamlined composer (category + title + body) → submit. Switch to Cary's session → see the urgent alert at the top of /requests within 10s. Tap claim → tap resolve. Switch back to Maya → see "claimed by Cary" then "resolved" status.

---

## Scope

Single BU, three commits-ish. Ships as one PR.

### 1. Schema additions (additive migration, ADR-cited)

```prisma
// New on Request (D058)
urgency           Boolean   @default(false)
urgencyExpiresAt  DateTime? // claimed window from SystemSetting urgent_ttl_hours
alertCategoryId   String?
alertCategory     AlertCategory? @relation(fields: [alertCategoryId], references: [id], onDelete: SetNull)

// New entity (D058)
model AlertCategory {
  id          String   @id @default(uuid())
  slug        String   @unique  // "happening-now"
  displayName String                  // "Happening now"
  icon        String?  // lucide icon name; null = default warning triangle
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  deletedAt   DateTime?
  requests    Request[]
}

// New entity (D058 — generic key/value admin settings)
model SystemSetting {
  id          String   @id @default(uuid())
  key         String   @unique  // "urgent_ttl_hours"
  value       String   // stored as text, parsed at read site
  updatedAt   DateTime @updatedAt
  updatedByUserId String?
  updatedBy   User?    @relation(fields: [updatedByUserId], references: [id], onDelete: SetNull)
}
```

Single additive Prisma migration. No backfill — existing Requests just default `urgency: false`.

### 2. Server — services + routers

- `server/services/alert-category.ts` — `listActive()`, `getBySlug()`. Read-only this BU; admin CRUD lives in BU-admin-crud.
- `server/services/system-setting.ts` — `get(key)`, `set(key, value, userId)`. Get is unauth; set is admin-only.
- `server/services/request.ts` (extend) — `createUrgent(input)` (D058 visibility broadening), `claim(requestId, userId)` (atomic UPDATE WHERE status='unclaimed'), `resolve(requestId, userId, note)`. All write actions emit audit-log entries.
- `server/routers/request.ts` (new) — tRPC router exposing `listForCaller`, `createUrgent`, `claim`, `resolve`, `pollUrgent` procedures. `pollUrgent` is unauth-friendly (returns broadened visibility per D058 — all reviewers see urgent regardless of scope).
- `server/routers/_app.ts` — register `request` router.

### 3. Client — alert composer + FAB tile + claim/resolve UI

- **FAB tile on `/feed`**: red warning triangle + exclamation. Single-tap opens `/alert/new` (or composer modal — server component pattern preferred). Per D044 / D061. Visible to authenticated members.
- **`/alert/new` route**: streamlined composer — `<AlertCategoryPicker>` (chip selector) + title + body fields. Submit creates Request with `urgency: true`. Redirect to `/requests` on success.
- **`/requests` enhancements**:
  - Urgent rows render with red left-border strip + alert badge
  - Reviewer view auto-polls every 10s for urgent Requests (uses `pollUrgent` procedure; no full page reload)
  - Each unclaimed urgent Request gets a `<ClaimButton>` (server action)
  - Each claimed urgent Request gets a `<ResolveForm>` — one text input + button (note becomes `resolutionNotes`)
  - Audit timeline shows: created → claimed by X → resolved by X with note
- **`/feed` urgent strip**: pinned banner above the post list when active urgent Requests are visible to the caller. Tapping the banner deep-links to `/requests` with that Request anchored.

### 4. Seed — Maya + categories + setting

- New seeded user: **Maya Greenberg** (member, Tower Hamlets coordinator). Add to `scripts/seed.ts` SEED_USERS list.
- Seed `AlertCategory` row: `{ slug: 'happening-now', displayName: 'Happening now', icon: 'alert-triangle' }`.
- Seed `SystemSetting` row: `{ key: 'urgent_ttl_hours', value: '4' }`.
- Seed one pre-existing urgent Request from Maya so Cary's queue shows it on the demo's first run.

### 5. Tests

- `server/services/request.ts` — unit tests for claim atomicity, resolve transitions, createUrgent visibility broadening
- `server/services/alert-category.ts` — listActive returns sorted non-deleted rows
- `server/services/system-setting.ts` — get/set round-trip
- `tests/integration/request-router.test.ts` — full procedure happy paths + auth gates
- `tests/unit/alert-fab-tile.test.tsx` — renders icon, has correct testid
- Don't add a polling test (timer-driven, brittle in Vitest) — manually verify

---

## NOT in this BU

| Item | Where it lands |
|---|---|
| Audience-toggled comments on Requests (`audience: 'reviewers'`) | BU-requests-vetting |
| @mentions inside Request comments → Notification entity | BU-requests-vetting |
| Full Notification entity + delivery (D057) | BU-requests-vetting |
| Per-entity row list pages on `/data` | BU-admin-crud |
| AlertCategory admin CRUD UI | BU-admin-crud |
| Real urgent TTL editor in `/settings` | BU-admin-crud or its own small BU |
| WebSocket / SSE real-time delivery | Phase 2 (D058 explicit MVP = polling) |
| Push notifications | Phase 2 |

---

## Demo path post-merge

Pre-flight: pull main, `npx prisma migrate deploy`, `npm run db:seed`, `PORT=3001 npm run dev`.

1. Log in as **Maya** at `/dev/login`
2. `/feed` → tap the red warning-triangle FAB tile (top-right of feed page)
3. Composer opens → pick "Happening now" category → "Antisemitic leaflets at Cheddar Road school" / one-paragraph body → submit
4. Redirect to `/requests` → see the new urgent row in "My requests" with red strip
5. Switch tab — log in as **Cary** at `/dev/login`
6. `/requests` → reviewer queue shows Maya's urgent at the top with red strip + "happening now" badge
7. Tap **Claim** → row updates to "Picked up by Cary"
8. Tap **Resolve** → enter "I've messaged the school head, action taken" → submit
9. Switch back to Maya — within 10s the row updates to "resolved · 14:38"

That's the brand-promise demo, end to end.

---

## Acceptance criteria

- [ ] `npm run typecheck && npm run lint && npm test` green
- [ ] `npm run trace:check` passes; matrix regenerated
- [ ] Migration runs cleanly on local dev DB; existing data unaffected
- [ ] Seed produces Maya + the alert category + the urgent Request
- [ ] FAB tile visible on `/feed` for authed members; single-tap opens composer
- [ ] Composer submits → urgent Request created with `urgency: true`
- [ ] Reviewer queue auto-polls every 10s; urgent rows visually distinct
- [ ] Claim is atomic (race-safe); resolve writes `resolutionNotes`
- [ ] Audit log gets a row for every urgent_created / claim / resolve
- [ ] D061 tap contract respected (FAB tile = action target; row body-tap → detail; chevron unused this BU since detail-page integration is light)
- [ ] No `any` types; no inline auth checks (uses `requireRole` middleware)

---

## D058 in code

- **Visibility broadening:** `listForCaller` filters by scope normally (per BU-requests-foundation), BUT urgent Requests skip the scope filter — every authenticated user with `queue_manager` (any scope) sees urgent. Acting on urgent (claim/resolve) still respects scope so non-vetting reviewers can't resolve a vetting case.
- **Polling cadence:** 10s per D058. Implemented via client-side `setInterval` in the reviewer view; the procedure is cheap (indexed `WHERE urgency=true AND deletedAt IS NULL`).
- **TTL:** `urgencyExpiresAt = createdAt + SystemSetting('urgent_ttl_hours')`. Past-TTL urgent Requests still show but with a "stale" badge; not auto-resolved (admin can revisit).
- **AlertCategory:** seeded with one row ("Happening now"). Admin CRUD deferred. The picker on the composer queries `listActive()` so adding categories via DB inserts (or BU-admin-crud later) flows through automatically.

---

## Open questions / risks

1. **Comment-on-Request UI** — deliberately deferred to BU-requests-vetting. Maya/Sharon's flow uses status transitions + resolve-note instead of a comment thread. If demo feedback says "we need comments," that's the trigger to fast-track BU-requests-vetting.
2. **Polling battery cost** — 10s is aggressive for mobile. Acceptable for the demo (which won't run for hours); consider 30s once we have real users + observability. Tracked post-demo.
3. **Race on claim** — using `prisma.request.updateMany({ where: { id, status: 'unclaimed' }, data: { ... } })` returning `count: 0` if another reviewer beat us. Tests must cover this.

---

## Related

- D058 — Urgent flag, AlertCategory, admin TTL, polling (the spec)
- D044 — FAB intent-cards composer (the alert tile lands inside this pattern)
- D054 — Request entity (this BU extends)
- D055 — per-type role scopes (visibility broadening exception is documented here)
- D061 — Global tap interaction pattern
- SCN-23 — Maya raises an urgent alert at the school gate (the demo)
- `docs/build/session-briefs/bu-requests-sequencing.md` — Path B — recommended after foundation
- working-rhythm.md — session discipline
