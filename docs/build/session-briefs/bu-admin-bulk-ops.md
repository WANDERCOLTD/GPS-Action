# SESSION BRIEF · BU-admin-bulk-ops — checkbox selection + bulk mutations

_Brief version: 1.0 · Author: Paul + Claude · Date: 2026-04-26_
_Priority: post-BU-admin-crud (#79). Direct follow-up._
_Pairs with: BU-admin-crud (the engine this extends), BU-admin-audit-integration
(every bulk mutation calls the per-row audit writer)._

---

## Objective

Admins can select multiple rows in `/data/[entity]` (checkbox per
row) and apply a bulk action from the metadata's `bulkActions`
array — soft-delete, restore, force-release. The list page renders
selection state, a sticky bulk-action bar, and a per-action
confirmation. The server processes the bulk action one row at a
time so each row gets its own audit entry (BU-admin-audit-integration)
and partial failures surface row-by-row.

Success: an admin opens `/data/post`, ticks 5 spam posts, picks
"Soft delete" from the bulk menu, confirms the count → all 5 rows
soft-deleted → audit log shows 5 separate rows → list refreshes
with the 5 gone. If 1 of the 5 fails, the other 4 still go through;
the failing row's id is surfaced in an inline summary.

---

## Scope

### Build in this session

**Service layer:**

- `server/services/admin/bulk.ts` (new) — `bulkSoftDelete`,
  `bulkRestore`, `bulkHardDelete`, `bulkForceRelease`. Each takes
  `{ entity, ids, actorId }` and iterates one row at a time:
  - Calls the per-row registry method
  - Each success increments `succeeded`
  - Each failure captures `{ id, message }` in `failed`
  - Returns `{ succeeded: number, failed: Array<{id, message}> }`
- Audit writes happen per-row inside the registry's mutation
  methods (no changes there) — already in scope of
  BU-admin-audit-integration.

**Router:**

- `server/routers/admin.ts` (MODIFY) — add `bulk` namespace:
  - `admin.bulk.softDelete({ entity, ids })`
  - `admin.bulk.restore({ entity, ids })`
  - `admin.bulk.hardDelete({ entity, ids })`
  - `admin.bulk.forceRelease({ entity, ids })` — gated to
    `request` entity only; no-op for others
  Each procedure validates: caller has `requiresRole.edit`, the
  entity supports the bulk verb (per metadata's `bulkActions`),
  and `ids.length` is bounded (Q3).

**Validation:**

- `shared/validation/admin.ts` (MODIFY) — add the four bulk-input
  schemas:
  - `entity` enum + `ids: z.array(z.string().uuid()).min(1).max(100)`
  - For `forceRelease`: `entity: z.literal('request')`

**UI components (client):**

- `components/admin/BulkSelector.tsx` (new) — client-side state
  hook + checkbox row component. Holds selected-id Set; persists
  in URL hash (`#sel=<id1>,<id2>`) so a refresh keeps the
  selection. (URL hash, not search-param, so it doesn't pollute
  shareable links.)
- `components/admin/BulkActionBar.tsx` (new) — sticky-bottom bar
  visible when ≥1 row selected. Shows count + actions menu.
  Confirmation modal per action shows the count and (for
  destructive actions) requires the typed-confirmation pattern
  from Q5 of BU-admin-crud.
- `components/admin/BulkResultBanner.tsx` (new) — inline banner
  shown after a bulk action completes. Reports succeeded count;
  for failures, lists row ids + error messages with a "copy" link.

**EntityListPage:**

- `components/admin/EntityListPage.tsx` (MODIFY) — wraps the
  table in `<BulkSelector entity={entity}>`; adds a `<th>`/`<td>`
  for the row checkbox; renders `<BulkActionBar />` and
  `<BulkResultBanner />` above the table.

**Server actions:**

- `app/data/[entity]/bulk-actions.ts` (new) — server-action
  wrappers calling `caller.admin.bulk.*`. Returns the
  `{ succeeded, failed }` shape for the banner.

**Tests:**

- `tests/integration/admin-bulk.test.ts` (new, 8+ cases) —
  - Bulk soft-delete on User: all 5 ids soft-deleted, audit
    fires per row
  - Partial failure: 1 of 5 throws → other 4 succeed; the response
    lists the 1 failed id
  - Empty `ids` array → BAD_REQUEST
  - `ids.length > 100` → BAD_REQUEST
  - Caller without edit role → FORBIDDEN
  - Bulk hard-delete on a soft-delete entity → BAD_REQUEST
  - Bulk forceRelease on `user` entity → BAD_REQUEST (only
    `request` accepts it)
  - `bulkActions` not declared in metadata → BAD_REQUEST

- `tests/unit/bulk-selector.test.tsx` (new, 4 cases) — client
  component:
  - Selecting + deselecting updates the count in the action bar
  - "Select all" header checkbox toggles all rows
  - URL hash updates as selection changes
  - Hash-on-load pre-populates selection

### Do NOT touch

- `prisma/schema.prisma` — no schema changes
- `entityMetadata` — no metadata changes (consumes existing
  `bulkActions` array)
- The per-row registry mutation methods — bulk just calls them
  in a loop
- `server/services/admin/crud.ts` — no signature changes; the
  bulk service lives alongside, not on top
- `requireRoleForEntity` — the gate logic stays the same
- Member-facing routes — no changes
- AuditLog write logic — already done by BU-admin-audit-integration
  (this BU depends on that BU shipping first)

### Out of scope (deferred to follow-ups)

- **Async / background bulk jobs.** Synchronous loop only;
  bounded by `ids.length <= 100`. Background queues land if
  the bound proves too tight.
- **Bulk update.** Editing many rows at once via a form is a
  separate UX problem (which fields apply uniformly?). Not in MVP.
- **CSV-driven bulk.** Out — that's BU-admin-csv.
- **Cross-entity bulk** (e.g. "delete this user AND their
  posts"). Out — would need a graph operation; beyond this BU.
- **Selection persistence across pages.** With pagination
  deferred (per BU-admin-crud Q8), this isn't an issue today.
  Lands when cursor pagination ships.
- **Custom per-entity bulk verbs.** The metadata's `bulkActions`
  array is the source of truth. Adding new verbs (e.g.
  `bulkPublish` for posts) is a per-entity follow-up that
  extends the bulk service.
- **Undo affordance.** A "5 rows soft-deleted [Undo]" toast is
  nice but adds state. Restore via the per-row affordance is the
  honest path for now.

---

## Contracts

### Inputs consumed

- `entityMetadata[entity].bulkActions` — the source of truth
  for which verbs each entity supports. The router rejects
  verbs not in this array.
- `requireRoleForEntity` — same gate as per-row mutations
- The registry's per-row mutation methods — called in a loop
- The per-row audit writer (BU-admin-audit-integration) — fires
  one row at a time inside the loop

### Outputs produced

**tRPC contract:**

```ts
admin.bulk.softDelete:
  authedProcedure
    .input(z.object({
      entity: z.enum(ADMIN_ENTITY_KEYS),
      ids: z.array(z.string().uuid()).min(1).max(100),
    }))
    .mutation: returns { succeeded: number, failed: Array<{ id, message }> }

admin.bulk.restore: same shape
admin.bulk.hardDelete: same shape; entity must be softDelete: false
admin.bulk.forceRelease: only entity='request'; same shape
```

**`BulkResult` shape (the data the banner reads):**

```ts
{
  succeeded: number,
  failed: Array<{ id: string, message: string }>,
}
```

---

## Acceptance criteria

### Functional

- [ ] On `/data/user`, ticking ≥1 row reveals the bulk action bar.
- [ ] Bar shows the selected count + a dropdown with the entity's
      `bulkActions` (soft-delete, restore, etc.).
- [ ] "Select all" header checkbox toggles every visible row.
- [ ] Picking soft-delete + confirming → all selected rows
      soft-deleted, page refreshes, banner shows
      "{succeeded} rows soft-deleted".
- [ ] Partial failure: banner shows the succeeded count + lists
      the failed row ids with their error messages.
- [ ] Hard-delete bulk action requires typed confirmation (per Q5
      from BU-admin-crud).
- [ ] Selection state survives a page refresh (URL hash).
- [ ] Empty selection: bar is hidden; submit is impossible.
- [ ] `ids.length > 100`: server rejects with BAD_REQUEST and a
      message guiding to "select fewer rows".
- [ ] Per-row audit entries fire (one per id, not one per bulk
      action) — verified by checking `prisma.auditLog.create`
      was called N times.
- [ ] Caller without edit role: bulk action bar doesn't render
      (server-side gate); direct API call returns FORBIDDEN.

### Non-functional

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run test` all passing (12+ new tests)
- [ ] `npx prettier --check .` clean
- [ ] `npm run trace:check` clean
- [ ] Every new file has `@build-unit BU-admin-bulk-ops` + `@spec`
- [ ] All new interactive elements have `data-testid` (F14)
      starting with `admin-` — `admin-bulk-checkbox`,
      `admin-bulk-action-bar`, `admin-bulk-action-menu`,
      `admin-bulk-confirm-modal`, etc.
- [ ] All colour/spacing values via design tokens (F15)

### Communication

- [ ] PR description summarises the new bulk surface, links this
      brief
- [ ] Commit message: `feat(admin-bulk): BU-admin-bulk-ops —
      checkbox selection + bulk mutations`
- [ ] Branch: `feat/bu-admin-bulk-ops`

---

## Permission matrix

Same as per-row. Bulk verbs require `requiresRole.edit` for the
entity. No new permission concepts introduced.

---

## UI states

### Bulk action bar

| State | Trigger | What user sees |
|---|---|---|
| Hidden | 0 rows selected | (not rendered) |
| Visible | ≥1 row selected | "{N} selected" + action dropdown + clear-selection × |
| Submitting | Action confirmed | Bar shows "Working…" + disabled |
| Success | All ids succeeded | Bar dismisses; result banner shown |
| Partial failure | Some failed | Banner lists failures with copy-id link |

### Confirm modal

| State | Trigger | What user sees |
|---|---|---|
| Soft / restore | Standard verb | "Soft-delete N rows?" + Yes/Cancel |
| Hard delete | Destructive verb | Typed-confirmation modal ("type DELETE") + count |
| ForceRelease | Request entity only | "Force-release N claims?" + Yes/Cancel |

### Result banner

| State | Trigger | What user sees |
|---|---|---|
| All succeeded | `failed.length === 0` | "{N} rows soft-deleted." |
| All failed | `succeeded === 0` | "Could not delete. Try again?" + retry |
| Partial | Both > 0 | "{S} succeeded, {F} failed:" + list of failed ids |

---

## Tests required

**Integration (`admin-bulk.test.ts`):**

1. `bulk.softDelete` on User: 5 ids → all soft-deleted, audit fires 5×
2. Partial failure: mock 1 of 5 throws → response shows 4
   succeeded, 1 failed
3. Empty ids → BAD_REQUEST
4. ids.length > 100 → BAD_REQUEST
5. Caller without edit role → FORBIDDEN
6. `bulk.hardDelete` on `user` (softDelete: true) → BAD_REQUEST
7. `bulk.forceRelease` on `user` → BAD_REQUEST (only `request`)
8. `bulk.softDelete` on entity whose metadata `bulkActions`
   doesn't include `softDelete` → BAD_REQUEST

**Unit (`bulk-selector.test.tsx`):**

9. Tick 2 rows → action bar shows "2 selected"
10. Untick all → bar hidden
11. Select-all header toggles every row
12. URL hash reflects selection; hash-on-load pre-populates

**Manual click-through:**

13. Bette (admin) → `/data/post` → ticks 3 → bulk soft-delete →
    banner shows "3 rows soft-deleted" → refresh shows 3 fewer rows
14. Bette → mock partial failure (e.g. by deleting one of the 3
    in another tab between selection and submit) → banner shows
    2 succeeded + 1 failed with the id

---

## Known gotchas

- **Audit per row, not per bulk.** Each row mutation calls the
  per-row registry method, which calls `writeAdminAudit()`
  (BU-admin-audit-integration). Result: N audit rows for N rows
  mutated. Verified in test #1.
- **Sequential, not parallel.** The loop processes rows one at
  a time. Parallelism could overwhelm Postgres for large N or
  introduce race-condition risk on related rows. ids.length ≤ 100
  bound makes sequential acceptable.
- **Partial failure surfaces honestly.** Don't silence the failed
  ids — surface them in the banner with their messages. The
  admin can retry just the failures.
- **URL hash, not search param.** Selection state is local
  navigation only — it shouldn't pollute shareable URLs (search
  params do leak when admins paste a URL elsewhere).
- **Bulk action bar is sticky-bottom.** Use `position: sticky;
  bottom: 0;` for natural scroll behaviour. Honest UX —
  admins always see "what's pending."
- **Select-all only covers visible rows.** The list page renders
  ≤50 rows by default (per BU-admin-crud Q8). "Select all"
  selects only what's currently visible — not "every row in the
  database." Tooltip clarifies: "Select all visible rows."
- **Hard-delete bulk requires typed-confirmation EVERY time.**
  Per BU-admin-crud Q5. The count goes in the modal copy.

---

## Decisions confirmed before build (Paul, 2026-04-26)

These lock the five Open Questions below.

1. **Bulk size cap: 100 ids per call.** Sequential loop within
   that bound is acceptable; bigger risks Postgres timeouts.
2. **Sequential processing.** One row at a time. Per-row audit
   chain stays clean; concurrency risks race conditions.
3. **"Select all" = visible rows only.** Slice 1 doesn't have
   pagination; this is moot today. "Match the search" lands
   when cursor pagination + filtered selection ships.
4. **Undo affordance: out for MVP.** Per-row Restore is the
   honest path. A bulk-undo toast adds state and complicates
   the audit story.
5. **Banner persists until dismissed.** Stays until admin
   dismisses it, navigates away, or runs another bulk action.
   Don't auto-dismiss — admin needs to see what failed.

---

## Open questions to surface to Paul

(Originally pinned for review. All resolved above; preserved
here as the trail of recommendations + rationale.)

1. **Bulk size cap.** 100 chosen. Tradeoff: too high = slow loop
   + risk of timeout; too low = repetitive UX. Confirm 100 or
   propose different.
2. **Sequential processing.** Confirmed sequential per the
   gotcha above. If concurrent processing is wanted later, it's
   a separate trigger.
3. **"Select all" semantics.** Visible rows only (recommended)
   vs "match the search" (would need a server-side scope).
   Recommend visible-only for slice 1; "match the search" lands
   when cursor pagination + filtered selection is added.
4. **Undo affordance.** Out for MVP per scope. Confirm.
5. **Banner persistence.** Banner stays until the admin
   dismisses, navigates, or runs another bulk action. Confirm —
   don't auto-dismiss.

---

## Definition of done (per working-rhythm.md §3)

### Functional

- [ ] All acceptance criteria pass
- [ ] Manual click-through tests #13 + #14 done

### Mechanical

- [ ] `npm run typecheck`, `lint`, `test`, `prettier`, `trace:check` clean
- [ ] BU-admin-audit-integration is merged before this BU starts
      (audit writes per-row depend on it)

### Discipline

- [ ] All new files have `@build-unit BU-admin-bulk-ops` + `@spec`
- [ ] All interactive elements have `data-testid` (F14)
- [ ] No design-token violations (F15)
- [ ] Layer boundaries respected
- [ ] No schema changes; no migrations

### Communication

- [ ] PR description, links this brief, lists open questions surfaced
- [ ] Commit + branch follow conventions

---

## Context

**Specs:**

- `docs/architecture/admin-surface.md` — bulk-actions paragraph
- `docs/build/session-briefs/bu-admin-crud.md` — Q5 hard-delete
  pattern, Q8 list-take limit
- `docs/build/session-briefs/bu-admin-audit-integration.md` —
  per-row audit (this BU's prerequisite)

**Existing code to read first:**

- `server/services/admin/registry.ts` — per-row methods bulk loops over
- `server/services/admin/crud.ts` — call signatures
- `server/routers/admin.ts` — where bulk procedures register
- `components/admin/EntityListPage.tsx` — where checkbox column lands
- `components/admin/RowMutationButton.tsx` — typed-confirmation
  pattern (Q5)
- `entityMetadata.user.bulkActions` etc. — the verb source

---

## What this brief does NOT cover

1. Async / background bulk jobs
2. Bulk update (only soft-delete / restore / hard-delete /
   forceRelease)
3. CSV-driven bulk (BU-admin-csv)
4. Cross-entity cascades
5. Selection across paginated pages
6. Custom per-entity bulk verbs beyond what metadata declares
7. Undo affordance

---

## What lands after this session

- Admins can clean up many rows at once without N×click-confirm
  dance
- Per-row audit chain stays intact (forensic clarity preserved)
- The bulk surface is generic — adding a new bulk verb to a new
  entity is `metadata.bulkActions += ['new-verb']` plus a
  per-verb implementation in `server/services/admin/bulk.ts`
- Sets the pattern for BU-admin-csv (which will use the same
  bulk service for batch import)
