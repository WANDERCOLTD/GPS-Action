---
slug: bu-spread-polish-responsive
status: ready
phase: 2
priority: medium
note: "Stub 2026-05-15. Post-merge polish on bu-network-spread-gallery (#369). Three asks bundled: (1) page-width unification via shared top-chrome container, (2) generalise PostShareGroup to Shareable + drop share strip on spread detail sheet, (3) responsive pass across phone/tablet/desktop viewports. No share counter at v1 (just buttons)."
---

# SESSION BRIEF · bu-spread-polish-responsive — gallery polish + share strip + responsive pass

_Stub · Created: 2026-05-15. Follow-up to bu-network-spread-gallery
(#369) — three connected post-ship polish items._

---

## Why

Three asks surfaced after #369 merged:

1. **Page-width inconsistency** — `/network` is 720px (reading column);
   `/network/spread` is 1200px (grid). Switching modes causes a
   visible chrome jolt as the layout reflows.
2. **No share affordance on the spread detail sheet** — a member who
   opens a tile to read the spread trace has no way to push that URL
   onward. The existing `PostShareGroup` is post-only.
3. **Responsive coverage is uneven** — recent gallery work was
   eye-checked at desktop only. Phone landscape, iPad, and small
   phones need verification.

## Decisions locked (2026-05-15)

1. **Page widths: Option C** — keep different body widths (list 720,
   grid 1200), but unify the **top chrome** (PageHeader + filter rows)
   at a shared max-width so the eye doesn't track the chrome jumping
   between modes. Body content is the only thing that changes width.
2. **Share refactor: Option A (generalise)** — refactor
   `PostShareGroup` to take a `Shareable` interface
   (`{ url, title, description?, imageUrl?, source }`). One
   component used in both Post and gallery surfaces. Future button
   changes apply everywhere automatically.
3. **Share counter: deferred to v2** — gallery shares fire
   `ShareEvent` rows so analytics work, but no visible per-tile
   counter at v1. PostShareCounter stays Post-only.
4. **ShareEvent target type: extend** — `ShareTargetType` enum gains
   a new `LinkPreview` value. Gallery share events write
   `targetType: 'LinkPreview', targetId: linkPreview.id`. Per
   ADR-0018 the polymorphism is already in place.
5. **Responsive verification: eyeball, not Playwright** — manual
   browser checks at 4 viewports: 390 (iPhone portrait), 700
   (iPhone landscape), 768 (iPad portrait), 1280 (desktop).
   Playwright deferred until the next BU that needs it.

## Build steps

1. **Brief stub committed first** so the BU is traceable.
2. **Page-chrome shell** — extract a `<NetworkPageShell>` (or
   tighten the PageHeader wrapper) that holds the top chrome at
   1200px max. Both `/network` and `/network/spread` use it; only
   the body content section differs.
3. **`Shareable` interface + PostShareGroup refactor** —
   `shared/share.ts`: `Shareable` type. PostShareGroup props become
   `{ shareable, variant }`. Migrate existing call sites
   (`PostCard`, post detail). `postToShareable(post)` helper.
4. **ShareEvent extension** — add `LinkPreview` to
   `ShareTargetType` Prisma enum. Migration. Service supports
   recording shares against a LinkPreview row by id.
5. **Spread detail sheet share strip** — drop `<PostShareGroup
   shareable={tileToShareable(tile)} variant="detail-bar" />`
   below the spread-trace timeline, above the Open-link CTA.
6. **Responsive pass** — walk the surfaces at 4 viewports. Fix as
   we find. Likely-known issues:
   - Tile-marker crowding on 125px tiles (3-col mobile)
   - Filter-row stacking (3 rows) on phones
   - Detail-sheet drawer in phone landscape (~700×400) — full-screen
     or side panel
7. **Tests + lint/typecheck + full suite green**
8. **Version bump + commit + PR + auto-merge**

## Acceptance criteria

- [x] `/network` and `/network/spread` headers visually align at all
      desktop widths (no chrome jolt on mode switch).
- [x] `PostShareGroup` accepts a `Shareable`; existing Post call
      sites unchanged in behaviour.
- [x] Share buttons appear on the spread detail sheet below the
      spread-trace timeline.
- [x] Clicking a share button on the gallery records a
      `ShareEvent` with `targetType = 'LinkPreview'`.
- [x] Surfaces render correctly at 390 / 700 / 768 / 1280 viewports
      — verified by Paul (eyeball pass).
- [x] `pnpm typecheck && pnpm lint && pnpm test` all green.

## What's NOT in scope

- Visible per-tile share counter (v2).
- Playwright viewport screenshot regression suite (v2).
- Refactoring the gallery grid's responsive breakpoints beyond what
  the eyeball pass surfaces.
- Cross-surface unification of filter-chip components (separate BU
  if it shows up as duplication during the share refactor).
