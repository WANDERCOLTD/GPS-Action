---
slug: bu-requests-vetting
status: shipped
shipped_in: "#81"
phase: 2
---
# SESSION BRIEF · BU-requests-vetting — comment thread + audience + @mentions + Notification + flag/edit tiles

_Brief version: 1.0 · Author: Paul (via Claude) · Date: 2026-04-26._

Pairs with **D054** (Request entity), **D055** (per-type role scopes), **D056** (Comment audience model), **D057** (Notifications entity), **SCN-21** (Eddie tracks his vetting), **SCN-22** (Sharon picks up + resolves). Read those first.

Sequencing: Path A continuation per `docs/build/session-briefs/bu-requests-sequencing.md`. **Foundation + urgent are merged**; this BU completes the vetting flow.

---

## Objective

Land **SCN-21 + SCN-22** end-to-end. Eddie tracks his vetting application from submission to "approved · welcome 🤝"; Sharon picks it up, asks clarifying questions visible to Eddie, adds internal notes invisible to Eddie, @mentions Jeremy for sign-off, and resolves with a structured outcome.

After this BU lands, the Requests workspace fully demos the **review loop** alongside the brand-promise alert flow already shipped.

---

## Scope — single bundle, three commits-ish

### 1. Schema additions

Three changes:

**`Comment.requestId` nullable FK** — Comment is currently post-only. To carry Request comments, add a polymorphic FK. Comment continues to belong to either a Post OR a Request (mutually exclusive at the application level; not enforced at DB level beyond nullability).

```prisma
model Comment {
  // ... existing fields ...
  postId    String?  @nullable  // was String non-null; widened
  post      Post?    @relation(...)
  requestId String?
  request   Request? @relation("requestComments", fields: [requestId], references: [id], onDelete: Cascade)
  audience  CommentAudience @default(all)  // already added in BU-requests-foundation
}
```

App-level invariant: exactly one of `postId` / `requestId` is non-null. Service-level filter at create time.

**`Notification` entity** (per D057):

```prisma
model Notification {
  id             String   @id @default(uuid())
  recipientUserId String
  recipient      User     @relation("notificationsReceived", fields: [recipientUserId], references: [id], onDelete: Cascade)
  type           NotificationType
  requestId      String?  // present for request-related notifications
  request        Request? @relation(fields: [requestId], references: [id], onDelete: SetNull)
  fromUserId     String?  // who triggered (mention author / state-change actor)
  fromUser       User?    @relation("notificationsSent", fields: [fromUserId], references: [id], onDelete: SetNull)
  message        String?  // pre-rendered display text
  createdAt      DateTime @default(now())
  readAt         DateTime?
  @@index([recipientUserId, readAt, createdAt])
}

enum NotificationType {
  request_status_changed
  request_mention
  request_resolved
  request_published   // for Send-for-Review approvals (D063)
  request_archived    // ditto
}
```

**`Request.resolution` enum already exists** (`approved | rejected | edited | escalated | dismissed | duplicate | other`). This BU exercises the existing surface; no schema change here. The reviewer composer at resolve-time picks from these.

Single migration, all three changes.

### 2. Server — services + routers

- **`server/services/comment.ts`** (extend) — `listForRequest(requestId, callerId, isReviewer)` filters by audience based on the caller's role. Submitter sees only `audience: 'all'`; reviewers see both.
- **`server/services/comment.ts`** (extend) — `createForRequest(input)` accepts `audience` + parses `@mentions` + emits Notifications.
- **`server/services/notification.ts`** (new) — `listForUser(userId)`, `markRead(notificationId, userId)`, `create(input)` (called by comment service when @mention parsed; called by request service on state transitions).
- **`server/services/request.ts`** (extend) — `resolveRequest` already exists from BU-requests-urgent; this BU adds the structured outcome (approved / rejected / etc.) + system-message comment auto-write on every state transition.
- **`server/routers/comment.ts`** (extend) — new procedures: `listForRequest`, `createForRequest`. Existing post-comment procedures stay.
- **`server/routers/notification.ts`** (new) — `list`, `markRead` procedures.
- **Mention parsing utility** (`shared/mentions.ts` or `server/lib/mentions.ts`) — extracts `@displayname` patterns from comment body, resolves to user IDs via fuzzy match. Returns array of `{ userId, displayName }`.

### 3. Client — submitter view + reviewer view

**Submitter view (`/requests` "My requests" section):**
- Each row gains a click-through to a detail panel: comment thread (audience-filtered to `'all'`), status timeline, reply input.
- Reply input creates a Comment with `audience: 'all'` from the submitter side.
- Notification badge in the AppNav `Requests` link when unread notifications exist (read via `notification.list`).

**Reviewer view (`/requests` reviewer queue):**
- Each Request row gains a detail-panel route: `/requests/[id]`.
- Detail panel shows full comment thread (both audiences for reviewers).
- Comment composer with **audience toggle** — radio or dropdown: "Visible to submitter" vs "Internal note".
- @mention autocomplete (basic — typeahead from active users with reviewer roles).
- Status timeline shows every transition with system messages auto-posted by the service.
- Resolve action enhanced — picker for `RequestResolution` enum + optional notes + optional follow-up comment (audience: 'all').

**Notification surface:**
- New `<NotificationDot>` component on the `Requests` nav link in `AppNav` — small red dot with unread count.
- Notifications are SHOWN INSIDE the Requests tab itself (per D057 Option B). When a Request opens, related notifications auto-mark read.
- A separate `<Notifications>` section above "My requests" listing recent unread @mentions and status changes — not a full inbox, just the rolling pulse.

### 4. Tile 9 + Tile 10 — Flag + Suggest an edit

Today both tiles in IntentFab are visually disabled with "coming soon" tooltips. This BU enables them:

- **Flag a problem post** (`tile.key = flag`) → routes to `/flag/new?postId=<id>`. The flag composer is a small form: pick reason from enum (off-topic / harassment / misinfo / sensitive) + free-text context. On submit creates a Request `type=flag` with `context: { flaggedPostId, reason, body }`. The discovery path: tap a post detail → "..." menu → "Flag this post" preserves the postId in the URL.
- **Suggest an edit** (`tile.key = edit_request`) → similar pattern, routes to `/edit-request/new?postId=<id>`. Composer: free-text "what should change". Creates Request `type=edit_request` with `context: { targetPostId, suggestion }`.

Both Request types feed the same reviewer queue per the Foundation BU's polymorphic queue. Reviewers act on them with the same claim/resolve flow this BU is enriching.

### 5. System-message comments on state transitions

Every Request state change (created → claimed → resolved) auto-writes a system comment with `authorId: null` (or a special "system" user) and `audience: 'all'`. So the timeline reads like a chat:

```
[system · 14:21] Eddie submitted this request.
[system · 14:32] Sharon picked up this request.
[Sharon → Eddie · 14:33] Hey Eddie — quick check, can you confirm your postcode?
[Eddie · 14:38] Yes, E1 4DJ. I work near Whitechapel station.
[Sharon → reviewers only · 14:42] Voucher checks out — Sharon Whitfield is verified.
[Sharon · 14:45] @Jeremy can you sign off?
[system · 14:46] Jeremy was mentioned.
[Sharon · 15:01] Approved · welcome 🤝
[system · 15:01] Status: in discussion → done · approved.
```

Implementation note: system comments use a sentinel `authorId` (perhaps a seeded "system" user with `displayName: 'system'`); rendered with a distinct visual style (smaller, grey, no avatar). Audience always `'all'`.

### 6. Seed updates

- Eddie's vetting Request gains a couple of pre-seeded comments for demo richness:
  - System: "Eddie submitted this request"
  - (No reviewer comments yet — Sharon claims live in the demo)
- New seeded `system` user with `displayName: 'system'`, `email: 'system@gps-action.test'`. No role grants.
- Notifications seed: empty (real-time during demo)

---

## NOT in this BU

| Item | Where |
|---|---|
| Send-for-Review button on composer + Publish/Archive on Request | **Next pass on BU-fab-intent-picker** (D063 wiring) |
| Per-entity row list pages on `/data` | BU-admin-crud |
| Admin UI for PostKind / FeatureFlag / SystemSetting edits | BU-admin-crud |
| Time-bound fields on Event / Meeting | Future BU |
| Real-time push notifications | Phase 2 (in-app polling is the MVP) |
| Notification email digest | Phase 2 |
| Notification preferences | BU-account |
| Comment editing / deletion on Requests | Phase 2 (mirrors current Comment-on-Post behaviour) |
| Reactions on Request comments | BU-reactions-comments-on-requests (small follow-up; D050 already polymorphic) |

---

## Files to create / modify

**New files:**

- `prisma/migrations/<ts>_add_request_comments_and_notifications/migration.sql`
- `server/services/notification.ts`
- `server/routers/notification.ts` (registered in `_app.ts`)
- `server/lib/mentions.ts` — `parseMentions(body, candidateUsers)` utility
- `app/requests/[id]/page.tsx` — Request detail panel route
- `app/requests/[id]/actions.ts` — addComment, resolve actions
- `app/flag/new/page.tsx` + `actions.ts` — Flag composer (tile 9)
- `app/edit-request/new/page.tsx` + `actions.ts` — Edit-request composer (tile 10)
- `components/RequestCommentThread.tsx` — list + audience filter
- `components/RequestCommentComposer.tsx` — input + audience toggle + @mention autocomplete
- `components/RequestStatusTimeline.tsx` — system messages render
- `components/NotificationDot.tsx` — unread count badge for the nav
- `components/NotificationsList.tsx` — the rolling "what's new" pulse above My requests
- `tests/unit/notification-service.test.ts`
- `tests/unit/mentions-parser.test.ts`
- `tests/unit/comment-audience-filter.test.ts`
- `tests/integration/request-comment-router.test.ts`

**Modified files:**

- `prisma/schema.prisma` — Comment.postId nullable + Comment.requestId; new Notification model; NotificationType enum
- `shared/validation/comment.ts` — `audience` field; `requestId` discriminator
- `server/services/comment.ts` — listForRequest, createForRequest with audience filter + mention emit
- `server/services/request.ts` — resolve action writes system comment + Notification on state change
- `server/routers/comment.ts` — request-comment procedures
- `server/routers/_app.ts` — register notification router
- `app/requests/page.tsx` — add NotificationsList section + click-through to /requests/[id] for each row
- `components/AppNav.tsx` — NotificationDot on Requests link
- `components/IntentFab.tsx` — enable tiles 9 + 10 (un-disable)
- `eslint-rules/canonical-areas.json` — add `notification` area
- `docs/process/testid-convention.md` — `notification` row
- `scripts/seed.ts` — system user; pre-seeded system-comment on Eddie's vetting

**Removed files:** none.

---

## Acceptance criteria

- [ ] `npm run typecheck && npm run lint && npm test` green
- [ ] `npm run trace:check` passes
- [ ] Migration runs cleanly; existing Comments stay attached to their posts; new Comment.requestId column accepts FKs
- [ ] Eddie can see his vetting Request detail at `/requests/<id>` with comment thread + reply input
- [ ] Sharon's reviewer detail panel shows comment composer with audience toggle
- [ ] Posting a comment with `audience: 'reviewers'` does NOT show in Eddie's view
- [ ] Posting a comment with `@Jeremy` creates a Notification row for Jeremy
- [ ] Jeremy sees a notification badge on the Requests nav link; tapping clears unread
- [ ] State transitions auto-write a system comment to the timeline
- [ ] Resolve picker offers all `RequestResolution` enum values
- [ ] Tiles 9 + 10 in IntentFab are enabled and route to flag / edit-request composers
- [ ] Flag + edit-request submissions create Requests of the right type, surfacing in the reviewer queue
- [ ] D061 tap contract respected (audience toggle is its own tap target; @mention chip in autocomplete is a tap target; etc.)
- [ ] Demo path below works end-to-end

---

## Demo path post-merge

Pre-flight: pull main, `npx prisma migrate deploy`, `npm run db:seed`, restart dev.

**Submitter side (Eddie):**

1. Log in as **Eddie** at `/dev/login`
2. `/requests` → see "My requests (1)" — vetting application — `new` status
3. Tap the row → detail panel opens
4. Comment thread shows: "(system) Eddie submitted this request"
5. Status timeline shows: created · waiting for review

**Reviewer side (Cary, who has unscoped queue_manager — sees all types):**

6. Log in as **Cary** at `/dev/login`
7. `/requests` → reviewer queue shows Eddie's vetting at the top
8. Tap row → detail panel opens
9. Tap **Claim** → status becomes `claimed`; system comment auto-posts: "Cary picked up this request"
10. Compose comment "Eddie — confirm your postcode?" with audience: **'all'** → submit
11. Compose internal note "Voucher checks out" with audience: **'reviewers'** → submit
12. Compose comment "@Bette can you sign off?" → Bette receives notification
13. Tap **Resolve** → resolution picker → pick `approved` + note "Approved — welcome" → submit
14. System comment: "Status: claimed → resolved · approved"

**Submitter side (Eddie returns):**

15. Switch back to Eddie → `/requests`
16. Detail panel now shows:
    - "(system) Eddie submitted this request"
    - "Cary picked up this request"
    - "Cary: Eddie — confirm your postcode?"
    - (internal note from Cary NOT visible)
    - "Cary: Approved — welcome"
    - "(system) Status: claimed → resolved · approved"
17. Notification badge clears once detail panel is opened

**Bette (admin, was @mentioned):**

18. Bette logs in → Requests nav link shows red dot
19. Tap → notification list shows "Cary mentioned you in Eddie's vetting"
20. Tap notification → goes to Eddie's vetting detail panel; notification marks read

**Tile 9 — flag a post (any member):**

21. Eddie taps a post in /feed → "..." menu → "Flag this post"
22. Composer pre-fills `postId`; reason picker + free-text context
23. Submit → Request `type=flag` lands in Cary's queue
24. Cary claims, resolves with `approved` (flag was valid) or `dismissed` (not a real issue)

**Tile 10 — suggest an edit:**

25. Same pattern. Routes via the IntentFab "Suggest an edit" tile or via post-detail "..." menu.

---

## D055 / D056 / D057 in code

- **D055** — every reviewer procedure uses `requireRole('queue_manager:vetting')` (or unscoped `queue_manager`). The detail panel respects scope: if Cary has only `queue_manager:flag` she can claim flag Requests but not vetting. Already enforced at the foundation BU; this BU exercises it via the demo with a scoped user.
- **D056** — `Comment.audience` filter is the headline feature. Service filters at query time; reviewer composer offers the toggle; submitter composer hard-codes `audience: 'all'`.
- **D057** — Notification entity is created here. @mention parser + state-transition writer are the two emit paths. In-app delivery surfaces in `<NotificationsList>` + `<NotificationDot>`. Mark-read is a server action.

---

## Confirmed design calls (resolved during brief review, 2026-04-26)

1. **`@mention` parser** — **Option A: fuzzy match against `displayName`**. With current seed users (5–8 unique names) collisions can't happen. Username-style strict matching (`@sharon-w`) parked for when member count hits ~50.
2. **System-comment author identity** — seeded `system` user (simpler; renders muted with no avatar). Future ADR can convert to nullable `authorId` if needed.
3. **Comment-on-Post audience filter** — Request-only. Post comments stay public-by-design. Extending audience to Post comments is parked.
4. **Flag/Edit-request post-selection UI** — composer asks for post URL or ID free-text in MVP. Post-detail "..." menu enabling tiles 9/10 contextually is a Phase 2 nice-to-have.
5. **Notification fanout** — one Notification per @mention, no aggregation. Revisit if spam emerges.

## Parked items (added to `docs/product/parking-lot.md` alongside this BU)

- **Username system for collision-safe @mentions** — add `User.username String? @unique` + onboarding step to pick handle. Trigger: member count ~50 OR first reported wrong-mention.
- **Post-comment audience model** — extend D056 audience toggle to Post comments. Trigger: a real use case where author + reviewers want internal notes on a published Post (e.g. coordinator-only annotations).
- **Contextual flag/edit composer launchers** — disable FAB tiles 9/10 globally; surface them via post-detail "..." menu where `postId` is implicit. Trigger: usage data shows members guessing post IDs / pasting wrong URLs into the free-text MVP composer.

---

## Effort

Per the original sequencing brief: **~2–2.5 sessions, ~1800 LOC**. This is the largest BU this quarter — more entity changes (Notification + Comment polymorphism) and more UI surfaces (detail panel, audience toggle, autocomplete, notification list, two new composer routes).

Realistic split into commits:

1. Schema + Notification service + mention parser (~1 session)
2. Reviewer detail panel + comment composer with audience toggle + state-transition system messages (~1 session)
3. Submitter detail panel + notification surface + tiles 9/10 wiring + seed updates + tests (~half-session)

---

## Related

- D054 — Request entity
- D055 — Per-type role scopes (the reviewer queue filters by these)
- D056 — Comment audience model (the schema this BU consumes)
- D057 — Notifications entity (the schema this BU implements)
- D058 — Urgent flag (already shipped — this BU's @mentions and notifications work for urgent Requests too)
- D061 — Global tap interaction pattern
- D063 — Send-for-Review (a deferred tile follow-up, but content_submission Requests created via that path will benefit from this BU's comment thread + audience model)
- SCN-21 / SCN-22 — the scenarios this BU finishes
- `docs/build/session-briefs/bu-requests-sequencing.md` — Path A continuation (foundation + urgent are merged)
- working-rhythm.md — session discipline
