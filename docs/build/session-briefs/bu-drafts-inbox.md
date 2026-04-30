---
slug: bu-drafts-inbox
status: planned
phase: 2
priority: medium
note: 'Phase 2 of D072. Adds the /drafts page + the server-side half of D072 §8 autosave (Phase 1 shipped client-only IndexedDB + indicator). The brief shape will be filled out closer to start.'
---

# SESSION BRIEF · bu-drafts-inbox — server-promote autosave + author's drafts list

_Brief version: 0.3 (stub) · Author: Paul (via Claude) · Date: 2026-04-29_

This is a **planned-status stub** for Phase 2 of the publish-router
work designed in D072. The brief will be fleshed out when the BU is
about to start; until then this records the agreed shape.

---

## Why this exists / why now

Phase 1 (`bu-publish-router`) shipped `Save as draft` as one of the
modal's base actions, plus the IndexedDB autosave + indicator
(stage 1 of D072 §8 — client-only). Drafts persist in the database
via the explicit "Save as draft" verb, but the author can't reach
them — the saved-indicator's "View all drafts" link is still a
placeholder, and stages 2 and 3 of the autosave gradient (server-
promote on 60s of inactivity, server-only autosave thereafter) are
unbuilt. Phase 2 closes both gaps in one bundle.

Without Phase 2, "Save as draft" rows are unreachable except by
direct `/post/{id}` URL, and a refresh longer than the IndexedDB
cache lifetime — or a different device — loses the draft. Bundling
the server-side autosave with `/drafts` is the natural shape because
the server-side rows the autosave creates have no recall surface
without the inbox.

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

- `shared/autosave/use-autosave-draft.ts` — extend the Phase 1 hook
  with stage 2 (server-promote on
  `autosave_promote_after_inactivity_seconds` of inactivity using
  `createPostAction`) and stage 3 (server-only `autosaveDraftAction`
  cadence at `autosave_interval_seconds` thereafter — both
  SystemSettings are already seeded by Phase 1).
- `components/PostForm.tsx` — swap the indicator's `viewDraftsHref`
  placeholder for `/drafts` once the page lands.
- `app/drafts/page.tsx` — server component, lists drafts for the
  signed-in author
- `components/DraftRow.tsx` — single-draft list row (title preview,
  body excerpt, kind chip, "In review" pill if reviewRequestId set,
  last-saved timestamp, "Continue editing", "Discard")
- `server/services/post.ts` — extend with `listDraftsForAuthor`
- Tests (fake-timer for the new autosave stages, integration for
  /drafts), scenario(s)

### Out of scope

- Cross-device sync (still IndexedDB-first per D072)
- Reviewer-side draft visibility (their queue is BU-reviewer-kind-
  review-queue)
- Bulk operations on drafts (single-row only)

---

## Definition of done (sketch)

- Autosave server-promotes a row after the inactivity window; from
  there, server-only autosaves fire at the configured cadence; both
  covered by fake-timer tests
- `<DraftSavedIndicator>` continues to show honest state across
  stages 1 → 2 → 3 (no client-only-vs-server-only distinction
  surfaced in copy)
- `/drafts` page loads authenticated drafts only
- Tap a draft → resumes in compose form with all fields populated
- Discard from the list works the same way as discard from the modal
- "In review" pill renders when reviewRequestId is set
- All checks green
- D068: brief flipped to `status: shipped` on PR merge

---

## Depends on

- **bu-publish-router** must ship first. This BU has no value without
  Phase 1's schema + lifecycle service functions + publish modal +
  the IndexedDB autosave + `<DraftSavedIndicator>` already mounted.
