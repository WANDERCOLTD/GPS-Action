---
slug: BU-keyboard-shortcuts
status: in_progress
phase: 2
priority: medium
note: "Gmail/Linear-style two-key navigation: g+letter to jump between AppNav tabs, c to compose, / to search, ? for help overlay. No FF — additive UX, no data exposure."
---

# SESSION BRIEF · bu-keyboard-shortcuts — `g`-prefixed nav, `?` help overlay

_Author: Paul + Claude · Created: 2026-05-10_
_Type: New client-side primitive. No router/service/schema changes._

---

## Objective

Power users want keyboard navigation across the AppNav tabs without
the cost of Cmd-modifier collisions with the browser. Adopt the
Gmail / Linear / GitHub convention: press `g` then a letter to
jump. Plus three single-key shortcuts (`c` compose, `/` search,
`?` help). All bindings are inert when the user is typing in an
input, textarea, or contenteditable — no clobbering text entry.

## Scope

### Build in this session

- `shared/shortcuts.ts` (new — single registry of bindings, used by
  both the listener and the help overlay)
- `components/KeyboardShortcuts.tsx` (new — client-only listener
  mounted in the root layout when `ctx.user` exists)
- `components/ShortcutHelp.tsx` (new — modal overlay that lists
  every binding, opened by `?`)
- `app/layout.tsx` (modified — mount `<KeyboardShortcuts />` next
  to `<IntentFab />`)
- `tests/unit/keyboard-shortcuts.test.tsx` (new)
- `tests/unit/shortcut-help.test.tsx` (new)
- `package.json` (version bump, patch)

### Do NOT touch

- `components/AppNav.tsx` (visual nav, unrelated)
- Any router/service/schema (this is purely a client UX layer)
- `prisma/*` (no DB change, no flag row — additive UX, no FF)

### Out of scope this session

- Per-user preference storage (toggle on/off, remap bindings)
- Mobile/touch equivalents (shortcuts are inherently keyboard)
- Numeric shortcuts (`g 1`, `g 2`) — single-letter is more readable

## Bindings (locked)

| Keys | Destination | Notes |
|------|-------------|-------|
| `g n` | /network | gated by `network_feed` — binding still active, target may 404 if flag off |
| `g f` | /feed | always available |
| `g b` | /board | gated by `coord_board_v1` |
| `g c` | /calendar | gated by `calendar_enabled` |
| `g r` | /requests *or* /notifications | follows `coord_board_v1` |
| `g s` | /settings | always available |
| `/` | /search | focus-style — navigates to /search |
| `c` | /compose | always available |
| `?` | open ShortcutHelp overlay | Esc to close |

## Acceptance criteria

- [ ] Typing `g` then `n` within 1.5s navigates to `/network`
- [ ] Typing `g` alone resets after 1.5s — second key only counts
      as a sequence if it lands inside the window
- [ ] Single-key `c` navigates to `/compose`; `/` navigates to
      `/search`; `?` opens the help overlay
- [ ] Bindings are inert when `document.activeElement` is `INPUT`,
      `TEXTAREA`, or has `contenteditable=true`
- [ ] Modifier keys (`Cmd`, `Ctrl`, `Alt`, `Shift+letter except '?'`)
      are inert — only bare key presses trigger
- [ ] `?` (which is Shift+`/` on most layouts) opens help even
      though `/` alone goes to /search — handle as separate event
- [ ] Help overlay closes on Esc, backdrop click, or another `?`
- [ ] Listener only mounts when `ctx.user` exists (signed in)
- [ ] No console noise; no React warnings

## Tests required

- Unit (`keyboard-shortcuts.test.tsx`): each binding fires the
  expected router push; sequence resets after timeout; bindings are
  ignored inside an input
- Unit (`shortcut-help.test.tsx`): overlay renders every binding
  from the registry; Esc closes; no a11y violations on the modal

## Definition of done

- [ ] All files in "Build" list created or modified; nothing else
- [ ] `pnpm typecheck && pnpm lint && pnpm test` all pass
- [ ] Manual click-through in dev: every binding works on `/network`,
      `/feed`, `/board`, `/calendar`, `/requests`, `/settings`,
      `/search`, `/compose`. Help overlay appears on `?`.
- [ ] Status flipped to `shipped`, `shipped_in: "#NNN"` added
- [ ] `pnpm trackers` run, `bu-sequence.md` AUTOGEN refreshed
- [ ] Version bumped (PATCH)

## Open questions to surface

(Locked before starting:)

- FF gate? **No** — keyboard shortcuts are additive UX over an
  already-shipped nav. No data exposure. D036 substantial-feature
  rule is for new gated features, not keystroke layers over existing
  ones.
- Library or hand-roll? **Hand-roll** — listener is ~30 LOC. No new
  dep.
- Conflict with browser shortcuts? **None** — bare-letter shortcuts
  don't intercept any standard browser binding (browser shortcuts
  all use Cmd/Ctrl modifier).

## Context

- `components/AppNav.tsx` — the visual tab strip the bindings mirror
- `app/layout.tsx` — root layout, mount point
- Inspiration: Gmail (`g i` inbox, `c` compose), GitHub (`g p` pull
  requests, `/` search), Linear (`g i` inbox, `g p` projects)
