---
slug: bu-link-first-composer
status: planned
phase: 2
priority: high
note: "Slice 1 of the link-first composer redesign. Slice 2 (server-side og: scraper) and Slice 3 (kind inference) are separate BUs."
---

# SESSION BRIEF · bu-link-first-composer — single-input FAB + URL-or-title detection

_Brief version: 0.1 · Author: Paul (via Claude) · Date: 2026-04-28_

This brief is **Slice 1** of a multi-slice link-first composer redesign.
Slice 1 ships the entry-point UX (FAB single input, URL detection, composer
prefill) and the foundation helper (`normalizeUrl()`). Slice 2 (server-side
og:/twitter: scraper to auto-fill `linkTitle` / `linkDescription` /
`linkImageUrl` / `linkSiteName`) and Slice 3 (kind inference from
domain + og:type) are separate BUs that build on this foundation.

---

## Why this exists / why now

The current FAB flow is **kind first, content second**: tap FAB → pick kind
(9-tile picker sheet) → land on composer with empty fields. Two observations
forced a reframe:

1. **7 of 9 PostKinds are link-driven in real usage** (link_share,
   tick_or_cross, call_to_action, meeting, event are link-core;
   happening_now and outcome are usually link-bearing; only `cultural`
   and `thought` start without a URL).
2. **Pasting is the dominant action** — members move content from
   WhatsApp / Twitter / news sites into GPS Action. The current flow
   forces them to commit to a kind before they can paste, even though
   the URL itself usually disambiguates the kind.

Slice 1 inverts this: paste first, kind second (or kind-default for the
non-URL case). The kind-picker survives but moves from "front of flow"
to "easy to change inside the composer."

This BU also lays the foundation for **BU-inbound-share** (PWA Web Share
Target, ABSORBING v0.6) — the `?paste=` and `?text=` URL params Slice 1
introduces are the same params the share-target endpoint will pipe into.
One composer entry shape, two callers.

---

## Objective

Replace the IntentFab's tap-opens-sheet behaviour with a **two-affordance
FAB**: a single text input (paste or type) that auto-detects URL vs free-
form text, plus a "Pick a kind instead" escape hatch that reveals the
existing KindPickerSheet. On Continue, the composer opens with the input
prefilled — into `linkUrl` if URL, into `title` if text — and the kind
defaults to `link_share` (URL) or `thought` (text), changeable on the
composer page via a kind-chip rail.

Foundation work: a single `normalizeUrl(input)` helper in `shared/` that
returns `{ kind: 'url', url } | { kind: 'text' }`. Used at the FAB and
also applied as a normalization step to **every** URL field in the
codebase so members can type `www.example.com` or `example.co.uk` and
the system adds `https://` automatically.

Success looks like: tap FAB → paste `www.guardian.com/world/...` →
Continue → land on /compose with the link previewed (existing
LinkPreviewCard renders), kind chip set to `link_share`, title and body
empty for the user to write. Or: tap FAB → type "Park Royal walkout
tonight" → Continue → land on /compose with title prefilled, kind chip
set to `thought`, body empty.

---

## Scope

### Build in this session

**Foundation — URL normalization helper:**

- `shared/url-detect.ts` (new) — exports `normalizeUrl(input: string):
  { kind: 'url'; url: string } | { kind: 'text' }`. Uses the `psl`
  npm package for Public Suffix List-aware TLD detection. Handles
  trailing punctuation, leading/trailing whitespace, multi-line
  paste (first line is the candidate URL).
- `tests/unit/url-detect.test.ts` (new) — table-driven tests covering
  the cases in the brief's "URL detection table" below, plus edge
  cases (multi-line, trailing punctuation, IDN, IP literal, localhost).
- `package.json` (MODIFY) — add `psl` as a direct dependency
  (`^1.10.0`). Patch version bump per CI gate.

**Apply normalization to existing URL field validators:**

- `shared/validation/post.ts` (MODIFY) — `httpUrlSchema` and
  `activistMailerUrlSchema` already require valid URLs but reject bare
  hostnames. Insert a normalization preprocessing step (`z.preprocess`)
  before the existing refinements so `www.example.com` becomes
  `https://www.example.com` _before_ Zod's URL parse runs. Keep the
  `https`-only requirement for `activistMailerUrlSchema`.

**Split-FAB + paste handlers (revised after design call 2026-04-28):**

The FAB is now visually split into two tap targets that share one
visual unit:

- **Left ~70% — primary "+"** (default action) — opens the
  IntentFabStarter (single text input, paste button inside, Continue,
  "Pick a kind instead →" escape).
- **Right ~30% — secondary "📋"** (paste-and-go shortcut) — reads
  clipboard via `navigator.clipboard.readText()`, normalizes via
  `normalizeUrl()`, navigates straight to /compose with `linkUrl`
  or `title` prefilled. If the clipboard is empty or unreadable, falls
  back to opening the starter card with a small "Nothing to paste —
  type or paste below" hint.

Both tap targets ultimately route through the same prefill path on
the composer page, so the underlying logic is shared.

- `components/IntentFab.tsx` (MODIFY) — replace single button with a
  split-button container. Two `<button>` elements (left = primary,
  right = paste-and-go) inside one rounded pill, separated by a 1px
  divider. Both have explicit `aria-label` so screen readers can
  distinguish them. Both meet the 44×44px tap-target minimum (the
  composite pill is wider than the current 56px-square FAB to make
  room).
- `components/IntentFabStarter.tsx` (new) — the starter card. Props:
  `onContinue(payload: { kind: 'url' | 'text'; value: string })`,
  `onPickKind()`, `onClose()`. Inside the panel: text input, a
  "📋 Paste" button below the input that reads the clipboard and
  fills the input (handles permission rejection with a quiet "we
  couldn't read your clipboard" inline note — no popup), Continue
  button (disabled when input is empty), "Pick a kind instead →"
  link to the existing KindPickerSheet.
- `components/IntentFabPasteHandler.ts` (new) — small client-side
  module that reads the clipboard, runs `normalizeUrl()`, and
  navigates to the right composer URL. Single chokepoint for both
  the FAB-paste-button and the starter-card-paste-button so behaviour
  doesn't drift between the two surfaces.
- `app/compose/page.tsx` (MODIFY) — accept new search params
  `linkUrl` and `title`. When `linkUrl` is present, default `intent`
  to `link_share` if not otherwise set; pass through to PostForm.
  When `title` is present, default `intent` to `thought`; pass
  through. URL-decode safely; reject inputs that exceed the
  validator caps before calling PostForm (silent truncate is wrong;
  show the form prefilled with whatever fits + a small banner
  "Pasted text was too long — we kept the first 200 characters").
- `components/PostForm.tsx` (MODIFY — small) — accept new optional
  props `prefilledLinkUrl?: string` and `prefilledTitle?: string`.
  When set, initialise the form's controlled state with those values.
  The existing IntentBanner / kind-change flow already lets the user
  change kind without losing typed content, so no changes there.

**Tests:**

- `tests/unit/url-detect.test.ts` (new) — see foundation above.
- `tests/integration/compose-prefill.test.ts` (new) — visit
  `/compose?linkUrl=https://example.com/article` (mocked auth),
  assert form renders with linkUrl populated, kind chip resolved to
  `link_share`. Repeat for `/compose?title=Park%20Royal%20walkout`,
  assert title populated, kind `thought`.
- `tests/unit/intent-fab-starter.test.tsx` (new) — render
  `<IntentFabStarter />`, simulate paste of `www.example.com`, click
  Continue, assert `onContinue` called with
  `{ kind: 'url', value: 'https://www.example.com' }`. Repeat for
  text input. Smoke-test "Pick a kind instead" reveals the existing
  picker. Smoke-test the in-card "📋 Paste" button: mock
  `navigator.clipboard.readText` to resolve `'www.example.com'`,
  click the button, assert the input now contains the pasted text.
- `tests/unit/intent-fab.test.tsx` (new) — render `<IntentFab />`,
  assert two distinct tap targets render with distinct
  `data-testid` (`intent-fab-button-primary`, `intent-fab-button-
  paste`) and `aria-label` values. Click the primary button, assert
  the starter card opens. Click the paste button with a mocked
  clipboard returning a URL, assert navigation to /compose with the
  expected `linkUrl` query param.

### Deliberately out of scope

- **og: scraper** (Slice 2, future BU). The FAB-pasted URL lands in
  `linkUrl` only; existing LinkPreviewCard renders with whatever
  metadata is already available (host derivation, AM domain
  detection). No new server-side fetching in this BU.
- **Kind inference** (Slice 3, future BU). Defaults: URL → link_share,
  text → thought. User changes via the kind-chip rail on the
  composer page. No domain-based or og:type-based suggestions yet.
- **Kind-chip rail on composer page**: the existing IntentBanner
  already lets the user change kind via the KindPickerSheet from
  inside the form. Slice 1 reuses that surface; a chip-rail
  redesign of the composer page is its own follow-up if pilot
  feedback warrants it.
- **AM URL field collapse**: BU-am-link-collapse already shipped this
  pattern (paste any link, AM auto-detected at render). No changes
  to AM handling.
- **Existing tick_or_cross handoff modal**: the post-publish
  `<SendToNetworkConfirm />` flow is untouched. URL-detection at
  the FAB does not affect what happens on submit.
- **Composer page redesign** beyond accepting two new query params.
  PostForm internals stay as-is.

---

## Contracts to honour

- **Layer boundaries** — `shared/url-detect.ts` lives in `/shared` and
  must not import from any `/server`, `/components`, or `/app`
  module. The `psl` dependency is a runtime npm import, fine in
  `/shared`.
- **`shared/validation/post.ts` schema shape** unchanged externally —
  callers see the same input contract; only the preprocessing step
  is new.
- **Kind taxonomy** unchanged — no new PostKind rows. The defaults
  (`link_share` for URL, `thought` for text) reference existing
  seeded slugs.
- **Per-PR PATCH version bump** — bump `package.json` PATCH per CI
  gate. The `psl` dependency addition appears in `package-lock.json`.
- **F14 testid rule** — every interactive element added in this BU
  carries a `data-testid` (`fab-starter-input`, `fab-starter-continue`,
  `fab-starter-pick-kind`).
- **Voice/tone (CLAUDE.md)** — placeholder copy: "Paste a link or start
  typing…" not "What do you want to share?" Plain, calm, non-anxious.

---

## URL detection table (acceptance reference)

The `normalizeUrl(input)` helper MUST return these results:

| Input | Returned `kind` | Returned `url` (if `kind: 'url'`) |
|---|---|---|
| `https://example.com/path` | `url` | `https://example.com/path` |
| `http://example.com` | `url` | `http://example.com` |
| `www.example.com` | `url` | `https://www.example.com` |
| `example.co.uk/foo` | `url` | `https://example.co.uk/foo` |
| `bit.ly/abc` | `url` | `https://bit.ly/abc` |
| `Example.com.` (trailing period) | `url` | `https://Example.com` |
| `https://example.com,` (trailing comma) | `url` | `https://example.com` |
| `Park Royal walkout tonight` | `text` | — |
| `microsoft` (no TLD) | `text` | — |
| `react-router` (no TLD, hyphen) | `text` | — |
| `localhost:3000` | `text` | — (no public TLD) |
| `192.168.1.1` | `text` | — (IP literal — treat as text) |
| `https://example.com\nMore text after` | `url` | `https://example.com` (first line wins) |
| `   https://example.com   ` (whitespace) | `url` | `https://example.com` |
| empty string / whitespace only | `text` | — |

---

## Risks / known gotchas

- **Mis-detection trust**: `anthropic.com` typed as a brand mention
  becomes a URL. Slice 1 has no override toggle — the user can edit
  the prefilled `linkUrl` field on the composer page (clear it; the
  kind defaults survive but the link preview disappears). A proper
  toggle is Slice 2 work. Document this in the brief's "Friction
  found" so it surfaces in pilot.
- **`psl` package size**: ~80 KB minified. Acceptable for a shared
  helper. Verify the bundle impact in dev — if it bloats the client
  bundle, move detection server-side (action-only) and accept that
  the FAB starter's URL-vs-text decision happens after a round-trip.
  Slice 1 starts client-side; flag in the post-merge note if bundle
  jumps unacceptably.
- **Title prefill exceeds 200 chars**: pasted text longer than the
  schema cap. The compose page truncates to 200 with a banner
  ("Pasted text was too long — we kept the first 200 characters").
  Body remains empty for the user to write context.
- **Existing `?intent=` param**: composer already accepts `intent`.
  Slice 1 adds `linkUrl` and `title` as siblings. If both `intent`
  and a prefill param are passed, the explicit `intent` wins and
  the prefill is treated as content for that intent (e.g., if a
  caller passes `?intent=event&linkUrl=...`, the form opens as an
  event with the link prefilled).

---

## Definition of done

- `npm run typecheck && npm run lint && npm test` passes locally.
- `normalizeUrl()` unit tests cover every row of the URL detection
  table.
- The compose page accepts and respects the new `linkUrl` and `title`
  query params.
- The FAB tap shows the new starter card; the existing
  KindPickerSheet remains reachable via the secondary "Pick a kind
  instead →" link.
- Smoke-tested manually:
  - Paste `https://www.guardian.com/...` → Continue → composer
    opens with link preview, kind chip set to link_share.
  - Type "Park Royal walkout tonight" → Continue → composer opens
    with title prefilled, kind thought.
  - Tap "Pick a kind instead →" → existing 9-tile picker reveals.
  - Existing flow `/compose?intent=tick_or_cross` still works
    end-to-end (regression check for BU-tick-or-cross).
  - Existing AM URL detection on link-share posts still works.
- PR title uses `feat(composer): bu-link-first-composer — …` (lower-
  case `bu-` so brief-status gate is informational; flip to `BU-` and
  set `status: shipped` + `shipped_in: "#NNN"` in the brief
  front-matter on PR open).
- `package.json` PATCH version bumped (current main: 0.2.1 → 0.2.2 or
  higher depending on parallel landings).
- Two new scenarios filed in `docs/product/scenarios.md`:
  - SCN-24 — Sharon pastes a Guardian link straight into the FAB
  - SCN-25 — Eddie types a thought straight into the FAB
- The diagnostic `console.error` in `app/compose/actions.ts` (added
  during BU-tick-or-cross debugging) stays — it surfaces real errors
  in dev. Not technically scope of this BU but landed alongside.

---

## Files this BU touches (summary)

| File | Action | Notes |
|---|---|---|
| `shared/url-detect.ts` | new | Foundation helper |
| `tests/unit/url-detect.test.ts` | new | Table-driven tests |
| `shared/validation/post.ts` | modify | Add normalization preprocessor to URL schemas |
| `components/IntentFab.tsx` | modify | FAB-tap opens starter card, not picker sheet |
| `components/IntentFabStarter.tsx` | new | Starter card with single input + Continue |
| `app/compose/page.tsx` | modify | Accept `linkUrl` and `title` query params |
| `components/PostForm.tsx` | modify (small) | Accept `prefilledLinkUrl` and `prefilledTitle` props |
| `tests/unit/intent-fab-starter.test.tsx` | new | Component test |
| `tests/integration/compose-prefill.test.ts` | new | Integration test |
| `app/compose/actions.ts` | modify (already done) | Diagnostic console.error preserved |
| `package.json` | modify | Add `psl` dep, PATCH bump |
| `docs/product/scenarios.md` | modify | SCN-24, SCN-25 |

---

## Promotion notes

This BU lands as Slice 1 of three. After it ships, log Slices 2 and 3
as their own briefs:

- **bu-og-scraper** (Slice 2) — server-side og:/twitter: meta-tag
  fetcher with SSRF guard, URL cache, rate limit. Auto-populates
  `linkTitle` / `linkDescription` / `linkImageUrl` / `linkSiteName`
  on paste. Triggered for any URL the composer receives, including
  the FAB-pasted URL from this BU.

- **bu-kind-inference** (Slice 3) — domain table + og:type
  heuristics → suggest a kind chip. **Suggest, never assign.**
  Track accept/override rate as analytics. Builds on the metadata
  populated by Slice 2.

The decision to ship Slice 1 alone is intentional: it delivers most
of the felt UX win (paste-first entry) without taking on the
SSRF/cache/rate-limit infrastructure that Slice 2 needs. Pilot data
from Slice 1 shipping informs whether Slice 3 inference is worth
building or just noise.
