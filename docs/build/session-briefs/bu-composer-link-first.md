---
slug: bu-composer-link-first
status: planned
priority: low
note: "Status uncertain — verify on next pass"
---
# SESSION BRIEF · BU-composer-link-first — URL-first composer with 1-click intent

_Brief version: 0.1 (draft, awaiting user sign-off) · Author: Paul + Claude · Date: 2026-04-27_
_Priority: post-demo composer UX overhaul. Sequenced after the placeholder
secondary-CTA rail (shipped) and the D066 ADR (proposed)._
_Pairs with: D060 (link-share schema), D066 (multi-CTA Action model — proposed),
`docs/product/post-creation-flow.md` (the link-first FAB card vision), and the
"Auto-fetch Open Graph metadata" parking-lot row._

---

## Objective

Re-shape the post composer so the **URL is the first field** and the rest of
the form pre-fills from it. Match the link-first vision in
`docs/product/post-creation-flow.md`: a member pastes a URL, the title /
description / hero pre-fill from Open-Graph metadata, the member adds a
sentence of commentary, and posts in the smallest number of taps possible.

Success scenario (Sharon, SCN-19): Sharon copies a Guardian article URL →
opens the app → taps FAB → taps "Share a link" → the composer is already
open with the URL pre-pasted from clipboard, the Guardian preview card
visible, the title pre-filled from `og:title`, focus on the body field. She
types "Worth reading on the strikes" → Post → confirmation. **3 taps after
opening the app, plus typing.**

---

## Scope — staged across three phases

This brief sequences the work so we ship value early and don't block on the
hardest piece (server-side OG fetch). Each phase is reviewable on its own.

### Phase A — Reorder fields (URL first, no auto-fetch)

**Build:**

- `components/PostForm.tsx` (MODIFY) — move the link-share field group to
  the top of the form, above title and body. Field order becomes:
  1. **URL** (single field, the new headline)
  2. **Title** (still required; pre-fill behaviour comes in Phase C)
  3. **Body** (still required)
  4. Visibility toggle
  5. Hero image picker (D064 — stays where it is for now)
- The "Share a link?" collapse is removed — URL is always-visible.
- `<LinkPreviewCard>` renders below the URL field as a live preview the moment
  a valid URL is entered (today: only renders after submit).

**Don't build yet:**

- Clipboard detection (Phase B).
- Server-side OG fetch / pre-fill (Phase C).
- Multi-CTA composer UI — that lands with D066's schema migration in a
  separate BU.

**Tests:**

- Composer renders URL field first.
- Live preview card appears once URL is non-empty AND valid.
- Submitting with URL only (no title/body) still fails validation
  (title and body are still required at the boundary).

### Phase B — Clipboard-aware FAB

**Build:**

- `components/IntentFab.tsx` (MODIFY) — when the FAB is opened, attempt
  `navigator.clipboard.readText()` (gated on `permissions.query({name:
  'clipboard-read'})` where supported). If the clipboard contains a valid
  URL, the "Share a link" intent card highlights ("Detected URL — tap to
  share") and stores the URL in the route query so the composer can read
  it.
- `app/compose/page.tsx` / `PostForm.tsx` (MODIFY) — read `?url=...` query
  param on mount and pre-populate the URL field. Member can edit / clear.
- Graceful degradation: no clipboard permission, no detection, FAB looks
  identical to today.

**Tests:**

- Mocked clipboard with a URL → "Share a link" card highlighted.
- Mocked clipboard with non-URL text → no highlight.
- Clipboard permission denied → no highlight, no error surfaced to user.
- `?url=` query param pre-fills the composer URL field.

### Phase C — Server-side OG fetch and pre-fill

**Build (gated on D066 ADR being accepted; treat as BU-link-fetch):**

- `server/services/link-preview.ts` (new) — SSRF-hardened fetcher.
  - `https?://` only, redirect cap of 3, 3-second hard timeout, public-IP
    only (rejects RFC1918 / loopback / link-local / IPv6 ULAs).
  - Parses `og:title`, `og:description`, `og:image`, `og:site_name` with
    fallback to `<title>` and `<meta name="description">`.
  - In-memory LRU cache keyed by canonical URL (Phase 2 promotes to a
    `LinkPreview` table per the parking-lot row).
- `server/routers/link.ts` (new) — single procedure
  `link.fetchPreview({ url })` that returns the parsed metadata or a typed
  error (`unreachable`, `timeout`, `not_html`, `blocked_ip`).
- `components/PostForm.tsx` (MODIFY) — debounce URL field changes (300 ms),
  call `link.fetchPreview`, and on success pre-fill empty title / link
  description / link image fields. **Pre-fill is editable**: any field the
  member has typed in is left untouched (we only fill empties). A small
  "Reset to fetched values" affordance appears next to fields the member
  has edited.

**Tests:**

- Service-level: SSRF guards reject loopback, RFC1918, malformed URLs.
- Service-level: Successful fetch parses OG tags; falls back to `<title>`.
- Composer: paste URL → after 300 ms debounce, title field populates if
  empty.
- Composer: typed-in title is preserved across URL changes.

---

## Out of scope (explicitly)

- **Multi-CTA composer.** D066's schema migration plus the secondary-CTA
  picker UI is its own BU (BU-multi-cta, blocked on D066 acceptance).
- **Image upload as part of OG fetch.** Today's hero image picker
  (D064 / fixed bucket) stays. Bringing in `og:image` as a hero source is
  a Phase D conversation.
- **Drafts.** "Save draft" is parked separately.

---

## Decision points to resolve before starting Phase C

These are the things that, if answered differently, change the
implementation:

1. **Where does the OG fetch run?** tRPC procedure (synchronous, easy) vs
   background job with optimistic optimistic UI (more complex, smoother).
   Default: tRPC procedure, debounced from the client. Revisit if the
   3-second budget feels too long in real network conditions.
2. **Cache lifetime.** In-memory LRU with no TTL means a stale `og:image`
   sticks until process restart. Sane Phase C default: 24h TTL.
3. **What to do when fetch fails.** Silent (member fills manually) or
   surface an inline notice? Default: silent failure with a small "Fetch
   metadata" button next to the URL field as a manual retry.
4. **Pre-fill conflict policy.** Empty fields fill from OG; non-empty
   stay. But what about the link-preview card's own title/desc/image
   columns (`linkTitle`, `linkDescription`, `linkImageUrl`,
   `linkSiteName`)? Default: those are the OG fetch's home; the
   composer's title/body fields are independent (member's commentary).

---

## Definition of done (per phase)

- Phase A: URL field is first; live preview renders; reactionsless / hero
  / kind selectors all still work; tests green; lint + typecheck clean.
- Phase B: Detection works on Chrome / Safari with clipboard permission
  granted; degrades silently elsewhere; new e2e covering the
  detected-URL flow.
- Phase C: OG fetch service has unit tests (SSRF guards, parse, cache);
  composer integration has e2e covering paste-→-fill; service runs inside
  the existing tRPC layer-boundary rules.

---

## Open questions surfaced (for user)

- Phases A and B are unblocked; Phase C is blocked on D066 acceptance and
  the OG-fetcher build (which itself is a non-trivial BU). Confirm Phase
  A first, then we sequence B and C.
- Today the composer requires a title. The link-first vision implies title
  could become optional once OG pre-fill exists (member just pastes URL +
  comment). Worth a follow-up product call before Phase C lands.
