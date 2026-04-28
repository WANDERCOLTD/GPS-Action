---
slug: bu-drafts-inbox
status: planned
phase: 2
priority: medium
note: 'Phase 2 of D072. Bundles the autosave plumbing deferred from bu-publish-router with the /drafts page so the work has a recall surface from day one. The brief shape will be filled out closer to start.'
---

# SESSION BRIEF · bu-drafts-inbox — autosave + author's drafts list

_Brief version: 0.2 (stub) · Author: Paul (via Claude) · Date: 2026-04-28_

This is a **planned-status stub** for Phase 2 of the publish-router
work designed in D072. The brief will be fleshed out when the BU is
about to start; until then this records the agreed shape.

---

## Why this exists / why now

Phase 1 (`bu-publish-router`) ships `Save as draft` as one of the
modal's base actions and the `<DraftSavedIndicator>` component is
built but not mounted. Drafts persist in the database via the
explicit "Save as draft" verb, but the author can't reach them —
the saved-indicator's "View all drafts" link is a placeholder, and
the IndexedDB-backed autosave per D072 §8 is unbuilt. Phase 2 closes
both gaps in one bundle.

Without Phase 2, drafts are write-only and the indicator never
mounts: refresh-during-compose loses content, "Save as draft" rows
exist but are unreachable except by direct `/post/{id}` URL.
Acceptable as a named Phase-1 limitation; bundling autosave +
`/drafts` is the natural shape because autosaved drafts have no
recall surface without the inbox.

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

- `shared/autosave/indexeddb-cache.ts` — thin wrapper over IndexedDB,
  debounced 500ms, namespaced per-postId-or-temp-id, in-memory
  fallback (D072 §8)
- `shared/autosave/use-autosave-draft.ts` — three-stage gradient
  hook (client-only-debounce → server-promote-after-60s → server-
  only-after-promote)
- `components/PostForm.tsx` — mount the existing
  `<DraftSavedIndicator>` in the form header, wire to the hook,
  swap the "View all drafts" placeholder href for the real route
- `app/drafts/page.tsx` — server component, lists drafts for the
  signed-in author
- `components/DraftRow.tsx` — single-draft list row (title preview,
  body excerpt, kind chip, "In review" pill if reviewRequestId set,
  last-saved timestamp, "Continue editing", "Discard")
- `server/services/post.ts` — extend with `listDraftsForAuthor`
- Tests (fake-timer for autosave hook, integration for /drafts),
  scenario(s)

### Out of scope

- Cross-device sync (still IndexedDB-first per D072)
- Reviewer-side draft visibility (their queue is BU-reviewer-kind-
  review-queue)
- Bulk operations on drafts (single-row only)

---

## Definition of done (sketch)

- Autosave writes to IndexedDB on every keystroke, debounced 500ms;
  fake-timer tests cover the three-stage gradient
- `<DraftSavedIndicator>` mounts in the compose header and shows
  honest state ("Editing…" / "Saved · 2s ago" / "Couldn't save")
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
  the `<DraftSavedIndicator>` component.
