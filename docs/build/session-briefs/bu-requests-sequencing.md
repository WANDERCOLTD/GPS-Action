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

**Caveat:** Demo value is partial — Eddie sees his pending request, but nothing animates because no reviewer can pick it up yet. Think of this as "the data flows; the experience is incomplete." This BU is purely the prerequisite for either of the next two; it's not a standalone demo.

---

### BU-requests-urgent — alerts + polling + FAB tile + minimal claim/resolve

**Scope:**

- `AlertCategory` admin-managed table seeded with one entry: "Happening now" (D058)
- `SystemSetting` row for default urgent TTL (4h per D058)
- 10s polling endpoint that returns the urgent-flagged Requests visible to the caller
- **Visibility broadening:** urgent Requests are visible to ALL reviewers regardless of scope (acting on them stays scope-restricted)
- FAB alert tile UI — red warning triangle + exclamation, one-tap to start an alert composer (per D044 FAB intent-cards model)
- Alert composer (a streamlined Request creator: alert category picker, title, body, optional photo URL)
- Urgent banner / pinned strip on the feed for `audience: 'all'` urgent posts visible to the member
- **Minimal claim/resolve actions** on Request (just enough for the urgent loop — pick up, mark resolved with a one-line outcome). Full vetting-grade audience-toggled comments come in the vetting BU.
- Comment thread on Request (`audience: 'all'` only — the internal/external split is a vetting concern; urgent alerts don't need it for MVP)
- Seed: one pre-seeded `urgent` Request from Maya at a school gate so Sharon's view shows the polling-update behaviour live

**What this demos (full SCN-23 + the brand promise):**

- Maya at the school gate taps the FAB, picks "Happening now" alert tile, types one line + photo URL, submits
- Within 10s Sharon (and every other reviewer) sees the alert appear at the top of /requests
- Sharon taps the alert → reads the photo + body → claims it → comments "I'm at the press desk now, on it" → marks resolved before TTL expires
- Maya sees the timeline: "Sharon picked this up · 14:21" → "Resolved by Sharon · 14:38"

This is the **community-facing pulse** of the system — the demo that distinguishes GPS Action from a WhatsApp group. Self-contained: doesn't require vetting to demonstrate the value.

**Effort:** ~2–2.5 sessions (~1700 LOC — schema additions, polling endpoint, FAB tile, alert composer, visibility-broadening filter, minimal claim/resolve actions, comment thread, tests).

**Dependencies:** **BU-requests-foundation** must land first.

**Demo value:** **Highest.** This is the heartbeat — the scenario that makes "purpose-built for coordinated activism" real.

---

### BU-requests-vetting — admin reviewer flow + audience-toggled comments

**Scope:**

- Reviewer-view filter for `queue_manager:vetting` scope at `/requests`
- Vetting-specific resolution outcomes (approved / rejected / needs-more-info)
- **Audience toggle on comments** (per D056) — `audience: 'reviewers'` (internal note) or `audience: 'all'` (visible to submitter). Reviewer chooses on each comment; submitter sees only `audience: 'all'`
- @mention syntax in comments → triggers a `Notification` row (D057)
- Notification entity + minimal in-app delivery (notifications surface inside the Requests tab — Option B from the design)
- Richer status timeline (system messages on every state transition — per SCN-22)
- Seed: pre-seed Eddie's vetting application + a couple of others so Sharon's queue has variety

**What this demos (SCN-21 + SCN-22):**

- Sharon claims Eddie's vetting → asks "can you confirm your postcode?" (audience=all) → Eddie sees the question + replies → Sharon adds an internal note (audience=reviewers) "voucher checks out" → @mentions Jeremy for sign-off → resolves as approved → Eddie sees "approved · welcome 🤝"

**Effort:** ~2–2.5 sessions (~1800 LOC — comment audience filter, scope-filtered queue, notification entity + display, system-transition messages, @mention parsing, tests).

**Dependencies:** **BU-requests-foundation** must land first. Soft-benefits from BU-requests-urgent shipping first (the urgent BU establishes the basic claim/resolve UX that vetting extends with audience-toggled comments).

**Demo value:** Important for the admin story — but it's the back-office demo. Less central to the brand promise than urgent.

---

## Effort + value comparison

| BU | Effort | Demo value alone | Unlocks scenarios |
|---|---|---|---|
| **foundation** | 1.5–2 sessions | Low (data only, no flow) | SCN-21 partial |
| **urgent** | 2–2.5 sessions | **Highest** — community-facing pulse, the brand promise | SCN-23 ✓ |
| **vetting** | 2–2.5 sessions | Medium — admin back-office, important but not central | SCN-21 ✓ + SCN-22 ✓ |

**Total if all three:** ~5.5–7 sessions of focused work.

---

## Why urgent is more central than vetting (corrected after review)

GPS Action's brand promise is "**purpose-built platform for coordinated activism — replacing the network's WhatsApp-based coordination.**" That promise is fulfilled in the urgent flow: Maya raises an alert at the school gate, every reviewer with permission sees it within 10 seconds, someone claims and acts. WhatsApp's failure mode (urgent things drown in noise; coordination is chaotic) is exactly what urgent solves.

Vetting is the gate every member crosses once. Urgent is the heartbeat every member sees daily. The urgent demo shows the product *working*; the vetting demo shows the admin tooling *working*.

For the demo, urgent is the centerpiece.

---

## Recommended sequence

### Path A — full Requests workspace (most demo, longest path)

1. **BU-requests-foundation** — necessary plumbing
2. **BU-requests-urgent** — the brand-promise demo (SCN-23)
3. **BU-requests-vetting** — admin completeness (SCN-21 + SCN-22)

Total: 5.5–7 sessions. Lands all three Requests scenarios.

### Path B — urgent-only (best demo per session) ← **recommended**

1. **BU-requests-foundation** + **BU-requests-urgent** as a sequence of two BUs (~3.5–4.5 sessions, two clean PRs)
2. Defer vetting until after the demo

Pros: lands the brand-promise scenario (Maya's school-gate alert) — the demo that distinguishes GPS Action from a WhatsApp group. Self-contained: minimal claim/resolve UX inside the urgent BU means it doesn't depend on vetting to be a complete loop.
Cons: vetting workflow not demoable yet; admin-side completeness deferred.

### Path C — vetting-first (admin completeness, weakest demo otherwise)

1. **BU-requests-foundation**
2. **BU-requests-vetting** without urgent

Pros: shows the full submitter↔reviewer flow with audience-toggled comments
Cons: misses the brand-promise scenario; SCN-23 (the most distinguishing demo) stays parked.

---

## My recommendation

**Path B — foundation → urgent.** Two BUs, ~3.5–4.5 sessions, delivers the scenario that demonstrates GPS Action's reason for being. Vetting is the natural follow-up (Path A continuation) but doesn't need to land for the demo to land.

Order matters: **foundation must precede urgent** (urgent extends the Request entity foundation introduces). Don't try to bundle them — foundation has its own surface area (schema rename, role middleware) that benefits from being review-able on its own.

If session budget is generous, **Path A** in the order above (urgent before vetting) gets you everything.

I'd avoid Path C — vetting-only demos the admin tooling without showing the product working.

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
