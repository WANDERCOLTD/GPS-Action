---
slug: bu-network-card-body-clamp
status: planned
phase: 2
priority: medium
note: "Stub. Mobile-driven: /network cards run long on phone. Body clamps to 3 lines + 'Show more' toggle when body exceeds an admin-settable threshold. Reuses the CSS clamp pattern already in components/PostCard.tsx (lines 390-414). Drags in a small admin-edit UI for SystemSetting because the threshold must be tunable without redeploy."
---

# SESSION BRIEF · bu-network-card-body-clamp — 3-line body clamp + admin-settable threshold for /network cards

_Brief version: 0.1 (stub) · Author: Paul (via Claude) · Date: 2026-05-12_

This is a **planned-status stub**. It records the agreed shape from
the 2026-05-12 design conversation. Details fleshed out when the BU
is about to start.

---

## Why this exists / why now

On phone, `/network` cards run long. WhatsApp commentary can be
multi-paragraph; the full body forces the user to scroll past the
same card for what feels like the third screenful before reaching the
next link. This contradicts the Sharon-warmth posture (permission to
close the app after acting): if scanning the list is laborious, the
user can't tell quickly when they're done.

The companion read-side BU (`bu-network-seen-state`) gives users a
NEW signal and a way to mark cards as handled, but the cards
themselves still need to be skimmable. Truncation is the missing
half.

`/feed` solved a parallel problem with a static 3-line clamp on
`PostCard`'s compact variant (`components/PostCard.tsx` lines
390-414). That code is the natural starting point — same CSS
approach, different policy (conditional + expandable).

---

## Objective

Add a body-truncation layer to `components/network-card.tsx` so that:

1. Bodies whose natural rendered height ≤ `thresholdLines` render
   in full, with no toggle.
2. Bodies whose natural rendered height > `thresholdLines` clamp to
   3 lines with a "Show more" affordance below; tapping expands in
   place to the full body and toggles to "Show less."
3. `thresholdLines` is an admin-settable `SystemSetting`. Default:
   to be locked in design pass (suggested **6**). Admin UI: a new
   field in `app/settings/page.tsx` under the existing admin section.
4. Clamp line count is **3 everywhere** (mobile + desktop, per
   2026-05-12 decision).

Success looks like: Sharon on her iPhone opens `/network`. A long
WhatsApp commentary card shows the link preview, the first 3 lines
of body, and "Show more" underneath. Three taps to "Show more" let
her read three long ones; the rest she skims past. The next time
the admin team wants to tune how aggressive the truncation is, they
change one number in `/settings` — no redeploy.

---

## Design principles

- **Three lines is the right clamp.** Matches `/feed`'s compact
  variant; matches LinkedIn / Facebook / Reddit conventions.
  Consistent across viewports — desktop card isn't constrained
  enough to justify a different number, and consistency beats local
  optimisation.
- **Threshold, not always-clamp.** A 4-line body shouldn't trigger a
  "Show more" tap for what's effectively no saving. Admin tunes
  when the toggle starts to feel worth it.
- **Reuse, don't reinvent.** `components/PostCard.tsx` already has
  the CSS approach. Lift the styling, add the conditional + toggle
  state on top.
- **In-place expansion, not navigation.** "Show more" expands the
  card; it does not navigate. The user keeps their scroll position
  and context.
- **Body only.** Title stays full size. Link preview stays full
  size. Meta row stays full size. Only the prose body clamps.
- **Per-card local state.** Expanded/collapsed state lives in the
  card component for the lifetime of the mount. Not persisted —
  scroll-and-return shouldn't re-expand for you. (Consistent with
  the seen-state brief's "scrolling is reading, not action" rule.)

---

## Scope (sketch — to be fleshed out before build)

### Likely build

**Reused / studied**
- `components/PostCard.tsx` lines 390-414 — CSS clamp recipe
  (`display: -webkit-box` + `WebkitLineClamp` + paragraph join).
  Lift the styling primitive. Note: `/feed`'s clamp is *always-on*
  in compact variant; this BU adds the conditional measure + toggle.

**Schema / data**
- New `SystemSetting` key: `network_card_body_clamp_threshold_lines`.
  Value stored as TEXT, parsed via `getSystemSettingInt`. Default
  fallback in code: TBD (suggest 6). Seeded via migration per D070.

**Server**
- `server/routers/network.ts` — extend `network.list` (or a sibling
  `network.config`) to return `bodyClampThresholdLines: number`
  alongside the cards. Threshold is global; fetching once per page
  load is fine.
- `server/services/network.service.ts` — read setting via
  `getSystemSettingInt('network_card_body_clamp_threshold_lines', 6)`.

**Client**
- `components/network-card.tsx` — wrap the body in a
  `<ClampedBody>` (or inline; one-use components don't need their
  own file) that:
  - Renders body in its natural height inside a measuring ref
  - In `useLayoutEffect`, measures `scrollHeight` vs `thresholdLines
    × computed line-height`
  - If exceeds: applies the 3-line clamp via `-webkit-line-clamp`
    and shows a "Show more" button
  - "Show more" toggles to "Show less"; the toggle removes the
    clamp inline (no remount)
  - ResizeObserver to recompute on viewport change
- The body input is the same `text_body` that BU-network-feed
  already passes (with the "body equals URL → suppressed" rule
  upstream).

**Admin UI**
- `app/settings/page.tsx` — replace the existing "Urgent TTL
  (admin) — Editable here once BU-requests-urgent ships..."
  placeholder pattern with an actual edit field for *both*:
  - `urgent_ttl_hours` (already exists; turn the placeholder into a
    real number input)
  - `network_card_body_clamp_threshold_lines` (new)
- Generic shape: a small `SystemSettingNumberField` component
  (admin-only, gated by existing admin check) that reads + writes
  via tRPC `systemSettings.set({ key, value })`.
- This is borderline scope-creep. **Open question 1** asks the user
  whether to ship a generic admin editor or keep it minimal.

**tRPC**
- `systemSettings.set({ key, value })` — already exists via
  `setSystemSetting` in `server/services/system-setting.ts`, but
  there's no router endpoint yet (only internal use). Add the
  router procedure, admin-gated.
- `systemSettings.get(['key1', 'key2'])` — for the admin edit UI to
  load current values. Admin-gated.

**Analytics** (per `docs/product/analytics-events.md`)
- `network_card_body_expanded` — payload: `{}`. No message body,
  no URL. Fires on "Show more" tap only (not "Show less").

**Tests**
- Unit: `<ClampedBody>` — short body renders ungated; long body
  renders clamped + button; toggle expands and collapses.
- Unit: threshold edge cases — body of exactly `thresholdLines`
  renders ungated; `thresholdLines + 1` renders clamped.
- Unit: SystemSetting service — fallback when key absent; integer
  parse when value present.
- Component: admin edit field updates the SystemSetting, persists,
  and the next /network page load reflects the new threshold.
- Manual: phone (iOS Safari + iOS standalone PWA + Android
  Chrome), desktop. Verify `-webkit-line-clamp` renders correctly
  on each. Verify ResizeObserver recomputes on rotation.

### Out of scope

- **Clamp on title, meta row, or link preview.** Body only.
- **Per-user expanded-state persistence.** Local per-mount only.
- **Per-card threshold overrides.** Global setting only.
- **Different line counts per viewport.** 3 everywhere (locked).
- **Generic admin-editor scaffolding for all SystemSettings.**
  Open question 1. Default: minimal, just the two fields needed.
- **Touching the existing `/feed` clamp.** That code is the
  reference, not the target. No regression in `PostCard`'s
  compact variant.
- **Migration of `urgent_ttl_hours` placeholder copy** — this BU
  *upgrades* the placeholder to a real field as a side effect; not
  a regression because the placeholder explicitly says "Editable
  here once BU-requests-urgent ships." That BU has shipped; the
  edit field is overdue.

---

## Definition of done (sketch)

- Bodies below threshold render in full, no toggle.
- Bodies above threshold clamp to 3 lines, show "Show more"
  button; tap expands; "Show less" collapses.
- ResizeObserver recomputes the clipped state on viewport change.
- `SystemSetting` key `network_card_body_clamp_threshold_lines`
  seeded via migration; fallback default applied if absent.
- Admin can edit the threshold value (and `urgent_ttl_hours`) at
  `/settings`; new value takes effect on next `/network` page load.
- Non-admin users see read-only display (or nothing) at `/settings`
  for these fields.
- All actionable elements carry `data-testid` (F14).
- `pnpm typecheck && pnpm lint && pnpm test` clean.
- `package.json` PATCH bumped.
- README.md updates for `app/settings/`, `app/network/`,
  `server/routers/`, `server/services/`.
- D068: brief flipped to `status: shipped` on PR merge.
- `pnpm trackers` regenerated (per memory rule on new briefs).

---

## Open questions to surface before flipping to `ready`

1. **Scope of the admin edit UI.** Two options:
   - (a) **Minimal:** edit fields just for the two settings we
     need (`urgent_ttl_hours`, `network_card_body_clamp_threshold_lines`).
     Inline in `app/settings/page.tsx`. ~30 lines.
   - (b) **Generic:** a `SystemSettingsAdminPanel` that auto-lists
     all known SystemSettings keys, with type-aware editors. ~150
     lines + a registry pattern.
   Recommendation: **(a)**. Build (b) when there are 5+ admin
   settings, not 2. Premature abstraction otherwise.
2. **Default threshold value.** Suggested 6 lines. Pick during
   design pass — depends on average WhatsApp message length in the
   current pipe (Grant can dump line-count histogram if useful).
3. **`urgent_ttl_hours` upgrade scope.** This BU touches the same
   placeholder UI. Either upgrade the urgent-TTL field at the same
   time (small win, ships the BU-requests-urgent follow-up) or
   leave the placeholder and only add the clamp threshold field.
   Recommendation: upgrade both — they're the same component pattern.
4. **ResizeObserver fallback.** Older Safari versions have spotty
   ResizeObserver support. Confirm minimum-iOS-version target with
   `package.json` browserslist before locking. Fallback: just
   measure on mount; accept that rotation may briefly show the
   wrong state.
5. **Analytics PII check.** `network_card_body_expanded` payload is
   empty — confirm no card-identifying fields slip in during build.

### Decisions already made (in conversation, locked here)

- **3-line clamp everywhere.** Mobile + desktop both, for
  consistency. 4-on-desktop rejected.
- **Threshold is admin-settable.** Via SystemSetting + admin UI in
  `/settings`. Not a build-time constant.
- **Reuse `/feed`'s CSS clamp recipe.** `components/PostCard.tsx`
  lines 390-414 is the pattern; lift styling, add the conditional
  + toggle on top.
- **In-place expansion, no navigation.** "Show more" expands the
  card; doesn't open a detail page.
- **Body only.** Title, meta, link preview unaffected.

---

## Depends on

- **BU-network-feed** (shipped — #306/#310/#314/#315). This BU adds
  truncation on top of the existing card component.
- **BU-requests-urgent** (shipped — provides the SystemSetting
  primitive and the existing `urgent_ttl_hours` row).
- **bu-network-seen-state** (planned — parallel/sibling, no hard
  dep). The seen-state BU adds the accent-strip NEW signal and the
  dismiss icon; this BU adds the body clamp. They touch
  `network-card.tsx` separately and can ship in either order, but
  reviewing both in mind avoids overlapping edits.

No ADR required: no schema change beyond a SystemSetting seed
migration, which is data not contract.

---

## Context

- Conversation: 2026-05-12 design discussion (Paul + Claude) —
  identified mobile-card-length pain; locked 3-line clamp + admin
  threshold.
- Reference implementation: [`components/PostCard.tsx`](components/PostCard.tsx:390)
  lines 390-414 — `display: -webkit-box` + `WebkitLineClamp: 3` +
  paragraph join.
- SystemSetting primitive: [`server/services/system-setting.ts`](server/services/system-setting.ts) —
  `getSystemSetting` / `getSystemSettingInt` / `setSystemSetting`.
- Existing admin placeholder: [`app/settings/page.tsx`](app/settings/page.tsx:175)
  lines 175-190 — "Urgent TTL (admin)" placeholder, ready to be
  upgraded.
- Parent brief: [`BU-network-feed.md`](BU-network-feed.md) §2/Q5
  (card UI; body-equals-URL suppression rule).
- Sibling brief: [`bu-network-seen-state.md`](bu-network-seen-state.md)
  (parallel work on the same component; coordinate edits).
- Sharon-warmth posture: CLAUDE.md "Voice and tone notes."
- F14 testid rule: enforced.
