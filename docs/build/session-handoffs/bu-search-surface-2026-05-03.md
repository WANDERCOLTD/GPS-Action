# Session handoff — bu-search-surface (mid-build, after PR B)

**Date:** 2026-05-03 (morning session)
**Branch:** _none in flight_ — handoff written on `docs/handoff-bu-search-surface-20260503`; the next session creates a fresh `feat/search-surface-shell-YYYYMMDD` branch for PR C.
**Last commit on main:** `99d445b` — `feat(search): server-side search service + tRPC router (PR B) (v0.2.63)` (#184)
**Pushed to origin:** ✅ yes (this handoff doc is the only thing on its branch)

The next session reads this handoff **and** the brief at
`docs/build/session-briefs/bu-search-surface.md` (v0.5, status: ready).
Both are needed for context. The brief is the canonical scope; this
doc is the in-flight state.

---

## Current state

### What's shipped on main (the precursors + halves of the BU)

| PR   | Merge      | What it landed                                                                                                           |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| #178 | 2026-05-02 | Brief decisions promoted to **D078** (9 sub-decisions) + **ADR-0004** (Proposed)                                         |
| #181 | 2026-05-03 | **Shared `getPostVisibilityFilter`** helper extracted from inline `post.ts` predicates (precursor — search consumes it)  |
| #182 | 2026-05-03 | **Data demoted from AppNav** → Settings page (frees the nav slot for the magnifier)                                      |
| #183 | 2026-05-03 | **pg_trgm extension + 4 GIN indexes** (`Post.title`/`body`, `User.displayName`, `Region.displayName`); ADR-0004 Accepted |
| #184 | 2026-05-03 | **`search.query` tRPC procedure** + `searchAll` service + 18 tests; partner-orgs always returns `[]` (D078 §9)           |

### What's NOT yet built (the brief's "Build in this session" minus what's shipped)

**PR C — AppNav magnifier + `/search` route shell** (next, ~1.5 hrs)

- ❌ Magnifier icon in `components/AppNav.tsx`, right of the nav links
  (`aria-label="Search"`, `data-testid="appnav-search-trigger"`).
  Tapping navigates to `/search`. Re-uses the lucide `Search` glyph
  (already in the glyph register at `docs/product/design-philosophy.md`).
- ❌ New route `app/search/page.tsx`:
  - Sticky header: back arrow (`ChevronLeft`), "Search" title,
    `HeaderRefreshButton` (re-used).
  - Autofocused `<input type="search">` with `inputmode="search"`,
    `enterKeyHint="search"`, `autoComplete="off"`.
  - Optional removable scope chip below the input (auto-populated
    from referring filter, e.g. `× Urgent`, via URL query string).
    Tap-X widens to app-wide.
  - Empty-state shell only — no result rendering yet (that's PR D).
    Show "Recently viewed" placeholder + "Your regions" placeholder.
- ❌ Honest empty-results copy: "Nothing matching that yet. Try a
  region name or a person." Not "No results found."
- ❌ AppNav test updates (the BU-icon-strips test set; current
  `app-nav.test.tsx` will need a new tooltip/link assertion for the
  magnifier).
- ❌ Glyph register update: promote `search` and `chevron-left` from
  "Locked, not yet shipped" into "In-content (shipped)" in
  `docs/product/design-philosophy.md`.

**PR D — typeahead results + telemetry + localStorage + brief flip** (after C, ~2 hrs)

- ❌ Typeahead grouped result rendering on `/search` (Posts → People
  → Regions → Partner orgs; cap 3 each; "See all N" link).
- ❌ Full-results page `/search?q=...&type=...` — paginated per
  group.
- ❌ Recently-viewed via `localStorage` (last 5 posts member opened).
  Wrap reads in `useEffect` to avoid SSR hydration mismatch.
- ❌ 4 telemetry events: `search_opened`, `search_query_submitted`
  (q_length, has_scope_chip — **never raw query string**, PII rule),
  `search_result_clicked`, `search_see_all_clicked`. Add to
  `docs/product/analytics-events.md`.
- ❌ Update `bu-search-surface.md` brief: `status: shipped`,
  `shipped_in: "#<PR>"`. Run `npm run trackers` to refresh
  `bu-sequence.md` AUTOGEN regions.

---

## CRITICAL: Pre-steps for the next session

1. **Pull main first** (precedent + memory `feedback_pull_before_dev.md`):

   ```bash
   git fetch origin && git pull --ff-only
   ```

   At handoff time main is at `99d445b` (v0.2.63). Other PRs may have
   landed since — pull resolves before branching.

2. **Create the worktree** per CLAUDE.md session-hygiene:

   ```bash
   git worktree add .claude/worktrees/search-shell \
     -b feat/search-surface-shell-20260503 origin/main
   cd .claude/worktrees/search-shell
   git branch --show-current && git rev-parse --show-toplevel
   ```

3. **Run prisma generate before typecheck** — Prisma client types
   sometimes go stale across worktree creation:

   ```bash
   npx prisma generate
   ```

4. **No ADR / no schema change in PR C** — UI only. PR A already
   shipped the schema work.

---

## Suggested next-session sequence (PR C)

Each step a separate commit per CLAUDE.md "commit per logical chunk".

1. **Magnifier in `AppNav`** — single edit + test update. Verify
   width on iPhone Mini (360px) — 4 tabs + magnifier + refresh
   should fit.
2. **`/search` route shell** — new file `app/search/page.tsx`.
   Sticky header, autofocused input, empty-state placeholders.
3. **Scope chip** — read `?filter=` from URL on /search page; render
   removable `× Urgent` (or whichever filter). Tap removes the chip
   and updates the URL.
4. **Glyph register update** — promote `search` and `chevron-left`
   to "shipped" rows in `docs/product/design-philosophy.md`. (Memory
   `feedback_glyph_register.md`: same-commit rule.)
5. **Acceptance pass** —
   `npm run typecheck && npm run lint && npm test && npm run trace:check`.
   Bump `package.json` PATCH. Commit + push + open PR. Title prefix
   `feat(search):`. Use lowercase `bu-search-surface` to skip the
   brief-status gate (decisions already in D078; brief flip is in PR
   D, not C).

Then **after PR C merges**, repeat the worktree dance for PR D
(typeahead + telemetry + brief flip).

---

## Known gotchas / risks (carry from this session)

- **Trace matrix drift.** Adding any new test file or `@build-unit`
  tag re-shapes `docs/architecture/traceability-matrix.md`. CI's
  `check` job runs `npm run trace:check` which fails if it's stale.
  Run `npm run trace:matrix` and commit the diff before pushing
  (or after the first CI fail; either way, expect to re-push once).
- **Prettier on markdown tables.** New tables in `*.md` often need
  `npx prettier --write` after first commit; `lint-staged`'s
  pre-commit hook handles _your_ added files but a re-run is
  occasionally needed. CI's `check` job catches it.
- **`brief-status` CI gate is case-sensitive on `BU-`.** Use
  lowercase `bu-search-surface` in commit subjects + PR titles for
  PR C (no ship-flip yet). Use uppercase `BU-` in PR D where the
  brief flips to `status: shipped`.
- **Auto-merge can silently fall behind.** If `gh pr merge --auto`
  is queued and main moves forward, a re-bump may be required. Watch
  the version-bump check for "0.2.NN → 0.2.NN" stalemate; bump
  again, force-push.
- **AppNav test assertions** are tight (NAV_LINKS array, IconChipTooltip
  loop). Adding the magnifier requires editing both arrays in
  `tests/unit/app-nav.test.tsx`. The magnifier may or may not be a
  Link — if it's a Link to `/search`, it's a "tab"; if it's a button
  triggering a route push, the test pattern differs.
- **6-icon AppNav layout** on iPhone Mini (360px) was the original
  worry that justified the data-into-settings demotion. Now 4 tabs +
  magnifier + refresh = 6 elements. **Measure on Mini before
  merging PR C.** If still cramped, the brief's "Glyph inventory"
  section flagged options (group-label icons are decoration; can be
  omitted in v1).
- **`localStorage` SSR.** PR D risk, not PR C. Recently-viewed reads
  must be inside `useEffect` to avoid hydration mismatch. Render
  with empty initial state.

---

## Open PRs at handoff time

None — main is clean. PRs A/B are merged. The BU is **mid-build** but
no in-flight branch.

---

## What I would have done next if context allowed

Started the PR C worktree and shipped the magnifier + `/search` route
shell as a single PR (~1.5 hrs from worktree to merge). The shell is
visually verifiable — tap the icon, see the overlay, type into the
input, see empty-state copy, tap back. No result-rendering work
required (deferred to PR D), so the PR scope is bounded.

After PR C merges, PR D is the bigger one (~2 hrs):

- Wire typeahead grouped results to `trpc.search.query`
- Build the full-results page at `/search?q=...&type=...`
- Recently-viewed via `localStorage`
- 4 telemetry events
- Flip the brief to `status: shipped` + `shipped_in: "#<PR-D>"`
- Run `npm run trackers` to refresh bu-sequence

The full BU lands in 2 PRs (C + D) over ~3.5 hrs. Both are
incremental; nothing in PR C blocks PR D.

### User notes (from handoff invocation)

> Picking up at PR C of the bu-search-surface 4-PR build sequence.
> Context: PRs A (pg_trgm migration #183), B (search service + tRPC
> router #184) shipped today. PR C is the AppNav magnifier + /search
> route shell (no result rendering yet — that's PR D). Then PR D
> wires typeahead/full-results/telemetry/localStorage and ships the
> BU.
