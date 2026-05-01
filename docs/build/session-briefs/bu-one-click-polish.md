---
slug: bu-one-click-polish
status: shipped
shipped_in: "#161"
priority: medium
phase: 2
---
# SESSION BRIEF · BU-one-click-polish — five small UX-friction removals

_Brief version: 1.0 · Author: Paul + Claude · Date: 2026-05-01_
_Priority: medium. One PR, five logical commits._

---

## Objective

Five tiny polish items, each removing friction from a common
member action. Ship together so the demo path tightens visibly.

## Scope

### 1. Dev-banner toggle (`DevBannerToggle`)

- Eye / EyeOff icon button left of `HeaderRefreshButton`.
- `localStorage` key `gps:dev-banner-visible` (`"true"` / `"false"`).
- Default hidden.
- `Cmd+Shift+U` (Ctrl+Shift+U on Win) toggles.
- Wraps the existing `LoggedInAs` strip in a client component that
  reads the flag and hides via `display: none`.
- Gated by `NODE_ENV !== 'production' || isDemoMode()`.
- testid `dev-banner-toggle`.

### 2. Seed warm comments on tick-bbc-correction post

- Three comments by Cary, Eddie, Ingrid on the
  `tick-bbc-correction` ✅ post.
- Idempotent via `seedUuid('comment', '<post-key>:c<n>')`.
- `cross-fake-petition` keeps zero comments (empty-state demo).

### 3. Inline empty-state comment input

- `PostCard` empty peek "Be the first to respond →" replaced with
  the always-rendered composer surface on the detail page.
- `CommentList`/`CommentComposer`: composer renders even when zero
  comments exist (today it sits below an empty-state paragraph).
- testid `post-comment-empty-input` for the empty-state input.

### 4. Inline reaction quick-rail

- When a post has zero reactions, render an inline rail of the
  4 most-prominent emoji (heart/strong/target/thumbsup) that
  fire reactions in one tap.
- After tap → existing optimistic add path; the rail collapses to
  the populated state via the existing `ReactionPill` rendering.
- testid `post-reaction-quickrail-<emoji-slug>` for each.

### 5. Composer auto-suggest title from body's first sentence

- Pure helper `suggestTitleFromBody(body): string` —
  trim, take up to first `.` / `!` / `?` / `\n`, max 80 chars.
- On body `onBlur` in `PostForm`, when `title` is empty AND the
  user has not edited it, populate the title with the suggestion.
- No modal, no "use this?" prompt.

## Out of scope

- Restyling banner copy, restructuring `LoggedInAs`, redesigning
  the reaction tray.
- Migrating sample comments out of `seed.ts` into a Prisma migration
  (these are demo data, not reference data).

## Tests required

- `tests/unit/dev-banner-toggle.test.tsx` — keyboard toggle +
  localStorage read/write.
- `tests/unit/suggest-title-from-body.test.ts` — pure helper.

## Definition of done

- typecheck / lint / test all green under `CI=1 TZ=UTC`.
- `package.json` bumped to `0.2.38`.
- Brief flipped to `status: shipped` / `shipped_in: "#<PR>"` and
  trackers regenerated.
