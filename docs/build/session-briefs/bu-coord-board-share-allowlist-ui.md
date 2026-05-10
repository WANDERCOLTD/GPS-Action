---
slug: bu-coord-board-share-allowlist-ui
status: shipped
shipped_in: '#276'
phase: 3
priority: high
note: 'Mini-atom of bu-coordination-board (Q1 in v0.4 brief). Group admins configure which other groups they can share Requests to via `/board/<slug>/settings`. Build is a single page + server actions + 1 new service helper; backend (addShareWorkflow / removeShareWorkflow / listShareWorkflowTargets) already shipped in PR #254 / atom 5e.'
---

# SESSION BRIEF · bu-coord-board-share-allowlist-ui — Configure share-with-team allow-list

_Brief version: 0.1 · Author: Paul (via Claude) · Date: 2026-05-06_

A group-admin settings page at `/board/<groupSlug>/settings` where the
admin picks which other groups this group can share Requests to. The
page populates the `GroupShareWorkflow` table that constrains the
Surface 2 Share-with-team picker (atom 5e, PR #254).

---

## Why this exists / why now

Pilot rollout (Writers + IT) needs the Share-with-team picker to be
populated for real, non-demo groups. The seed PR (#274) populated the
demo groups so smoke-tests work, but every real group will start with
zero allow-list entries. Without this UI the only way to configure
allow-lists is direct DB insert or the generic admin entity registry —
neither is acceptable for non-engineer admins.

This was Q1 in `bu-coordination-board.md` v0.4: _"Share-with-team
workflow config UI. Where do group admins set the per-team allow-list?
Recommend: a section on the group settings page (`/board/<slug>/settings`).
Surface not yet sketched."_ The recommended path is now built.

Without this BU, real-group pilot acceptance for PR #8 (the
`coord_board_v1` flag flip) is blocked.

---

## Objective

A group admin (or system admin) lands on `/board/<groupSlug>/settings`
from a settings link in the board header, sees:

1. Currently allow-listed share targets (each with a "Remove" button).
2. An "Add target" picker listing all other groups this admin can
   pick from (excluding the source group itself and any already-added
   targets).

Picking a target → row appears in (1). Removing a target → row
disappears from (1) and reappears in (2).

Members who aren't group admins of the source group (and aren't system
admins) get redirected to the board view.

---

## Surface

`/board/<groupSlug>/settings` — server component.

Layout:

- **Header** with breadcrumb: `← <Group name> board`.
- **Page title**: "<Group name> — settings".
- **Section: Share allow-list** — short helper paragraph + the two
  lists below.
- **Allowed targets** — list of current `GroupShareWorkflow` rows.
  Each row: target group name, `Remove` button, audit-friendly
  `addedAt` text. Empty state: "No allow-list yet — pick a target
  below to start."
- **Add target** — a `<select>` of pickable groups + an `Add`
  submit button. Empty state (no groups left to add): "All other
  groups are already on the allow-list."

Layout token-driven, matches `/board/<slug>/[ticketId]` chrome.

---

## Scope (build list)

### Service additions (`server/services/request-group.ts`)

- `listAddableShareTargets(sourceGroupId)` — returns all non-deleted
  groups MINUS sourceGroupId MINUS already-active workflow targets,
  ordered by `displayName ASC`. Pure read. Mirror the shape of
  `listShareWorkflowTargets`'s `{ workflow, group }` return.

(Existing `addShareWorkflow`, `removeShareWorkflow`,
`listShareWorkflowTargets` are unchanged.)

### Router additions (`server/routers/share.ts`)

- `share.listAddableTargets(sourceGroupId)` — wraps the new service.
  Permission: `assertCanAdminBoard` (group admin of source OR system
  admin).

### App routes + components

- `app/board/[groupSlug]/settings/page.tsx` — the page.
- `app/board/[groupSlug]/settings/actions.ts` — server actions
  `addWorkflowAction(input)`, `removeWorkflowAction(input)`. Each
  wraps the corresponding tRPC mutation, revalidates the page route,
  returns `{ ok, error? }`.
- One new affordance on the board header (server component already
  rendering the breadcrumb): a `Settings` link visible only to admins.

### Tests required

- **Unit (service):** `listAddableShareTargets` excludes
  sourceGroupId, excludes active workflow targets, includes
  soft-deleted target rows again, orders by displayName.
- **Integration (router):** non-admin → throws TRPCError (forbidden);
  group-admin / sysadmin → returns the list.
- **Component:** page renders allowed + addable lists; server-action
  invocation contract for add/remove (mock the actions).

### Do NOT touch

- The picker on `/board/<slug>/<ticketId>` — already shipped, drives
  off the same `GroupShareWorkflow` table.
- The seed (`scripts/seed.ts`) — demo allow-list rows already live.

### Out of scope for this BU

- An admin search-by-name when there are >50 groups; deferred.
- Bulk add / bulk remove. Single-row mutations only.
- Surfacing inbound invitations ("Group X has added you as a target")
  — deferred.
- Showing allow-list on the read-only board view to non-admins.

---

## Permission model

| Action | Member of source group | Group admin of source | System admin |
|---|---|---|---|
| View `/board/<slug>/settings` | — | ✓ | ✓ |
| Add allow-list row | — | ✓ | ✓ |
| Remove allow-list row | — | ✓ | ✓ |

Non-admins who navigate to the URL → redirected to `/board/<slug>`.

---

## Tier-1 — settled (carry-forward decisions)

- Path is `/board/<groupSlug>/settings` (per Q1 recommendation in
  v0.4 brief).
- Picker is single-target; multi-add and search are deferred.
- Same-group / already-listed targets filtered out server-side.

---

## Open questions

None blocking the build. Future considerations:

- Where else might group settings live? (Today the page only has the
  share allow-list; future surfaces may add column config, member
  management, etc.)
- Should non-admin members see a **read-only** view of the allow-list
  for transparency? (Currently no — admin-only.)

---

## Definition of done

- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean.
- [ ] Group admin can add + remove workflow targets at
      `/board/<slug>/settings`.
- [ ] Non-admin members redirected to `/board/<slug>`.
- [ ] Picker on `/board/<slug>/<ticketId>` reflects changes
      immediately (revalidatePath fires on add/remove).
- [ ] At least one Writer pilot uses this page to set up Writers'
      allow-list end-to-end without intervention.

---

## Context

- **Parent brief**: `docs/build/session-briefs/bu-coordination-board.md`
  (Q1 in "Open questions remaining").
- **Atom 5e (the picker)**: shipped in #254 (`v0.2.147`).
- **Bug fix on placement**: shipped in #275 (`v0.2.151`).
- **Seed populating demo allow-list**: shipped in #274 (`v0.2.150`).
- **Scenario**: SCN-33 (Sharon shares to IT) — needs this BU to
  exercise the path on real groups.
