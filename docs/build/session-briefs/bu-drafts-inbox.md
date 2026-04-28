---
slug: bu-drafts-inbox
status: planned
phase: 2
priority: medium
note: 'Phase 2 of D071. Depends on bu-publish-router (Phase 1) — needs Post.status, autosave plumbing, and the publish modal already shipped. The brief shape will be filled out closer to start.'
---

# SESSION BRIEF · bu-drafts-inbox — author's drafts list

_Brief version: 0.1 (stub) · Author: Paul (via Claude) · Date: 2026-04-28_

This is a **planned-status stub** for Phase 2 of the publish-router
work designed in D071. The brief will be fleshed out when the BU is
about to start; until then this records the agreed shape.

---

## Why this exists / why now

Phase 1 (`bu-publish-router`) ships `Save as draft` as one of the
modal's base actions. Once it lands, drafts persist in the database
but the author can't reach them — the form's saved-indicator menu
links to `/drafts` which doesn't yet exist. Phase 2 makes that link
real.

Without Phase 2, drafts are write-only — useful for "don't lose this"
but not for "come back later". Sharon types a post, hits Save as
draft, closes the app, and the post is unreachable. Acceptable as a
named limitation during Phase 1 only.

---

## Objective

Ship `/drafts` — an authenticated route that lists the current
member's draft posts (status='draft', deletedAt IS NULL,
authorId=callerId), ordered by most-recently-edited. Each row shows:
title preview, body excerpt, kind chip, "In review" pill if
reviewRequestId set, last-saved timestamp, "Continue editing" link
back to the compose form pre-populated, and a "Discard" affordance
that fires the same discardPostAction Phase 1 introduced.

Make the saved-indicator's "View all drafts" link in the compose form
finally work.

Success looks like: tap "View all drafts" from any compose form →
land on `/drafts` → see every draft Sharon has saved → tap one →
compose form re-opens with all fields populated → make changes →
publish via the universal modal.

---

## Scope (sketch — to be fleshed out)

### Likely build

- `app/drafts/page.tsx` — server component, lists drafts
- `components/DraftRow.tsx` — single-draft list row
- `server/services/post.ts` — extend with `listDraftsForAuthor`
- Tests, scenario(s)

### Out of scope

- Cross-device sync (still IndexedDB-first per D071)
- Reviewer-side draft visibility (their queue is BU-reviewer-kind-
  review-queue)
- Bulk operations on drafts (single-row only)

---

## Definition of done (sketch)

- `/drafts` page loads authenticated drafts only
- Tap a draft → resumes in compose form with all fields populated
- Discard from the list works the same way as discard from the modal
- "In review" pill renders when reviewRequestId is set
- All checks green
- D068: brief flipped to `status: shipped` on PR merge

---

## Depends on

- **bu-publish-router** must ship first. This BU has no value without
  Phase 1's schema + autosave + discard infrastructure.
