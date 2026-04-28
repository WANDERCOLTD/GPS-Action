---
slug: bu-reviewer-kind-review-queue
status: planned
phase: 2
priority: medium
note: 'Phase 3 of D072. Depends on bu-publish-router (Phase 1) — needs the kind_review RequestType, Post.reviewRequestId, and the action registry already shipped. The brief shape will be filled out closer to start.'
---

# SESSION BRIEF · bu-reviewer-kind-review-queue — reviewer-side queue for kind_review requests

_Brief version: 0.1 (stub) · Author: Paul (via Claude) · Date: 2026-04-28_

This is a **planned-status stub** for Phase 3 of the publish-router
work designed in D072. The brief will be fleshed out when the BU is
about to start; until then this records the agreed shape.

---

## Why this exists / why now

Phase 1 (`bu-publish-router`) ships `Send to reviewers` as one of the
modal's base actions. Once it lands, `kind_review` Requests get
created in the database, but reviewers can't act on them via a
dedicated UI — they exist only as generic Request rows. Phase 3 ships
the reviewer-side surface.

Without Phase 3, "Send to reviewers" creates a queue with no
operators. Acceptable as a named limitation during Phases 1+2 only;
admin staff can still inspect the underlying Request rows manually
during the gap.

---

## Objective

Ship a reviewer-facing queue for `kind_review` requests — listed,
ordered by `Request.priority desc, createdAt asc`, click-through to
load the underlying post into a reviewer-mode compose form. Reviewer
can edit any field. Verdict actions: Publish (post goes live, three-
tier attribution renders); Publish + kind-action (publish + execute
a kind-specific action — e.g. share_to_gps_whatsapp); Reject (post
stays draft, originator notified with free-text reason); Edit and
keep in review (rare — for cases where another reviewer's eyes are
wanted before verdict).

The queue is **distinct from** the existing `vetting` queue (member
admission). Reviewer scopes can grant access to one without the
other.

Success looks like: Sharon (queue manager) opens the reviewer queue →
sees Eddie's tick_or_cross post awaiting review at the top (priority:
high) → clicks → loads in editable form → tightens the body → picks
"Publish + share to GPS WhatsApp" verdict → post goes live with the
three-tier attribution; Eddie gets a notification "Sharon refined and
published your post"; Sharon's WhatsApp opens with the formatted
message ready to paste.

---

## Scope (sketch — to be fleshed out)

### Likely build

- `app/reviewer/kind-review/page.tsx` — server-rendered queue list
- `app/reviewer/kind-review/[requestId]/page.tsx` — single-request view
  with the post in editable form + verdict actions
- `components/KindReviewRow.tsx` — single-queue-row component
- `components/VerdictActionsBar.tsx` — verdict buttons + reject reason
  textarea + keep-in-review state
- `server/services/request.ts` — extend with reviewer-side query +
  verdict-application functions (the verdict closure logic from D072
  §7 already lives in Phase 1's `closeKindReviewRequest`; this BU
  surfaces the action buttons)
- Permission gates per the reviewer scope `queue_manager:kind_review`
- Tests, scenario(s)

### Out of scope

- Bulk verdict operations (single-request only)
- Reviewer-to-reviewer handoff/comment within the request (use existing
  Request comments)
- Cross-queue routing (kind_review stays kind_review; doesn't escalate
  to flag/incident automatically)
- Reviewer analytics dashboard (separate BU if needed)

---

## Permissions

A new reviewer scope `queue_manager:kind_review` gates access. Members
with this scope see the queue; others get a 404. Admin always has
access. Existing scope-string parsing (`scopeToRequestType` in
request.ts) needs `kind_review` added to its known list.

---

## Definition of done (sketch)

- Members with the right scope can list and act on kind_review
  requests; others can't
- Each verdict action correctly updates Post + Request + creates the
  three-tier attribution surfaces (auto-comment, sets reviewedByUserId)
- Reject path notifies originator with reason
- Publish + kind-action correctly invokes the registered handler from
  D072 §4
- Vetting queue and kind-review queue are visibly distinct
- All checks green
- D068: brief flipped to `status: shipped` on PR merge

---

## Depends on

- **bu-publish-router** must ship first. This BU consumes the
  schema (`reviewRequestId`, `reviewedByUserId`), the action registry,
  and the verdict-closure service functions Phase 1 establishes.
