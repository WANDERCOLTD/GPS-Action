# SESSION BRIEF · BU-whatsapp-share — analytics slice + reconciliation note

_Brief version: 1.0 · Author: Paul (via Claude) · Date: 2026-04-27_

This brief lands **after** PR #111 (`feat(share): WhatsApp lead +
socials rail on PostCard and detail page`, BU-share-rail-on-detail).
That PR shipped the affordance — the green WhatsApp button on the
PostCard right rail and the lead pill on the post detail page. Its
component files (`@spec build/session-briefs/bu-whatsapp-share.md`)
already reference this brief as if it existed; this PR fills that gap
and adds the analytics slice that #111 left unwired.

The wider product spec for share-out lives in
`docs/product/share-out-mechanics.md`; the deliberate divergences from
that spec are recorded in **D067** (this BU's ADR).

---

## Why this exists / why now

The "WhatsApp-replacement loop" is the product. Sharon's reflex on
seeing a useful post is "I'll send this to North London." PR #111
made that motion possible — one tap on the green WhatsApp button
pre-fills a `wa.me` message with title + body + post URL. But the
catalogued `post_shared_out` analytics event still points at a
hypothetical future `app/components/ShareMenu.tsx` and never fires
in production. We have no signal on whether members are using the
new affordance.

This brief closes that gap: a stub server endpoint + a sendBeacon
ping from `<WhatsAppShareButton>` so every WhatsApp tap emits the
catalogued event with `destination: 'whatsapp'`.

---

## Objective

Wire `<WhatsAppShareButton>` (shipped in #111) to fire the catalogued
`post_shared_out` event on click, served by a stub server endpoint
that hashes the post id before logging. Update the analytics catalogue
to reflect the actual firer. Record the deliberate omissions (no
DispatchEvent persistence, no Routes table, no return-confirmation
prompt) in D067 so BU-share-out can reconcile them later.

Success looks like: log in as Eddie → tap any WhatsApp button on the
feed or detail page → server stdout shows
`[ANALYTICS] post_shared_out destination=whatsapp post_id_hash=…`.
No raw post id appears in the log.

---

## Scope

### Build in this session

**Component (modify — owned by BU-share-rail-on-detail in #111):**

- `components/WhatsAppShareButton.tsx` (MODIFY — add `pingShareIntent()`
  helper that fires the analytics event via `navigator.sendBeacon` with
  a `fetch keepalive: true` fallback. Call it from `handleClick` after
  `event.stopPropagation()`. No prop / behaviour changes for callers.
  Add `import * as React from 'react'` so the JSX resolves under
  vitest's `node` env, matching the pattern in `LinkPreviewCard`.)

**Endpoint (new):**

- `app/api/analytics/share-intent/route.ts` (new — POST accepting
  `{ postId: string, destination: enum }`. Validates destination
  against the full catalogued enum (whatsapp, x, email, copy_link,
  other) so BU-share-out can extend without a contract change.
  Hashes `postId` via SHA-256 → base64url → first 12 chars before
  logging. Stub sink: logs to stdout with prefix
  `[ANALYTICS] post_shared_out`. Returns `{ ok: true }` on success,
  400 on invalid input.)

**Tests:**

- `tests/integration/share-intent-route.test.ts` (new — 6 cases:
  happy path, postId is hashed not logged raw, non-JSON rejected,
  missing postId rejected, unknown destination rejected, all
  catalogued destinations accepted)
- `tests/unit/whatsapp-share-button-analytics.test.tsx` (new — 4
  cases: still stops propagation, beacon fires with correct payload,
  fetch fallback when sendBeacon refuses, fetch fallback when
  navigator has no sendBeacon)

**Docs:**

- `docs/product/analytics-events.md` (MODIFY — `post_shared_out`
  "Fired from" line points at `WhatsAppShareButton.tsx` (this BU)
  with a forward note to BU-share-out's future ShareMenu. Adds a
  "Server endpoint" line.)
- `docs/architecture/decision-log.md` (APPEND — D067 records the
  divergences from share-out-mechanics.md)
- `package.json` (PATCH bump 0.1.8 → 0.1.9)
- `docs/architecture/traceability-matrix.md` (auto-regenerated via
  `npm run trace:matrix`)

### Do NOT touch

- `shared/share/whatsapp-url.ts` and `shared/site-origin.ts` — owned
  by #111. No changes.
- `components/PostShareGroup.tsx`, `components/SecondaryCtaRail.tsx`,
  `components/PostCard.tsx`, `app/post/[id]/page.tsx` — all owned by
  #111. No changes.
- `prisma/schema.prisma` — this BU adds no schema. DispatchEvent /
  Routes / return-confirmation belong to BU-share-out and need an ADR.
- `tests/unit/whatsapp-url.test.ts` and `tests/unit/site-origin.test.ts`
  — already shipped by #111. No changes.

### Out of scope (BU-share-out picks these up)

- `Route` table + saved-WhatsApp-groups picker
- `DispatchEvent` schema + state machine
  (`dispatch_initiated → dispatch_confirmed → abandoned`)
- "Did you send?" return-confirmation prompt
- X / Instagram / Facebook **firing** of `post_shared_out` (the rail
  exists in `<SecondaryCtaRail>` but those buttons do not yet ping
  the endpoint; future work, same shape as this PR)
- UTM tagging on outbound URLs
- Real analytics sink (the stub logs to stdout — replaced by the
  proper sink in BU-share-out)
- `post_type` property on the event (the catalogued event lists it,
  but the demo slice does not look up the post to populate it; D067
  records this)

---

## Contracts

### Inputs consumed

- `<WhatsAppShareButton>` props (already defined by #111 — `postId`,
  `postTitle`, `postBody`, `variant`)
- `post_shared_out` event row in `docs/product/analytics-events.md`

### Outputs produced

- `POST /api/analytics/share-intent` accepting
  `{ postId: string, destination: 'whatsapp' | 'x' | 'email' |
  'copy_link' | 'other' }` → `{ ok: true }` on success, 400 on
  invalid input. **Stable contract** for BU-share-out to extend.

---

## Acceptance criteria

- [ ] Tapping the WhatsApp button (compact or pill variant) on any
      surface fires exactly one `post_shared_out` event with
      `destination: 'whatsapp'`
- [ ] Server endpoint logs to stdout with the post id one-way hashed;
      raw id never appears in the log
- [ ] Endpoint rejects non-JSON, missing postId, unknown destination
      with HTTP 400 and does not log
- [ ] Endpoint accepts all catalogued destinations (forward-compat
      with BU-share-out)
- [ ] Click handler still stops propagation (D061 — body-tap on
      PostCard does not fire)
- [ ] sendBeacon used when available; fetch fallback with
      `keepalive: true` survives the navigation away to WhatsApp
- [ ] `npm run typecheck && npm run lint && npm test &&
      npm run trace:check` all green
- [ ] `package.json` PATCH bumped per `docs/process/versioning.md`

---

## Tests required

- Unit: ping fires correctly, stops propagation, sendBeacon → fetch
  fallback paths
- Integration: endpoint validation, hashing, all destinations

Not required:

- E2E with real WhatsApp delivery (manual)
- DOM rendering tests (vitest env is `node`; established pattern is
  to invoke component as a function and walk ReactElements)

---

## Scenarios to verify against

`docs/product/scenarios.md`:

- **SCN-01** (Sharon sees a Sky News bias post and boosts it) — every
  tap of the new green button now produces a server-side analytics line
- **SCN-19** (Sharon shares a Guardian article) — same instrumentation
  applies to link-share posts

---

## Known gotchas

- The shipped `<WhatsAppShareButton>` does not currently
  `import * as React from 'react'`. Adding it is required for vitest's
  `node` env to resolve JSX in tests; matches the pattern already used
  in `LinkPreviewCard.tsx`. No production-build impact (Next.js'
  automatic JSX runtime handles it).
- sendBeacon throws in some restricted contexts (file:// origins,
  some service worker contexts). The try/catch + fetch fallback is
  defensive, not theoretical.
- The endpoint logs to stdout because no analytics sink exists yet.
  When BU-share-out lands a real sink, this endpoint becomes a thin
  pass-through; the contract stays stable.

---

## Definition of done

- [ ] All files in "Build" list created or modified per scope
- [ ] All files in "Don't touch" list untouched
- [ ] D067 appended to `docs/architecture/decision-log.md`
- [ ] `npm run typecheck && npm run lint && npm test &&
      npm run trace:check` all green
- [ ] `package.json` PATCH bumped
- [ ] PR description summarises the slice + links this brief + D067 +
      PR #111 (the parent affordance PR)
- [ ] Manual: tap any WhatsApp button → check `npm run dev` server
      stdout shows the analytics line

---

## Open questions to surface

None blocking. Surface if encountered:

- Whether the analytics catalogue's `post_type` property should be
  populated by adding a small post-lookup in the endpoint (deferred
  to BU-share-out per D067 because it costs a DB query per share).
- Whether to wire the X / IG / FB buttons in `<SecondaryCtaRail>` to
  the same endpoint in this PR (proposed answer: no — separate slice,
  same shape, different commit).

---

## Related

- PR #111 (BU-share-rail-on-detail) — the affordance this BU
  instruments
- D067 — this BU's ADR
- `docs/product/share-out-mechanics.md` — the parent spec both BUs
  intentionally narrow
- `docs/product/analytics-events.md` — `post_shared_out` event row
- D061 — global tap interaction pattern (the click handler respects
  it via `stopPropagation()`)
- BU-share-out (future) — reconciles every divergence in D067
- Memory: `project_share_taxonomy` — share = socials rail (X/IG/FB)
  + WhatsApp (larger, separate, adjacent). Both fire the same
  `post_shared_out` event with different `destination` values.
- Memory: `project_ios_standalone_constraint` — `wa.me` universal
  link works in iOS standalone mode without a native share-sheet API
