---
slug: bu-network-seen-state
status: planned
phase: 2
priority: medium
note: "Stub. Companion to BU-network-feed (#306/#310/#314/#315). Separates two distinct pains — 'which cards are new since last visit?' (auto) and 'I'm done with this one' (manual) — so each gets the right shape. v1 stores state in the browser (localStorage), not the DB — chosen to keep shared-login testers from clobbering each other's state. No schema change, no ADR needed for v1."
---

# SESSION BRIEF · bu-network-seen-state — auto-NEW marker + manual mark-as-seen for /network cards

_Brief version: 0.1 (stub) · Author: Paul (via Claude) · Date: 2026-05-12_

This is a **planned-status stub**. It records the agreed shape from the
2026-05-12 design conversation; details are filled in when the BU is
about to start.

---

## Why this exists / why now

`/network` shipped through #306/#310/#314/#315 and members are using it.
Two pain points have surfaced on repeat visits:

1. **"Which cards are new since I last looked?"** — the list is
   time-ordered but otherwise undifferentiated. A member who checked
   `/network` this morning has to compare timestamps by eye to find
   what arrived during the day.
2. **"I'm done with this one — get it out of my way."** — there's no
   per-user signal for "I've read this, I don't need to think about it
   again." Triage state in `NetworkCardState` is a *global* queue
   (per-app), not a per-user inbox state. Per the BU-network-feed
   brief: "Triage state is per-app, not per-user initially."

These are two different problems and want two different shapes —
mixing them produces false positives (auto-mark-on-scroll) or extra
friction (manual mark on every card).

Doing nothing risks `/network` becoming "the same wall of links every
time I open it," which directly contradicts CLAUDE.md's Sharon-warmth
posture: members should feel *permission to close the app after
acting*, which requires being able to tell when there's nothing new.

---

## Objective

Ship three small, composable pieces on top of the existing `/network`
surface:

1. **Auto "NEW" marker per card.** Client-computed: compare each
   card's `sent_at` to a `lastVisitedAt` timestamp stored in
   `localStorage`. Visual: **left-edge accent strip** (~3px,
   full-card-height, accent-token colour) — no pill, no dot, no
   text. Survives dim state. On every `/network` mount: *read* the
   previous `lastVisitedAt` to compute `isNew`, then *write* `now()`
   so the next visit has a fresh anchor. On the first-ever visit
   (no stored value), suppress all NEW strips by writing `now()`
   *before* computing — first-time experience is a clean list, not
   a wall of stripes.
2. **Manual per-card mark-as-seen.** Eye-slash icon on each card →
   adds the card's `messageId` to a `Set` of dismissed IDs in
   `localStorage`. Dismissed cards **dim** (~50% opacity), they do
   not hide. Reversible: tap the same icon to remove from the set.
3. **"Unread only" filter chip** in the existing chip strip (the one
   #343 added). When on, shows only cards where `isNew === true`
   (i.e., arrived since the last visit). Off by default. Filter runs
   client-side over the already-fetched card list.

Success looks like: Sharon opens `/network` mid-afternoon. Three
cards posted since this morning have a `NEW` strip. She taps through
two of them and dismisses the third. She closes the app. At 7pm she
opens it again, flips on "Unread only," and sees the four cards that
arrived during the afternoon — nothing else.

---

## Design principles (locked in 2026-05-12 conversation)

- **Two pains, two mechanisms.** Auto NEW solves "what's new"; manual
  mark-as-seen solves "I've processed this." Don't try to solve both
  with one mechanism.
- **Dim, don't hide.** Hiding makes recovery hard and feels punitive.
  Dimming preserves the network-as-archive feel while still signalling
  "handled."
- **No swipe-to-dismiss in v1.** Conflicts with vertical scroll on
  mobile; no desktop story; iOS-standalone PWA gesture quirks bite us
  (per memory). An `eye-off` icon is discoverable on both viewports.
- **No auto-mark-on-impression.** "Card in viewport ≥Ns → seen" creates
  false positives (scrolled past ≠ read) and removes user agency. The
  one auto-signal we *do* use — mount-time bump of `lastVisitedAt` —
  is coarse enough that it doesn't claim to know what the user
  actually looked at.
- **First visit is a clean slate.** A brand-new browser shows zero
  NEW strips on its first `/network` mount. Honest is one option ("all
  these arrived before you got here"); calm is the chosen one.
- **Left-edge accent strip, not a pill/dot/tint.** Single visual
  signal for `isNew`. Dots collide with the existing chip-strip dots
  (#343); pills add ink; tints can read as warning. The strip scans
  fast down a list and composes cleanly with the dim state (a
  dimmed card with a strip = "new but I dismissed it" — coherent).
- **Survives sort/filter.** State binds to `messageId` (in
  localStorage, per browser) — not to the view — so flipping a filter
  doesn't reset the seen state.
- **Browser-local, not server-backed, for v1.** Real-account era will
  promote this to server-side per-user state. For now, multiple
  testers share one prod login; server-side would mean tester A's
  dismissals clobber tester B's view. localStorage gives each
  browser its own world. Honest tradeoff: a real user switching
  devices sees "everything is new again" on the new device. Accepted
  for v1; revisited when accounts are per-human.
- **Sharon-warmth posture preserved.** No notification dots, no count
  badge in the nav glyph, no auto-poll-while-app-open. The `NEW` strip
  is on the card only; it does not pull the user to the surface.

---

## Scope (sketch — to be fleshed out before build)

### Likely build

**No schema, no server changes.** Entire BU lives client-side. This
is deliberate — see Design principles for the tester-isolation
rationale.

**Client storage layer**
- `lib/network-seen-state.ts` (new) — thin localStorage wrapper.
  Pure functions, SSR-safe (guard `typeof window`). Shape:
  ```ts
  getLastVisitedAt(): Date | null
  setLastVisitedAt(now: Date): void
  getDismissedIds(): Set<bigint>      // parsed from JSON string array
  isDismissed(messageId: bigint): boolean
  toggleDismissed(messageId: bigint): boolean  // returns new state
  ```
  Storage keys: `gps.network.lastVisitedAt`, `gps.network.dismissed`.
  Bounded growth: the dismissed set is pruned to the 90-day window
  (cards older than the server window can't appear anyway). Prune on
  read with a stale-id sweep when the array exceeds ~1000 entries.

**UI**
- `components/network-card.tsx` — accept `isNew: boolean` and
  `dismissed: boolean` props from the parent. Render the `NEW` strip
  when `isNew`. Render the `eye-off` icon with active/inactive state.
  Apply `opacity-50` (or token equivalent) when `dismissed`.
- `app/network/network-feed.tsx` (client component) — on mount:
  read the previous `lastVisitedAt` (null on first visit), compute
  `isNew` per card against that value (null → suppress NEW, *not*
  "everything is new"), then write `Date.now()` back for the next
  visit. Hold `dismissedIds` in component state, initialised from
  localStorage. Compute `isNew`/`dismissed` per card in a `useMemo`
  over the fetched list. Optimistic toggle on the icon — flip state,
  persist, no round-trip needed.
- Existing chip strip from #343 — add an "Unread only" chip. Off by
  default. State syncs to URL search param for shareability
  (consistent with existing chips).

**Empty state**
- `app/network/empty-state.tsx` — already exists from BU-network-feed.
  Extend with a second variant: when "Unread only" is on and no
  cards match (i.e., nothing has arrived since the last visit), show
  "You're all caught up" copy (per Sharon-warmth posture). Distinct
  from the genuinely-empty state.

**Analytics** (per `docs/product/analytics-events.md`)
- `network_card_seen_toggled` — payload: `{ to: 'dismissed' |
  'undimmed' }`. No message body, no URL, no messageId.
- `network_unread_filter_toggled` — payload: `{ enabled: boolean }`.

**Tests**
- Unit: `lib/network-seen-state.ts` — round-trip set/get for both
  keys; null-lastVisitedAt behaviour (caller responsible for first-
  visit suppression; util just returns null); dismissed-set
  idempotence; SSR guard (calling getters with `window` undefined
  returns sensible defaults); pruning kicks in past the bound.
- Unit: `network-feed.tsx` mount logic — when storage is empty, the
  first mount writes `now()` and renders zero NEW strips; second
  mount with a now-older `sent_at` corpus renders NEW correctly.
- Component: `network-card.tsx` — `NEW` strip renders, dim state
  applies, icon toggles. Test via `@testing-library/react` with
  mocked localStorage.
- Manual:
  - Open `/network` in browser A, dismiss two cards, refresh →
    dismissals persist; both stay dimmed.
  - Open `/network` in a brand-new browser B → zero NEW strips on
    first mount (first-visit suppression verified); no dismissals
    carried over from browser A (tester isolation verified).
  - In browser A, leave the tab idle, post a new card from
    WhatsApp, wait for the next polled refresh → the new card has
    a NEW strip once it appears.
  - Close browser A, wait, reopen `/network` → cards newer than
    the previous visit show NEW strips.
  - Toggle "Unread only" → only NEW cards visible (dimmed-and-NEW
    cards still show, just dimmed).
  - Toggle off → full list returns, dismissed cards remain dimmed.

### Out of scope

- **Cross-device sync of seen-state.** Explicitly accepted for v1
  per the localStorage tradeoff. A real user switching from phone to
  laptop sees "everything new again" on the new device. Promote to
  server-side when accounts are per-human.
- **Server-side schema additions.** No `User.networkLastVisitedAt`,
  no `NetworkCardDismissal` table, no ADR for v1.
- **tRPC mutations for seen-state.** No `recordVisit`, no
  `toggleDismissed`. Everything client-side.
- **Per-card seen *timestamp*.** Just dismissed-or-not. If we later
  want "I saw this 2 days ago," upgrade the storage shape.
- **Bulk "mark all as seen."** Single-card only in v1. If repeat-visit
  data shows users want a "clear all" path, add it as a follow-up.
- **Bumping `lastVisitedAt` on filter changes or scroll.** Only on
  mount (per session). Filters and scrolling are reading, not "I'm
  caught up."
- **Hiding dismissed cards entirely.** Locked: dim, don't hide. See
  Design principles.
- **Swipe-to-dismiss.** Parking-lot if usage data later shows the
  `eye-off` icon is a friction point.
- **Notification dot / count badge.** Locked out by Sharon-warmth
  posture.
- **Touching the existing global `NetworkCardState` queue.** That's
  the coordinator triage surface and unaffected by this BU.
- **Migration plan to server-side.** Sketched but not built: on first
  authenticated visit in the real-accounts era, read the localStorage
  payload, write to server, clear local. Defer the actual code to the
  BU that introduces real per-human accounts.

---

## Definition of done (sketch)

- `NEW` strip renders on cards where `card.sent_at > lastVisitedAt`
  (read from localStorage).
- **First-visit suppression:** when `lastVisitedAt` is null, write
  `now()` *before* computing `isNew`, so zero NEW strips appear on
  the first-ever mount.
- `lastVisitedAt` bumps on every `/network` mount, using a
  read-then-write so the previous value drives the comparison.
- Eye-slash toggle works; reload preserves dismissal in the same
  browser; **opening in a different browser shows no dismissals
  carried over** (tester-isolation acceptance).
- "Unread only" chip filters to `isNew === true`; URL search-param
  round-trip works; chip state survives reload.
- Dimmed cards remain clickable and the URL still opens.
- Empty state for "Unread only" with zero results is calm (per
  Sharon-warmth posture) — "You're all caught up" rather than "No
  results."
- All actionable elements carry `data-testid` (F14).
- SSR doesn't crash on missing `window` (Next.js server components
  must not throw when the storage util is imported in a server
  context).
- `pnpm typecheck && pnpm lint && pnpm test` clean.
- `package.json` PATCH bumped.
- README.md updates in `app/network/` and `lib/` (if `lib/` has a
  README convention; otherwise just `app/network/`).
- D068: brief flipped to `status: shipped` on PR merge.

---

## Open questions to surface before flipping to `ready`

1. **Accent-strip colour token.** Lock the design token in the
   design pass — must not be bordeaux (#6B3045 is reserved for
   cultural markers per CLAUDE.md). Suggest the interactive/accent
   token already in `styles/tokens.css`.
2. **Screen-reader label.** Confirm copy for the visually-hidden
   "New" label that pairs with the strip — likely just "New" or
   "Arrived since your last visit." A11y pass.
3. **Storage primitive — localStorage vs IndexedDB.** localStorage
   is synchronous and fine for the data shape here (one timestamp +
   a short ID array). IndexedDB is more capable but adds async
   surface. Default: localStorage. Revisit if the dismissed set
   grows past ~10k entries (won't happen in v1 with a 90-day
   window).
4. **iOS standalone PWA storage durability.** Per memory: iOS
   standalone shares Safari storage; clearing Safari clears it.
   Acceptable for v1. Worth surfacing to testers so a "Clear
   History" action doesn't surprise them.

### Decisions already made (in conversation, locked here)

- **Storage location:** localStorage (browser-local), not
  server-side. Driver: shared-login tester isolation.
- **First-visit experience:** suppress NEW strips on the first-ever
  mount (write `lastVisitedAt = now()` *before* computing `isNew`).
- **"Unread only" semantic:** filters to `isNew === true` only;
  dismissal is independent.
- **Bump cadence:** every `/network` mount, read-then-write so the
  previous value drives the comparison.
- **NEW visual:** left-edge accent strip (~3px, full card height).
  No pill, no dot, no tint. Picked over alternatives to avoid
  collision with chip-strip dots (#343).
- **Dismiss glyph:** `eye-off` (lucide) — freed up by the navbar
  refactor that drops the eye. One concept = one glyph.
- **Feature flag:** no new flag. Rides on the existing
  `network_feed` flag (which already gates `/network`).

---

## Depends on

- **BU-network-feed** (shipped — #306/#310/#314/#315). This BU adds
  per-browser seen-state on top of the existing surface.
- **bu-network-source-chips** (shipped — #343). Reuses the chip strip
  primitive for the "Unread only" chip.
- **bu-network-card-body-clamp** (planned — sibling, no hard dep).
  Adds body truncation to the same component. Either can ship first;
  coordinating edits to `network-card.tsx` between the two briefs
  avoids merge churn.

No ADR required: v1 makes no schema changes. The future server-side
promotion (when accounts go per-human) is the moment that earns an
ADR — not this BU.

---

## Context

- Conversation: 2026-05-12 design discussion (Paul + Claude) — option
  comparison table, "two pains, two mechanisms" framing, dim-don't-
  hide decision, and the **tester-isolation pivot** that moved state
  from server-side per-User to browser-side per-localStorage.
- Parent brief: [`BU-network-feed.md`](BU-network-feed.md) §2/Q4
  (workflow state design, per-app vs per-user — note that this BU
  deliberately doesn't extend that table).
- Sharon-warmth posture: CLAUDE.md "Voice and tone notes" + "permission
  to close the app after acting."
- F14 testid rule: enforced.
- Memory: iOS-standalone PWA gesture quirks (informs no-swipe
  decision) and Safari-storage durability (informs the iOS standalone
  caveat in Open Questions).
- Testing constraint driving the localStorage choice: multiple human
  testers currently share a single prod login. Server-side per-User
  state would mean cross-tester contamination. Re-evaluate when
  accounts are per-human.
