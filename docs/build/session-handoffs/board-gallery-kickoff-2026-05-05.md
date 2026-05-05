# Session handoff — board-gallery kickoff (2 briefs ready, nothing built)

**Date:** 2026-05-05 (afternoon discussion → briefs)
**Branch this handoff lives on:** `docs/board-gallery-briefs-20260505`
**Last commit on main:** `ae8c8d1` — `chore(prisma): seed FeatureFlag rows from the register (v0.2.97)` (#228)
**Pushed to origin:** ✅ this branch carries 2 new briefs + this handoff; merge before starting build sessions

This is a **kickoff handoff**, not a mid-build one — no code has been
written yet. The discussion that produced these briefs happened in a
single Claude Code session on 2026-05-05; this doc captures the agreed
shape so any next session (Paul's local CC, a parallel cloud session,
or a fresh terminal next week) can pick up cleanly.

The next session reads this handoff **and** the relevant brief.

---

## What the parallel session is doing

Replacing the current `/board` text-list picker (shipped in PR-4c,
`v0.2.93`) with a snapshot gallery, gated on group identity infra
(coloured badges, kind glyphs) that doesn't exist yet. So the work
splits into two BUs that **must ship in order**:

| Order | BU | Brief | Why this order |
| --- | --- | --- | --- |
| 1️⃣ | **bu-group-identity** | [`docs/build/session-briefs/bu-group-identity.md`](../session-briefs/bu-group-identity.md) | Substrate. `<GroupBadge />` + schema + tokens + glyph register update. Mounts in `/board` (current picker) and feed bylines. |
| 2️⃣ | **bu-board-gallery** | [`docs/build/session-briefs/bu-board-gallery.md`](../session-briefs/bu-board-gallery.md) | Consumer. Snapshot gallery on `/board`. Consumes `<GroupBadge size="md" />`. **Do not start until #1 is on `main`.** |

Both briefs are at `status: ready` with all decisions locked
(2026-05-05). No further user input needed before build — the briefs
flag their open questions inline; the build session surfaces them if
they bite.

## How to spin up the parallel coding session

From a fresh terminal (or another machine):

```bash
cd /Users/paulwander/projects/gps-action
git fetch origin
# Wait for this PR to merge to main, then:
git worktree add .claude/worktrees/group-identity -b feat/group-identity-20260506 origin/main
cd .claude/worktrees/group-identity
npm install      # each worktree gets its own node_modules
git branch --show-current && git rev-parse --show-toplevel  # verify
# Now: open Claude Code in this worktree and feed it the brief
```

The parallel session's first prompt is:

> Read `docs/build/session-briefs/bu-group-identity.md` and the
> kickoff handoff at
> `docs/build/session-handoffs/board-gallery-kickoff-2026-05-05.md`.
> Build the BU exactly as the brief specifies. Surface only the open
> questions the brief flagged.

When `bu-group-identity` ships and is merged, repeat with
`feat/board-gallery-<YYYYMMDD>` and `bu-board-gallery.md`.

## What's in this PR (this handoff's PR)

- `docs/build/session-briefs/bu-group-identity.md` (new, status: ready)
- `docs/build/session-briefs/bu-board-gallery.md` (new, status: ready)
- This handoff doc
- `package.json` PATCH bump (CI requirement)

No code changes. Doc-only PR.

## Decisions locked in the discussion

These came out of the 2026-05-05 conversation; they're the answers to
the "open questions" round at the bottom of the discussion. The
briefs already encode them — listing here for traceability:

1. **Snapshot store:** new `BoardSnapshot` table, lazy-cached,
   write-bumped, 15min quiet-time read threshold (configurable via
   `board_snapshot_quiet_minutes` SystemSetting).
2. **Tile layout:** Option A — whole-tile link, read-only column
   strip with counts, no card-title previews. (Option B card-title
   previews deferred to a follow-on BU if usage justifies.)
3. **Group identity ships as its own BU first**, before
   board-gallery consumes it.
4. **Palette:** ~12 curated accent colours, auto-assigned at group
   create from a least-recently-used rotation, admin can re-pick
   from palette. No freeform hex.
5. **Badge:** initials + corner kind-glyph at sizes ≥ sm;
   initials-only at xs. Five new lucide kind glyphs added to register
   in the same commit they ship (per global rule).
6. **Sort defaults:** `Recent activity` (default), `A→Z`
   secondary. `My involvement` deferred.
7. **Filter chips:** `Mine` (default) + by `kind`. No "all
   accessible" until network-public boards have a path.

## Things to double-check at build time (not blockers)

- Confirm 5 lucide kind-glyph picks against the current register in
  `docs/product/design-philosophy.md` before locking — one concept =
  one glyph. (`map-pin` may already be claimed by Region, etc.)
- Confirm `logoUrl` fallback policy when building the badge —
  brief assumes logo wins at sizes ≥ md, with initials at xs/sm.
  Counter-arg: always-initials. Surface to Paul if the visual feels
  wrong in build.
- The exact list of kanban mutations needing `bumpLastWrite` — grep
  for tRPC procedures touching `BoardCard`/`BoardColumn`. Missing
  one means stale snapshots for that path forever.

## Anti-patterns to avoid

- ❌ Don't try to build both BUs in one session. They're explicitly
  sequenced — the gallery needs the identity infra on `main` first.
- ❌ Don't skip the ADR for `bu-group-identity` (`Group.colourKey`
  is a schema change; CLAUDE.md is binding on this).
- ❌ Don't propagate `<GroupBadge />` into surfaces beyond the two
  the brief calls out. Each future surface migrates in its own BU.
- ❌ Don't expand the snapshot payload to include card titles in v1
  — that's the Option B deferral and changes the access model.

---

**TL;DR for next session:** read the relevant brief, build it,
surface only what the brief flagged. Both briefs are self-contained;
this handoff is for context.
