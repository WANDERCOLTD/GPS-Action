# Sequencing brief — Requests workspace BUs

_Companion to D054–D058 + SCN-21/22/23. Lays out how to slice the work into shippable Build Units with effort estimates and demo-value ranking._

_Author: Paul (via Claude). Date: 2026-04-26._
_Status: Decision-ready — pick one to brief into a build session._

---

## Why this exists

D054–D058 designed the Requests workspace fully (entity, role scopes, comment audience, notifications, urgent flag, alerts, polling). SCN-21/22/23 walk Eddie / Sharon / Maya through it. None of it is built yet.

The implementation is too big for a single BU. This doc proposes a three-way slice, estimates effort per slice, and ranks them by demo value so you can pick what to build first.

---

## The three slices

### BU-requests-foundation — plumbing + submitter view

**Scope:**

- Schema rename `WorkItem` → `Request`, `WorkItemType` → `RequestType` (touches many files; ADR-gated; single migration with `RENAME` SQL — D054)
- Add `audience` enum (`'all' | 'reviewers'`) to `Comment` (D056)
- Add `urgency` boolean + nullable `alertCategoryId` FK to `Request` (D058 — schema only, no UI)
- Add `RoleGrant.scope` field for granular scope strings like `queue_manager:vetting` (D055)
- New `requireRole(scope)` tRPC middleware (D055)
- `/requests` route at top-level, replaces "inbox" nav slot (D054 — D030 nav rename)
- **Submitter view only:** "My requests" section showing Eddie's own pending requests with status timeline (per SCN-21)
- Seed: pre-seed Eddie's vetting application as a `Request` with `targetType: 'vetting_application'`

**What this demos:**

- Eddie logs in, taps the new "Requests" tab, sees his vetting application as `new`
- Status pill, audit trail of submitted-at, no comments yet (no reviewer to add them)

**Effort:** ~1.5–2 sessions (~1500 LOC including migration, types, route, list view, tests, seed).

**Dependencies:** None (foundation BU).

**Caveat:** Demo value is partial — Eddie sees his pending request, but nothing animates because no reviewer can pick it up yet. Think of this as "the data flows; the experience is incomplete."

---

### BU-requests-vetting — reviewer view + the full vetting flow

**Scope:**

- Reviewer view at `/requests`: queue filtered by the caller's `RoleGrant.scope` (e.g. only Sharon's `queue_manager:vetting` grant shows vetting cases)
- Claim action — atomically picks up a `new` Request to `in_discussion`, attributes to the claimer
- Resolve action — moves `in_discussion` → `done` with an outcome (approved / rejected / etc.)
- Comment thread on a Request, with **audience toggle** (per D056):
  - Reviewer can post `audience: 'reviewers'` (internal note) or `audience: 'all'` (visible to submitter)
  - Submitter sees only `audience: 'all'` comments
- @mention syntax in comments → triggers a `Notification` row (D057)
- Notification entity + minimal in-app delivery (notifications surface inside the Requests tab — Option B from the design)
- Status timeline on Request detail (system messages on every state transition — per SCN-22)
- Seed: pre-seed Eddie's vetting in `new` state ready for Sharon to claim

**What this demos (full SCN-21 + SCN-22):**

- Eddie sees his vetting as `new` → Sharon logs in, claims it, asks "can you confirm your postcode?" (audience=all) → Eddie sees the question + replies → Sharon adds an internal note (audience=reviewers) "voucher checks out" → resolves as approved → Eddie sees "approved · welcome 🤝"
- The discussion flow that justifies the whole Requests workspace

**Effort:** ~2–2.5 sessions (~2000 LOC — comment audience filter, claim/resolve actions, notification entity + display, system-transition messages, tests).

**Dependencies:** **BU-requests-foundation** must land first (extends the Request entity + comment audience field that foundation introduced).

**Demo value:** Highest. This is the BU that makes the design real — you can show the full submitter↔reviewer dance end-to-end on one demo path.

---

### BU-requests-urgent — alerts + polling + FAB tile

**Scope:**

- `AlertCategory` admin-managed table seeded with one entry: "Happening now" (D058)
- `SystemSetting` row for default urgent TTL (4h per D058)
- 10s polling endpoint that returns the urgent-flagged Requests visible to the caller
- **Visibility broadening:** urgent Requests are visible to ALL reviewers regardless of scope (acting on them stays scope-restricted)
- FAB alert tile UI — red warning triangle + exclamation, one-tap to start an alert composer (per D044 FAB intent-cards model)
- Urgent banner / pinned strip on the feed for `audience: 'all'` urgent posts visible to the member
- Seed: one pre-seeded `urgent` Request from Maya at a school gate so Sharon's view shows the polling-update behaviour

**What this demos (SCN-23):**

- Maya at the school gate taps the FAB, picks "Happening now" alert tile, types one line + photo URL, submits → all reviewers see the alert within 10s → Sharon @mentions herself / claims → resolves before TTL expires → audit trail shows the timing

**Effort:** ~1.5–2 sessions (~1200 LOC — schema additions, polling endpoint, FAB tile UI, alert composer, visibility-broadening filter, tests).

**Dependencies:** BU-requests-foundation (Request entity), soft-depends on BU-requests-vetting (uses the same claim/resolve flow). Could ship without vetting if you want urgent-first demo, but the claim/resolve UX would have to be invented twice.

**Demo value:** Most dramatic moment. But standalone urgent without the vetting flow context feels a bit detached.

---

## Effort + value comparison

| BU | Effort | Demo value alone | Demo value combined | Unlocks scenarios |
|---|---|---|---|---|
| **foundation** | 1.5–2 sessions | Low (data only, no flow) | Required prerequisite | SCN-21 partial |
| **vetting** | 2–2.5 sessions | **Highest** (full vetting demo) | Heart of the workspace | SCN-21 ✓ + SCN-22 ✓ |
| **urgent** | 1.5–2 sessions | Medium (dramatic but needs context) | Highest combined value | SCN-23 ✓ |

**Total if all three:** ~5–6 sessions of focused work.

---

## Recommended sequence

### Path A — full Requests workspace (most demo, longest path)

1. **BU-requests-foundation** — necessary plumbing
2. **BU-requests-vetting** — the heart of the demo (SCN-21 + SCN-22)
3. **BU-requests-urgent** — the dramatic moment (SCN-23)

Total: 5–6 sessions. Lands all three Requests scenarios. Probably the right answer if you have time before the demo.

### Path B — vetting-only (best demo per session)

1. **BU-requests-foundation** + **BU-requests-vetting** as one bundled BU (~3.5 sessions, big PR)
2. Defer urgent until after the demo

Pros: best return on time invested — full SCN-21 + SCN-22 demo without the urgent surface area
Cons: no urgent UI; one bundled BU is less reviewable than three sequenced ones

### Path C — urgent-only (most dramatic, weakest demo otherwise)

1. **BU-requests-foundation** (necessary)
2. **BU-requests-urgent** without vetting

Pros: shows the urgent FAB tile + polling, the most visceral feature
Cons: no vetting workflow demo; the standalone urgent feels detached without the workspace context around it

---

## My recommendation

**Path A in sequence — foundation → vetting → urgent.** Three focused BUs, each demoable on its own merit, totalling ~5–6 sessions. The vetting BU is the centerpiece (SCN-22 is the most lived-in scenario in the design). Urgent is dessert — high-impact but only really lands once vetting establishes the workspace mental model.

If session budget is tight, **Path B** (foundation + vetting as one BU, defer urgent) gives 80% of the demo value at 60% of the cost.

I'd avoid Path C — urgent without vetting demos a feature, not a system.

---

## Open questions before briefing

1. **Schema rename impact** — `WorkItem` → `Request` touches every file that references the old name. Worth a separate "schema rename" commit inside the foundation BU, or a separate prep PR? (Recommendation: same BU, separate commit, so the commit log shows the rename clearly.)
2. **Notification entity design** — D057 specified the entity but not the polling/delivery mechanism for notifications themselves. Notifications inside the Requests tab is Option B from the design — confirm before vetting BU starts.
3. **Audit log integration** — every state transition (claim, resolve, comment-with-mention) should write an audit log row. Confirm this is in scope for the vetting BU (recommendation: yes).
4. **Seed strategy** — how rich do the pre-seeded Requests need to be? At minimum: 1 pending vetting (Eddie), 1 claimed-with-comments vetting (other user), 1 urgent (Maya). More scenarios = more demo-able variety; cost is seed maintenance.
5. **Mobile vs desktop priority** — SCN-21/22 read as desktop-first (Sharon's nightly review pass on her laptop). SCN-23 is phone-first (Maya at school gate). The vetting BU should hit both equally; the urgent BU should especially nail the phone PWA experience.

---

## Related

- D054 — Request entity
- D055 — Per-type role scopes
- D056 — Comment audience model
- D057 — Notifications entity
- D058 — Urgent flag, AlertCategory, polling
- D061 — Global tap interaction pattern (the Requests UI inherits)
- SCN-21, SCN-22, SCN-23 — the scenarios this work serves
- `docs/architecture/admin-surface.md` — the broader admin context
- `docs/architecture/claim-and-lease.md` — the legacy WorkItem model that gets renamed
