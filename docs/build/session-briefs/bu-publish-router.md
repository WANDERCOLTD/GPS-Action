---
slug: bu-publish-router
status: shipped
shipped_in: '#146'
phase: 2
priority: high
note: 'Brief landed in #142 (D072). Phase 1 implementation shipped in #146. Phases 2 (bu-drafts-inbox — bundles autosave + /drafts page) and 3 (bu-reviewer-kind-review-queue) are separate BUs that build on this foundation.'
---

# SESSION BRIEF · bu-publish-router — universal pre-publish modal + post lifecycle

_Brief version: 0.1 · Author: Paul (via Claude) · Date: 2026-04-28_

This brief is **Phase 1 of three** for the publish-router work designed in
D072. Phase 1 ships the schema, the universal modal, autosave, the
three-tier review attribution surfaces, and reroutes the existing
`tick_or_cross` flow through the new system. Phase 2 (`bu-drafts-inbox`)
and Phase 3 (`bu-reviewer-kind-review-queue`) are separate BUs.

---

## Why this exists / why now

`<SendToNetworkConfirm />` (D069) is a single-purpose modal bolted on
to one PostKind. Five other kinds want non-trivial publish-time actions
of their own. Authors also need draft-saving, send-for-review, and
discard at publish time — across **every** kind, not just one.

D072 picked the architecture: orthogonal `Post.status + reviewRequestId`
flags, four config columns on `PostKind`, a single generic
`RequestType: 'kind_review'` with priority inherited from the kind, a
code-side action registry, Pattern A modal layout, three-tier review
attribution via the reviewer's avatar.

This BU implements Phase 1 of that decision.

---

## Objective

Replace `<SendToNetworkConfirm />` with `<PostPublishModal>` — one
universal pre-publish modal used by every PostKind. Add the post
lifecycle schema (`Post.status`, `Post.publishedAt`,
`Post.reviewRequestId`, `Post.reviewedByUserId`) and the per-kind
config (`PostKind.actionSlugs`, `reviewMode`, `canSelfPublish`,
`reviewPriority`). Wire client-only-then-server autosave with a calm
"Saved" indicator and a 10-second-undo discard snackbar. Register
`share_to_gps_whatsapp` as the first kind-specific action handler so
tick_or_cross authors get an end-to-end behaviour-equivalent flow
through the new modal. Render the three-tier review attribution
(badge / sub-byline / auto-comment) wherever a published post has
`Post.reviewedByUserId` set.

Success looks like: tap Publish on any compose form → universal modal
opens with cards in the order D072 §5 specifies → tap any card →
correct action fires (publish / publish-with-kind-action / send-for-
review with optional also-publish / save-as-draft / discard-with-undo).
Tick_or_cross's existing 80%-path (auto-clipboard + open WhatsApp +
confirm) is preserved as the kind-specific action handler. Saved
drafts persist; the drafts indicator shows; discarded drafts can be
undone within 10s. Posts with `reviewedByUserId` render the badge in
the feed, sub-byline on detail, and pinned auto-comment in the thread.

---

## Scope

### Build in this session

**Schema (Prisma migrations, idempotent per D070):**

- `prisma/migrations/<TS>_add_post_lifecycle/` — adds:
  - `Post.status` enum (`draft | published`), default `draft`, with
    backfill `UPDATE Post SET status = 'published' WHERE deletedAt IS NULL`
    so existing rows are correctly classified
  - `Post.publishedAt DateTime?` — backfilled from `Post.createdAt` for
    rows where the new `status = 'published'`
  - `Post.reviewRequestId String? @unique` FK → `Request.id`
  - `Post.reviewedByUserId String?` FK → `User.id`
  - Indexes: `(status, publishedAt DESC)` for feed queries
- `prisma/migrations/<TS+1>_add_postkind_publish_router_config/` — adds:
  - `PostKind.actionSlugs String[]` default `[]`
  - `PostKind.reviewMode` enum default `either_with_default_publish`
  - `PostKind.canSelfPublish Boolean` default `true`
  - `PostKind.reviewPriority` (uses existing `RequestPriority`) default `normal`
  - Idempotent UPDATE statements seeding the values from D072 §2 table
    (`ON CONFLICT (slug)`-equivalent — match by slug, set the four columns)
- `prisma/migrations/<TS+2>_add_request_type_kind_review/` — adds value
  `kind_review` to the `RequestType` enum
- `prisma/migrations/<TS+3>_add_comment_system_kind/` — adds:
  - `Comment.systemKind` enum (`null | post_review_attribution`), nullable
- `prisma/migrations/<TS+4>_add_publish_router_system_settings/` —
  idempotent INSERT for the four `SystemSetting` rows from D072 §8

**Schema discipline:** all migrations are additive, idempotent
(ON CONFLICT DO NOTHING for new rows; UPDATE … WHERE for column
backfill). Existing rows preserve their semantics. No destructive
operations, no breaking changes to existing readers.

**Action registry:**

- `shared/post-kind-actions.ts` (new) — exports
  `POST_KIND_ACTION_REGISTRY: Record<string, PostKindAction>` and the
  `PostKindAction` interface. Phase 1 registers exactly one entry:
  `share_to_gps_whatsapp`. Other slug values referenced in
  `PostKind.actionSlugs` (e.g. `schedule_for_sundown`) have no entry —
  the modal renders them as disabled "Coming soon" cards.
- `shared/post-kind-actions.test.ts` (new) — registry shape + lookup
  tests. Asserts unknown slugs return null cleanly.

**Universal modal:**

- `components/PostPublishModal.tsx` (new) — Pattern A layout per D072 §5.
  Props: `{ post, kindConfig, onPublish, onSendForReview, onSaveDraft,
  onDiscard, onClose }`. Reads `post.kindSlug`, looks up its config in
  `kindConfig`, resolves `actionSlugs` against the registry, renders:
  - Kind-specific primary card (if any)
  - "Post to feed only" (hidden if `!canSelfPublish`)
  - "Send to reviewers" with inline `Also post to feed` checkbox
  - "Save as draft"
  - "Discard" (small, separate, top-right ✕ position)
  All `data-testid` per F14: `publish-modal`, `publish-modal-{kindSlug}`,
  `publish-modal-action-{actionSlug}`, `publish-modal-discard`.
- `components/PostPublishModal.test.tsx` (new) — render tests for each
  ReviewMode value, the `canSelfPublish: false` hidden-card case, the
  inline-checkbox default state per ReviewMode, and the disabled-card
  rendering for unknown actionSlugs.

**Kind-specific share_to_gps_whatsapp handler:**

- `shared/post-kind-actions/share-to-gps-whatsapp.ts` (new) — handler
  function that wraps the existing message-formatting + clipboard +
  channel-open + sharedToNetwork-confirm logic. Functionally equivalent
  to `<SendToNetworkConfirm />` but called as a registry handler from
  inside `<PostPublishModal>`.
- `components/SendToNetworkConfirm.tsx` — **DELETE** (its logic moves
  into the handler above).
- `app/post/[id]/actions.ts` — `markPostSharedToNetworkAction` stays
  (still called from the new handler).
- Existing `tests/integration/tick-or-cross-create.test.ts` — update
  to assert the new modal-mediated flow rather than the deleted
  `<SendToNetworkConfirm />`.

**Server actions:**

- `app/compose/actions.ts` — refactor:
  - `createPostAction` returns the post id without any kind-specific
    handoff payload (no more `handoff: {...}` return shape)
  - New: `publishPostAction({ postId, alsoCreateReviewRequest? })` —
    sets `status='published'`, `publishedAt=now()`, optionally creates
    a `kind_review` Request and links it via `reviewRequestId`
  - New: `sendPostForReviewAction({ postId, alsoPublishToFeed })` —
    creates a `kind_review` Request, sets `reviewRequestId`, sets
    `status='published'` if `alsoPublishToFeed`
  - New: `saveDraftAction({ postId })` — leaves status at `draft`,
    no review request
  - New: `discardPostAction({ postId })` — soft-delete via `deletedAt`,
    cancels any open review request
  - New: `restorePostAction({ postId })` — reverses a discard within
    the undo window
  - New: `autosaveDraftAction({ postId, fields })` — server-side
    debounced save, no other side effects
- `server/services/post.ts` — extend:
  - `createPost` returns post with `status='draft'` by default
  - New: `publishPost`, `sendPostForReview`, `saveDraft`, `discardPost`,
    `restorePost`, `autosaveDraft` — service-layer functions called
    from the corresponding actions. Each writes appropriate audit log.
- `server/services/request.ts` — extend:
  - New: `createKindReviewRequest({ postId, callerId })` — creates a
    `Request` with `type='kind_review'`, `priority` inherited from
    `PostKind.reviewPriority`, `context.postId` linking back. Returns
    the new request id.
  - New: `closeKindReviewRequest({ requestId, verdict, reviewerId,
    reason? })` — sets request status, applies verdict actions:
    `publish` → flip Post.status, set reviewedByUserId; `reject` →
    leave Post.status='draft', notify originator; `withdrawn` →
    cancel the request.

**Compose form changes:**

- `components/PostForm.tsx` — refactor (the form is currently ~1066
  lines after BU-link-first-composer / PR #135 landed; this BU
  preserves all of that BU's work):
  - **Preserve** the `prefilledLinkUrl` / `prefilledTitle` props
    and their initialisation paths — the FAB starter card (#135)
    feeds these via `?linkUrl=` / `?title=` query params on
    `/compose`
  - **Preserve** the IntentBanner / KindPickerSheet / kind-chip
    flow that `PostForm` already runs (intent switching, kind
    rail, etc.)
  - **Remove** inline handoff handling (`handoff` state,
    `<SendToNetworkConfirm />` mount, the `result?.handoff` branch
    in `handleSubmit`)
  - **Replace** `handleSubmit`: persist the form state as a draft
    (autosave already handles this once content exists), then open
    `<PostPublishModal>` with kind config loaded from props. The
    modal owns the publish/save/review/discard verbs from there.
  - **Add** the autosave hook: `useAutosaveDraft(postId, fields)`
    — IndexedDB-first per D072 §8. Initial server-promote happens
    at publish-tap if it hasn't already, so the modal always has a
    real `postId` to act on.
  - **Add** saved-indicator: `<DraftSavedIndicator state={'editing' | 'saved' | 'failed'} lastSavedAt={Date} />`
    in the form header
  - **Add** tap-to-reveal menu on the indicator: View all drafts
    (Phase 2 link placeholder for now — disabled but visible) +
    Discard draft (opens confirm sheet, on confirm fires
    `discardPostAction` + shows undo snackbar for 10s via
    `discard_undo_window_seconds` setting)
- `components/DraftSavedIndicator.tsx` (new) — three states +
  reveal-menu. Plain copy: `Editing…` / `Saved` / `Couldn't save · Retry`
- `components/DiscardConfirmSheet.tsx` (new) — 2-step confirm
- `components/UndoSnackbar.tsx` (new) — bottom-of-screen, configurable
  duration, calls back on Undo or auto-fires real action on timeout

**Autosave plumbing:**

- `shared/autosave/indexeddb-cache.ts` (new) — thin wrapper over
  IndexedDB, debounced 500ms, namespaced per-postId-or-temp-id. Falls
  back to in-memory if IndexedDB is unavailable.
- `shared/autosave/use-autosave-draft.ts` (new) — React hook that ties
  IndexedDB-cache to server-promote (after 60s inactivity) to
  server-only autosave (after promote). Reads cadence settings from
  the server-rendered SystemSettings (passed via prop).
- `tests/unit/use-autosave-draft.test.ts` (new) — fake-timer tests for
  the three-stage gradient.

**Three-tier review attribution:**

- `components/UserAvatar.tsx` (new) — `{ userId, size, displayName? }`,
  renders `<img src={avatarUrl}>` if present, else initials in a
  calm-tinted circle. Reused throughout this BU and beyond.
- `components/ReviewedByBadge.tsx` (new) — wraps `<UserAvatar>` with
  the 1.5px ring + optional 6px ✓ overlay. Tooltip via `title`/`aria-label`. 
  Tap-to-scroll behaviour (anchors to `#post-${postId}-review-comment`).
- `components/PostCard.tsx` — add `<ReviewedByBadge>` rendering when
  `post.reviewedByUserId !== null`, in the byline row next to existing
  badges.
- `app/post/[id]/page.tsx` — add sub-byline rendering with larger
  badge + reviewer name + tap-to-scroll.
- `components/CommentItem.tsx` — render `systemKind ===
  'post_review_attribution'` comments with system-author styling +
  reviewer's avatar as the comment avatar (closing the badge↔comment
  loop). Anchor id `post-${postId}-review-comment`.
- Auto-comment creation: `closeKindReviewRequest` with verdict=`publish`
  inserts a `Comment` with `systemKind='post_review_attribution'`,
  `body="Sharon helped review and shape this post."` (or equivalent —
  reviewer's displayName interpolated). Author cannot delete (UI rule
  enforced in `Comment` permissions); admin can delete.

**Compose-page glue:**

- `app/compose/page.tsx` — pass kind config to PostForm. Existing
  required-PostKind-slugs check (D070) stays. Add server-rendered
  SystemSettings for autosave cadence (server-side read once per page
  render, not in the form's render path).

### Deliberately out of scope

- **Drafts inbox UI** (`/drafts` page, drafts list with In-review pills)
  → BU-drafts-inbox (Phase 2). Phase 1 stores drafts but they're only
  reachable via the compose form's "View all drafts" disabled
  placeholder link.
- **Reviewer-side queue UI** (browse `kind_review` requests, click-
  through to act) → BU-reviewer-kind-review-queue (Phase 3). Phase 1
  creates the requests; reviewers can't act on them yet beyond the
  existing generic Request infrastructure.
- **Other kind-specific actions** (`schedule_for_sundown`,
  `share_to_socials`, `open_activist_mailer`, `add_to_calendar`,
  `open_join_link`) — Phase 1 reserves the slug names in
  `PostKind.actionSlugs` but their handlers are unimplemented. The
  modal renders them as disabled "Coming soon" cards. Each is a
  separate BU (`BU-action-cultural-schedule`, `BU-action-link-share-
  socials`, etc.) when its kind needs it.
- **Cross-device draft sync** — IndexedDB-first means Sharon's draft
  on her phone isn't visible on her laptop until first server-promote.
  Acceptable per D072 §8.
- **Real-time review-status notifications** — the existing notification
  infrastructure is reused; no new channel work.
- **Per-region action overrides** — the join-table option (D072 §4) is
  reserved for a future migration. Phase 1 uses the array column
  approach exclusively.
- **`<SendToNetworkConfirm />` deprecation shim** — it's deleted
  outright. No file remains. Existing tests are updated, not
  parallel-routed.
- **Autosave: stage 1 only.** D072 §8 calls for a three-stage
  gradient (client-only IndexedDB → server-promote-after-inactivity
  → server-only-autosave-thereafter). Phase 1 ships **stage 1 only**:
  the IndexedDB cache wrapper, the `useAutosaveDraft` hook, and the
  `<DraftSavedIndicator>` mounted in the compose form's header. So
  refresh-during-compose now restores the typed text (loss prevented),
  and members see "Editing… → Saved · 2s" honestly. Stages 2 and 3
  (the server-side autosave) land in `bu-drafts-inbox` (Phase 2)
  alongside the `/drafts` recall surface, because server-side
  autosave without a way to come back to drafts is invisible work.

---

## Contracts to honour

- **Layer boundaries** (CLAUDE.md):
  - `shared/post-kind-actions.ts` lives in `/shared`, no server imports
  - `server/services/*` only call into `/server/db` + `/server/lib` +
    `/shared`
  - `app/compose/actions.ts` → `/server/routers` (types) + `/server/services`
    (implementation) — same pattern as today
- **D070** — every new reference-data row (`SystemSetting` keys, the
  PostKind config values) ships in idempotent migrations. Seed-script
  upserts updated to match for fresh-DB consistency.
- **D068** — brief lifecycle: PR title uses `BU-publish-router` and
  flips `status: shipped` + `shipped_in: "#NNN"` on this brief at PR
  open time per the brief-status gate. Lowercase `bu-` until then.
- **D062 §2** — alert orthogonality preserved. `urgency` stays a Post
  flag independent of status/review.
- **F14 testid rule** — every interactive element has `data-testid`.
- **Honest copy (CLAUDE.md voice)** — "Saved" only on successful save;
  "Send to reviewers" not "Submit for moderation"; "Reviewed by Sharon"
  not "Approved". `Discard` is destructive — confirm + undo.
- **Per-PR PATCH version bump** — main is currently 0.2.7 (or higher);
  bump to next patch.
- **Schema is contract-locked** — schema changes require ADR (D072 is
  that ADR). Any deviation from D072's column shape must update D072.

---

## Tests

**Unit:**

- `shared/autosave/use-autosave-draft.test.ts` — fake-timer covering
  client-debounce, server-promote-on-inactivity, server-only-after-
  promote
- `components/PostPublishModal.test.tsx` — Pattern A render correctness
  per ReviewMode value × `canSelfPublish` boolean × actionSlugs
  presence; disabled-card rendering for unknown slugs
- `components/UserAvatar.test.tsx` — image-when-present, initials-when-
  absent, sizing variants
- `components/ReviewedByBadge.test.tsx` — rendering + tooltip + tap-to-
  scroll anchor target
- `shared/post-kind-actions.test.ts` — registry lookup, unknown slug
  handling

**Integration:**

- `tests/integration/post-lifecycle.test.ts` — full state machine:
  draft created → autosaved → published → discarded → restored. Plus
  the four (status × reviewRequestId) cells from D072 §1 each verified
  reachable.
- `tests/integration/post-publish-modal-actions.test.ts` — each modal
  action fires the right server action with the right payload
- `tests/integration/kind-review-request-flow.test.ts` — send-for-
  review creates a Request with correct priority (inherited from
  `PostKind.reviewPriority`), close-request updates Post and creates
  the auto-comment when verdict=publish
- `tests/integration/tick-or-cross-create.test.ts` — UPDATED to assert
  the modal-mediated flow (not the deleted `<SendToNetworkConfirm />`)

**Manual smoke (DoD):**

- Compose tick_or_cross → publish modal opens → tap "Post & share to ✅
  on GPS WhatsApp" → message clipboard, channel opens, return + confirm
  → post in feed with sharedToNetwork pill (existing behaviour)
- Compose any other kind → publish modal opens with appropriate cards
  per ReviewMode
- "Send to reviewers" → request created, post stays draft (or also
  publishes if checkbox ticked)
- "Save as draft" → status=draft, no Request, drafts indicator
  reflects "Saved · just now"
- "Discard" → confirm sheet → snackbar → tap Undo → restored. Wait 10s
  → soft-deleted for real.
- Post with `reviewedByUserId` set → badge in feed, sub-byline on
  detail, pinned auto-comment in thread
- Tap badge → page scrolls to auto-comment

---

## Risks / known gotchas

- **Autosave rate-limit at scale.** At 5,000 concurrent authors with
  30s cadence, that's ~170 writes/sec — non-trivial. Tunable via
  `autosave_interval_seconds` SystemSetting. Mitigation: aggressive
  debouncing + server-side fingerprint check (skip writes if fields
  unchanged).
- **IndexedDB quota.** Browser quotas vary; very long drafts could hit
  limits. Catch and fall back to in-memory.
- **Race: discard + autosave.** User taps Discard, autosave fires
  mid-discard → discard wins (server-side check: discardPostAction
  marks deletedAt; subsequent autosave checks `deletedAt IS NULL` and
  no-ops).
- **Race: undo + autosave.** Same race in reverse. Server-side
  `restorePostAction` clears `deletedAt`; subsequent autosaves resume.
- **Modal opened before postId exists.** If autosave hasn't promoted
  yet by publish-tap, the form first server-promotes to get a postId,
  then opens the modal. UX: brief loading state on the modal trigger.
- **Reviewer edits + originator edits collide.** Phase 1 doesn't
  support concurrent editing — author sees their post is locked to
  edits while in review (UI: "In review — edits paused" indicator).
  Conflict resolution if edge case (originator hard-refreshes during
  review) → server-side check on edit, return 409 with reviewer-name
  message. Documented in DoD.
- **Existing tick_or_cross posts** in dev/seed databases — they have
  `Post.signal` set but no review request. They retain their existing
  visual (signal badge + sent-pill). New posts created via the new
  modal can additionally render the review badge if reviewed.
- **Comment.systemKind nullability** — existing Comment rows are
  unaffected; `systemKind = null` is the default. Reading code that
  doesn't know about systemKind continues to work.
- **F14 testids on dynamic content** — kind-specific action cards have
  `data-testid="publish-modal-action-{actionSlug}"` so the actionSlug
  is part of the testid. Tests reference by the slug they care about.
- **Brief-status gate** — keep brief filename lowercase `bu-publish-
  router.md` until the PR opens, then flip status: shipped on merge.
- **#135 integration.** BU-link-first-composer (PR #135) shipped
  before this brief was written. The FAB starter, query-param
  prefill, and `psl`-aware URL normalisation it added stay
  untouched; this BU only refactors PostForm's submit/handoff
  layer. Manual smoke-test that the FAB → starter → prefill →
  PostPublishModal path still works end-to-end as part of DoD.

---

## Definition of done

- All migrations apply cleanly to a fresh DB (`prisma migrate deploy`).
  Idempotency proven: re-running on a partially-migrated DB no-ops
  correctly.
- `npm run typecheck && npm run lint && npm test && npm run trace:check`
  all pass locally.
- `npm run check:reference-data` (D070 gate) still passes.
- Smoke tests above all manually verified.
- `<SendToNetworkConfirm />` is deleted, no orphan imports.
- Tick_or_cross flow demonstrably equivalent to before this BU.
- The three-tier attribution renders in dev for at least one manually-
  reviewed post.
- `<UserAvatar />` renders correctly for users with and without
  `avatarUrl`.
- D072 referenced from every new file's `@spec` comment header.
- Brief flipped to `status: shipped` and `shipped_in: "#NNN"` set on PR
  open per D068. `npm run trackers` re-run to refresh `bu-sequence.md`.
- Two new scenarios filed in `docs/product/scenarios.md`:
  - SCN-NN — Sharon publishes a tick_or_cross post via the new modal
  - SCN-NN+1 — Eddie sends a tick_or_cross to reviewers; Sharon reviews,
    refines, publishes; Eddie sees the badge and the auto-comment

---

## Files this BU touches (summary)

| File                                                                              | Action       | Notes                                                |
| --------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------- |
| `prisma/migrations/<TS>_add_post_lifecycle/migration.sql`                         | new          | Post.status + publishedAt + reviewRequestId + reviewedByUserId |
| `prisma/migrations/<TS+1>_add_postkind_publish_router_config/migration.sql`       | new          | Four PostKind columns + idempotent UPDATEs           |
| `prisma/migrations/<TS+2>_add_request_type_kind_review/migration.sql`             | new          | Enum value                                           |
| `prisma/migrations/<TS+3>_add_comment_system_kind/migration.sql`                  | new          | Comment.systemKind nullable enum                     |
| `prisma/migrations/<TS+4>_add_publish_router_system_settings/migration.sql`       | new          | Four SystemSetting rows                              |
| `prisma/schema.prisma`                                                            | modify       | Match the migration changes                          |
| `scripts/seed.ts`                                                                 | modify       | Update PostKind upserts to set the new columns       |
| `shared/post-kinds.ts`                                                            | (no change)  | Required slugs unchanged                             |
| `shared/post-kind-actions.ts`                                                     | new          | Action registry interface + share_to_gps_whatsapp    |
| `shared/post-kind-actions/share-to-gps-whatsapp.ts`                               | new          | Tick_or_cross handler ported from SendToNetworkConfirm |
| `shared/autosave/indexeddb-cache.ts`                                              | new          | Client-side cache wrapper                            |
| `shared/autosave/use-autosave-draft.ts`                                           | new          | Three-stage gradient hook                            |
| `components/PostPublishModal.tsx`                                                 | new          | Pattern A modal                                      |
| `components/UserAvatar.tsx`                                                       | new          | Reusable avatar with initials fallback               |
| `components/ReviewedByBadge.tsx`                                                  | new          | Avatar-circle badge with tooltip + tap-to-scroll     |
| `components/DraftSavedIndicator.tsx`                                              | new          | Three-state indicator + reveal menu                  |
| `components/DiscardConfirmSheet.tsx`                                              | new          | 2-step confirm                                       |
| `components/UndoSnackbar.tsx`                                                     | new          | Generic snackbar with auto-fire timer                |
| `components/SendToNetworkConfirm.tsx`                                             | **DELETE**   | Logic moves to share_to_gps_whatsapp handler         |
| `components/PostForm.tsx`                                                         | modify       | Open new modal, autosave hook, indicator             |
| `components/PostCard.tsx`                                                         | modify       | Render ReviewedByBadge when reviewedByUserId set     |
| `components/CommentItem.tsx`                                                      | modify       | Render systemKind=post_review_attribution comments   |
| `app/compose/page.tsx`                                                            | modify       | Pass kind config + system settings to form           |
| `app/compose/actions.ts`                                                          | modify       | New server actions per scope above                   |
| `app/post/[id]/page.tsx`                                                          | modify       | Sub-byline with reviewed-by badge                    |
| `server/services/post.ts`                                                         | modify       | New service functions per scope above                |
| `server/services/request.ts`                                                      | modify       | createKindReviewRequest, closeKindReviewRequest       |
| `server/services/comment.ts`                                                      | modify       | Auto-comment creation hook                           |
| `tests/...`                                                                       | new + modify | Per "Tests" section                                  |
| `docs/product/scenarios.md`                                                       | modify       | Two new SCNs                                         |
| `package.json`                                                                    | modify       | PATCH bump                                           |

---

## Promotion notes

After this BU lands, log Phase 2 and Phase 3 as proper briefs ready
to start:

- **`bu-drafts-inbox`** (Phase 2) — `/drafts` page + the server-side
  half of D072 §8 autosave (server-promote on 60s inactivity +
  server-only autosave thereafter), drafts list with in-review pills,
  continue-editing, and discard. Phase 1 already shipped client-side
  IndexedDB autosave + the indicator; Phase 2 extends both ends. Stub
  at `docs/build/session-briefs/bu-drafts-inbox.md` (status:
  planned).
- **`bu-reviewer-kind-review-queue`** (Phase 3) — reviewer-side queue
  UI for pending kind_review requests, click-through to edit-and-
  verdict the post. Brief stub at
  `docs/build/session-briefs/bu-reviewer-kind-review-queue.md` (status:
  planned).

Phase 4+ (kind-specific action handlers — schedule_for_sundown,
share_to_socials, open_activist_mailer, etc.) is a series of small
BUs, each one wiring one entry into the action registry. They're
demand-driven; only ship when a member-facing scenario calls for them.

The decision to ship Phase 1 alone is intentional: Phases 2 and 3 are
each shippable on their own once Phase 1 lands, and reviewers gain
the most value by first observing how Phase 1's UX feels before we
commit to the queue surface design.
