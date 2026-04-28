# Handoff — bu-link-first-composer Slice 1 (2026-04-28)

## TL;DR

The foundation, validation, and compose-page prefill for **bu-link-first-composer
Slice 1** are landed on the branch and pushed to origin. **What remains is the
FAB UI work**: the split FAB (`+` / `📋`), the `IntentFabStarter` bottom-sheet
card, and the shared paste handler — plus their tests and a smoke pass.

The brief, scenarios, helper, validation, and composer plumbing have all been
written and tested. Next session picks up component work only.

## Branch and worktree

- **Branch:** `feat/bu-link-first-composer`
- **Tracking:** `origin/feat/bu-link-first-composer` (pushed and current)
- **Worktree path:** `/Users/paulwander/projects/gps-action/.claude/worktrees/link-first-composer/`
- **Main at branch point:** `181134f` (after #42 eslint-config-next 16 merge); main has not moved further as of handoff
- **Branch version:** `0.2.2` (one PATCH ahead of main's `0.2.1` from #42)

**Operate in the worktree.** Per CLAUDE.md "Session hygiene" and the memory
entry "Worktree per session is mandatory," _do not_ work on this branch from
the shared root checkout. A parallel session reset HEAD on the shared checkout
mid-build during this session and wiped uncommitted state — the recovery
involved spelunking through stashes. The worktree shields you from that.

To resume:

```sh
cd /Users/paulwander/projects/gps-action/.claude/worktrees/link-first-composer
git pull --ff-only
git branch --show-current   # should print: feat/bu-link-first-composer
npm install                 # the worktree has its own node_modules
npx prisma generate         # so the local Prisma client matches main's schema
```

Confirm `package.json` shows `"version": "0.2.2"` and `"psl": "^1.15.0"` in
deps before continuing.

## What's been built (3 commits, all on origin)

| Commit | Files | What it does |
|---|---|---|
| **`c852b7d`** | `docs/build/session-briefs/bu-link-first-composer.md` (new), `shared/url-detect.ts` (new), `shared/types/psl.d.ts` (new), `tests/unit/url-detect.test.ts` (new), `docs/product/scenarios.md` (modified — SCN-24, SCN-25), `app/compose/actions.ts` (modified — diagnostic console.error), `package.json`/`package-lock.json` (psl dep + version 0.2.2), `docs/build/bu-sequence.md` (regenerated) | Foundation: `normalizeUrl()` helper with PSL-backed TLD validation, 35 table-driven unit tests, brief catalogues split-FAB shape and out-of-scope work, two scenarios written against the split-FAB UX |
| **`72e41f3`** | `shared/validation/post.ts` | `httpUrlSchema` and `activistMailerUrlSchema` now run inputs through `normalizeUrl()` via `.transform()` before the existing URL-shape refinement; members can type `www.example.com` or `example.co.uk` and it gets normalized to `https://...` server-side. Order matters: `.string().transform(fn).refine(fn).optional()` — earlier `.preprocess()` widened input to `unknown` and broke caller type inference; switched to `.transform()` because it preserves input typing |
| **`2d13757`** | `app/compose/page.tsx`, `components/PostForm.tsx`, `shared/validation/post.ts` (small) | Compose page reads `?linkUrl=` and `?title=` query params; when no explicit `?intent=` is set, defaults intent to `link_share` (URL prefill) or `thought` (text prefill). PostForm accepts `prefilledLinkUrl` / `prefilledTitle` props wired to `defaultValue` on the title and linkUrl inputs. Share-link section auto-opens when `prefilledLinkUrl` is present |

`524 / 524` tests pass on this branch as of handoff. Typecheck and lint are
both clean (lint shows pre-existing warnings only).

## What you can verify works (no FAB UI required)

Boot the dev server in the worktree:

```sh
npm run dev   # localhost:3001
```

(Note: `next dev -p 3001` per `package.json` scripts. If port collides with
the parallel session's main checkout, change with `next dev -p 3002` ad-hoc.)

Then:

1. **Compose-page prefill via URL params** — visit
   `http://localhost:3001/compose?linkUrl=https://www.theguardian.com/article&title=Worth%20reading`.
   Form should render with the link-share section expanded, linkUrl prefilled,
   title prefilled, intent banner showing "Share a link," kind chip set to
   `link_share`. Body field empty for the user.

2. **Bare-hostname URL accepted in linkUrl** — start a new compose, paste
   `www.example.com` into the linkUrl field, fill title + body, submit.
   Should accept (was previously rejected for missing protocol). Server
   normalizes to `https://www.example.com` before write.

3. **Text-prefill defaults to thought** — visit
   `http://localhost:3001/compose?title=Park%20Royal%20walkout%20tonight`.
   Form opens with title prefilled, intent showing "Just a thought," kind
   chip `thought`, link-share section closed.

4. **Existing flow unaffected** — the existing `?intent=...` flows still
   work. Test `/compose?intent=tick_or_cross` (BU-tick-or-cross regression
   check) — segmented ✅/❌ control should appear, etc.

## What remains for Slice 1

Three new files plus a small modification, plus tests. Brief is the source
of truth (`docs/build/session-briefs/bu-link-first-composer.md`); the
relevant section is "Build in this session" → "Split-FAB + paste handlers."

### File 1 — `components/IntentFabStarter.tsx` (new)

Bottom-sheet starter card. Mobile-first, inflates to centred modal at
`min-width: 768px`. Closes on backdrop tap or Esc.

**Props:**

```ts
interface IntentFabStarterProps {
  open: boolean;
  onClose: () => void;
  onContinue: (payload: { kind: 'url' | 'text'; value: string }) => void;
  onPickKind: () => void;   // opens the existing KindPickerSheet
}
```

**Inside the panel:**

- multi-line `<textarea>` (3 visible rows) with placeholder `"Paste a link or start typing…"`. `data-testid="fab-starter-input"`.
- below the input: a small `📋 Paste` button (`data-testid="fab-starter-paste"`). On click, calls `IntentFabPasteHandler.readClipboard()` (see File 3) and fills the input. On clipboard-permission rejection, shows an inline note `"We couldn't read your clipboard — paste below or type."` (no popup, no shake).
- a hint line below the input that updates live as the user types, using `normalizeUrl()`:
  - empty → no hint
  - URL detected → `"Looks like a link — we'll prefill the share."`
  - text → `"We'll start a post with this as the title."`
- primary `Continue` button (`data-testid="fab-starter-continue"`). Disabled when input is empty. On click: run `normalizeUrl(input)`, call `onContinue({ kind, value })` with the result.
- secondary `Pick a kind instead →` link (`data-testid="fab-starter-pick-kind"`). On click: calls `onPickKind()`.

**Style:** existing token vars only (`var(--colour-surface)`, `var(--space-N)`,
etc). No new CSS files. Match the existing `KindPickerSheet.tsx` for visual
register — it's the sibling sheet and they should feel like the same family.

### File 2 — `components/IntentFabPasteHandler.ts` (new)

Pure module — no React. Single chokepoint for the clipboard-read + normalize +
navigate logic so the FAB-paste-button and the starter-card-paste-button
behave identically.

**Exports:**

```ts
export async function readClipboardAndContinue(
  router: { push: (href: string) => void },
): Promise<'success' | 'empty' | 'denied' | 'unsupported'>;

// Reads navigator.clipboard.readText(), runs normalizeUrl, navigates
// router.push('/compose?linkUrl=...' | '?title=...'). Returns the outcome
// so callers can render an inline note on failure.

export function buildComposeHref(payload: { kind: 'url' | 'text'; value: string }): string;
// Pure helper; useful for the starter-card Continue path too.
```

`buildComposeHref` URL-encodes the value with `encodeURIComponent` and
clamps title to 200 chars (matches the server-side cap in
`app/compose/page.tsx`).

### File 3 — `components/IntentFab.tsx` (modify)

Replace single button with a split-button container. Two `<button>` elements
inside one rounded pill, separated by a 1px divider line.

**Layout:**

- Total pill: ~120px wide, 56px tall (was 56×56). Stays bottom-right fixed.
- Left button (~70%): `aria-label="Create a post"`, `data-testid="intent-fab-button-primary"`. Renders a `<Plus />` icon. On click: `setStarterOpen(true)`.
- Right button (~30%): `aria-label="Paste from clipboard"`, `data-testid="intent-fab-button-paste"`. Renders a clipboard glyph (lucide `<Clipboard />` or `<ClipboardPaste />`). On click: calls `readClipboardAndContinue(router)` from File 2; if it returns `'empty'` / `'denied'` / `'unsupported'`, falls back to `setStarterOpen(true)` so the member can paste manually.
- Divider: `1px` solid `color-mix(in srgb, var(--colour-primary-contrast) 25%, transparent)`.

Both buttons must meet 44×44px tap-target minimum. The pill expands the
overall footprint but each half is still independently tappable.

Render `<IntentFabStarter />` and `<KindPickerSheet />` siblings. The
starter's `onPickKind` prop closes the starter and opens the picker.

### Tests

- **`tests/unit/intent-fab-starter.test.tsx`** (new) — render starter, simulate paste of `www.example.com`, click Continue, assert `onContinue` called with `{ kind: 'url', value: 'https://www.example.com' }`. Repeat with text input. Mock `navigator.clipboard.readText` resolving `'www.example.com'`, click `📋 Paste` button, assert input fills.
- **`tests/unit/intent-fab.test.tsx`** (new) — render FAB, assert two distinct tap targets with two `data-testid`s and two `aria-label`s. Click primary button, assert starter opens. Mock clipboard returning a URL, click paste button, assert `router.push` called with the right `/compose?linkUrl=...` URL.
- **`tests/integration/compose-prefill.test.ts`** (new, optional) — already partly verifiable manually; an integration test would assert the page renders the form with the right defaults given the query params. Lower priority — manual smoke covers it for the demo.

### Smoke test (manual)

Once the FAB ships, walk through both scenarios:

- **SCN-24 path:** Copy a Guardian URL to clipboard. Tap `📋` half of the FAB. Should land on `/compose` with the URL in the linkUrl field, link-share section open, kind chip = `link_share`. Submit a minimal post and verify it lands in `/feed` with the link preview card.
- **SCN-25 path:** Tap `+` half. Starter card opens. Type "Saw something at the gate this morning" and tap Continue. Should land on `/compose` with title prefilled, kind = `thought`. Submit, verify in feed.

Also re-verify (regression):

- Tap `+` half, then "Pick a kind instead →" — existing 9-tile picker opens.
- `/compose?intent=tick_or_cross` direct URL — segmented ✅/❌ control still appears, end-to-end flow still works.
- AM URL detection on a link-share post — paste an `activistmailer.com/...` URL into linkUrl, post renders with "Send email →" CTA.

## Known issues / open questions before next session

1. **Long-form text prefill is silently truncated to 200 chars.** No banner yet ("Pasted text was too long — we kept the first 200 characters"). Brief mentions this; banner is part of File 1's scope but I haven't drawn it in detail. Pick a quiet placement (above the title field maybe).

2. **Clipboard read on iOS Safari may silently return empty.** Fallback (open starter card) handles this gracefully but worth testing on real iOS during the smoke pass. The brief notes this.

3. **The diagnostic `console.error` in `app/compose/actions.ts`** is on the branch deliberately — it surfaces real tRPC errors during smoke testing. If you want it gone before PR, drop it; if you want it to live in main, leave it. (My read: it's useful for everyone, leave it.)

4. **psl bundle weight.** The brief flags this as a "verify on first build" item. `psl` adds ~80 KB minified to whatever bundle imports it. `shared/url-detect.ts` is currently used in `shared/validation/post.ts` (server-side) and will be used in `IntentFabStarter` (client-side). If client bundle balloons, we either ship a slimmer detector for the client or do detection server-side via a quick API ping. Slice 1 ships client-side; flag in post-merge note if it becomes a problem.

5. **The `bu-` lowercase branch naming** — `feat/bu-link-first-composer` uses lowercase `bu-` per memory's brief-status gate convention (lowercase = stub, gate skips). The brief's `status: planned`. When you ship the PR, flip to `status: shipped` + `shipped_in: "#NNN"` AND change the PR title to use uppercase `BU-` so the gate fires. Run `npm run trackers` to refresh `bu-sequence.md` AUTOGEN.

6. **Date suffix on branch name** — memory says branches should have `-YYYYMMDD` suffix to avoid clashes. This branch doesn't have one (predates the convention). Leave it; rename mid-flight is churn. Apply the convention to the next BU.

## What "done" looks like

The brief's "Definition of done" section is the canonical checklist. Briefly:

- All three new files written, modifications to `IntentFab.tsx` complete
- New unit tests added and passing
- `npm run typecheck && npm run lint && npm test` all clean
- Manual smoke pass covering SCN-24, SCN-25, and the regression list above
- PR opened with title `feat(composer): BU-link-first-composer — split FAB + paste-and-go (v0.2.X)` (or whatever PATCH lands)
- Brief front-matter flipped to `status: shipped`, `shipped_in: "#NNN"`
- `npm run trackers` run to refresh `bu-sequence.md`
- Version bump in `package.json` to one ahead of main at PR time

Three commits already on the branch take care of the foundation half. You're
inheriting them clean — no rebase, no pending merges.

## Pointers

- Brief: `docs/build/session-briefs/bu-link-first-composer.md`
- Helper: `shared/url-detect.ts` (with 35 unit tests in `tests/unit/url-detect.test.ts`)
- Existing FAB: `components/IntentFab.tsx` (56 lines — small file, clean swap)
- Existing picker: `components/KindPickerSheet.tsx` (the sibling sheet — use as visual reference for IntentFabStarter)
- Existing form: `components/PostForm.tsx` (1,048 lines — already wired with prefill props, no further changes needed)
- Compose page: `app/compose/page.tsx` (already reads the new query params)
- Validation: `shared/validation/post.ts` (already runs `normalizeUrl` on URL fields)
