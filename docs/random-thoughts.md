# Random Thought Log

_A capture-and-investigate stream for ideas as they occur. Lightweight by design — anything substantive graduates to a scenario, parking-lot entry, or session brief via promotion._

---

## How this works

- **Capture.** Any user message starting with `RT:` becomes a new entry here, auto-numbered `RT-NNN`, with today's date.
- **Investigate.** When an entry is captured, a background agent reads the codebase, scenarios, decision log, and parking lot, then appends findings under the entry: clarifying questions, overlap with existing work, an implementation sketch, and a promotion suggestion.
- **Promote.** Typing `RT-promote: RT-NNN` moves the thought to its proper home (a scenario, a parking-lot entry, or a session brief). The entry stays here, marked with its destination so the trail is preserved.
- **Reject / park.** Typing `RT-reject: RT-NNN <reason>` marks the thought as not-going-anywhere; the entry stays for posterity.

Entries auto-commit direct to `main` per the documented exception in CLAUDE.md — this is a personal thought stream, not engineering code, and PR-per-thought would be too heavy for the cadence.

---

## Entry format

Each entry follows this shape (the agent fills in everything below `**Status:**`):

```markdown
## RT-NNN — YYYY-MM-DD

**Thought:** <verbatim user thought, RT: prefix stripped>

**Status:** new (awaiting agent investigation)

### Agent investigation

#### Clarifying questions

1. ...

#### Overlap with existing work

- ...

#### Implementation sketch

- ...

#### Promotion suggestion

- Recommended destination: <parking-lot | scenario | brief | reject>
- Reason: ...
```

After the agent completes, **Status** flips to `investigated · YYYY-MM-DD`.
After promotion, **Status** flips to `promoted to <destination> · YYYY-MM-DD`.
After rejection, **Status** flips to `rejected · YYYY-MM-DD — <reason>`.

---

## Index

_Most recent first. Populated as entries are added._

- RT-002 — multi-column post cards on `/feed` in responsive mode: how does sorting (newest-first) read in a grid, and does the existing chip filter strip still work above it?
- RT-001 — feed-card UX pattern: best modern practice for expand/collapse, with PRIMARY CTA + title/small image as the anchor (2-column chips on the table).

---

## Entries

## RT-001 — 2026-04-28

**Thought:** do thinking of best UX modern practices. Remeber: key thing it the PRIMARY CTA (and title/small image). we could even have 2 columns of post 'chips' - anyway: find me best pattern.

**Context:** triggered by the prior conversation thread — feed cards in `components/PostCard.tsx` currently render the full body of every post with no clamp / chevron / expand-collapse, and there's no plan for it anywhere (checked decision-log, parking-lot, scenarios, engineering-roadmap, briefs). This RT is the capture for that gap, with Paul's framing: the primary CTA + title + small image are the anchors, body is secondary, and a denser 2-column chip layout is on the table.

**Status:** investigated · 2026-04-28

### Agent investigation

**Reference-app survey (long-content cards):**

| App               | Body                                                                          | Image                                       | CTA / tap target                      |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------- |
| X / Twitter       | 4-line clamp + inline "Show more"; URL card replaces clamp when present       | Full-width hero, 16:9 / 5:4                 | Whole card; rail at bottom            |
| LinkedIn          | 3-line clamp + "...more" inline expand-in-place                               | Right-square OR full-bleed below copy       | Inline expand; reactions below        |
| Reddit            | Compact: title + 80px thumbnail, body hidden. Card: title + hero, body hidden | 80px left thumbnail OR top hero             | Title links; vote/comment rail bottom |
| Medium / Substack | Title + 2-line dek, no body                                                   | Right-square (Medium) / top hero (Substack) | Whole card                            |
| News aggregators  | Title-first, no body, micro source row                                        | Right-square 1:1, 80–96px                   | Whole card                            |

**Pattern convergence:** body is **secondary or hidden** wherever a title/image/CTA exists. Clamp 2–4 lines max. Tap-anywhere universal — chevron/"more" is a hint, not a separate target. Two-column grids only appear in image-first feeds (Pinterest), Reddit's compact toggle, or tablet/desktop breakpoints; mobile single-column dominates.

#### Clarifying questions

1. **Is the primary CTA always a link/AM action, or sometimes react/comment/RSVP?** If always link-shaped, the existing top-of-card `LinkPreviewCard` _is_ the anchor and body is pure flavour. If CTA-typed, the chip needs a typed primary slot — i.e. the parked Multi-CTA `Action[]` work.
2. **Does chip mode apply to `/feed` only, or also `/me`, request lists, vetting queues?** Feed-only is half a feature; everywhere needs a global density preference.
3. **In chip mode, hero vs linkImageUrl — which wins?** Today both render. Suggest hero → linkImage → type-keyed placeholder.
4. **Body-clamp tap behaviour — inline expand or nav to `/post/:id`?** PostCard already navs on tap (line 342); inline expand contradicts D061's global tap contract.

#### Overlap with existing work

- **D061** (global tap pattern) — tap-to-nav is the contract; chevron/inline expand needs an explicit carve-out.
- **D060 / D066-proposed + parking-lot "Multi-CTA model" (line 1195)** — primary/secondary CTA already exists in `PostCard` (lines 299–335); the parked `Action[]` future is the schema parent of this RT's render question.
- **D064 + LinkPreviewCard `size="small"`** — both existing primitives are reusable as-is for thumbnail surface; no new primitive needed.
- **design-philosophy principle 3** (no anxiety amplification) — clamp + "permission to close" align; chasing max density works against it. Argues for a floor on cards-per-screen.
- Engineering-roadmap: no row. Scenarios: no row (SCN-19 describes link-card render but not body clamp).

#### Implementation sketch

Three candidates, low-to-high ambition. All gated behind `ff_feed_density`; current card stays default until validated.

- **A — "clamp + thumbnail right" (safe).** Single-column list. Body clamped 3 lines via `-webkit-line-clamp` (already used in `LinkPreviewCard` lines 205/216). Hero/link image becomes 96px right-square (Medium / Reddit-card pattern). Primary CTA keeps top slot; tap-anywhere navs. Scope: `PostCard.tsx` layout swap (~80 lines), no new primitive, no schema.
- **B — "chip card" (Paul's framing).** 2-col CSS grid on `/feed` ≥ 480px, single-col below. Title (2-line clamp) + 64px thumb + primary-CTA pill + reaction/comment counts. Body hidden. Hides `PostShareGroup` rail (share moves to detail page). Cultural-marker posts (principle 4) need an "always full card" override — chips flatten dignity. Scope: `PostCard.tsx` refactor + new `PostChip.tsx` + FeedView grid.
- **C — density toggle (meta).** Ship A + B both, with a list ↔ chip toggle in `AppNav` persisted to localStorage. User-driven; resolves "is chip too dense?" with data. Scope: A + B + `<DensityToggle />` + context.

Reuse note: keep `LinkPreviewCard` as-is, parameterise image size; give `PostCard` a `variant: 'full' | 'compact' | 'chip'` prop rather than forking three components.

#### Promotion suggestion

- **Recommended destination:** parking-lot
- **Reason:** real and well-formed, but blocks on Q1 — if primary CTA isn't always link-shaped, the chip needs a typed CTA slot which is the parked Multi-CTA `Action[]` work. File alongside "Multi-CTA model" as its render-side sibling; promote to brief when Multi-CTA triggers, or sooner if Paul picks Candidate A as a standalone win.

---

## RT-002 — 2026-05-02

**Thought:** how would sorting work? will filtering be OK?

**Context:** triggered by the prior conversation thread — exploring multi-column post cards on `/feed` in responsive mode (recommended: 2-column at ≥920px via CSS Grid `grid-template-columns: repeat(2, minmax(0, 1fr))` + `align-items: start`, single-col on mobile). Paul's follow-up Qs: in a 2-column grid, how does the existing newest-first sort read (top-row left-then-right vs column-major), and does the existing chip filter strip (BU-feed-filter, shipped #115: All / Urgent / Happening now / Meetings / Events) still work cleanly above a 2-col grid?

**Status:** new (awaiting agent investigation)
