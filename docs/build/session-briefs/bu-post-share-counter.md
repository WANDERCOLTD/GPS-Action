---
slug: bu-post-share-counter
status: planned
phase: 2
priority: medium
note: "Spec assembled 2026-05-01. All 8 open decisions resolved. Build splits into 4 sequential BUs (foundation, verified-send, counter UI, polish). Ready to start any time."
---

# SESSION BRIEF · bu-post-share-counter — Verified per-post share counts (4-phase plan)

_Brief version: 1.0 · Author: Paul (via Claude Session N) · Date: 2026-05-01_

---

## Objective

Verified share counts per post, broken down by channel, visible to
members. Counts come from a "Did you send?" follow-up after each
share-button tap (the existing `PostPublishModal` pattern lifted out
and reused on the share rail).

The headline number is **verified** (a row whose `confirmedAt` is
non-null). Intent (the un-confirmed tap) stays visible inside the
breakdown tooltip so the count is honest, not inflated. Members get
to see their reach without anxiety-inducing badges.

---

## Why now

Today's share buttons fire `post_shared_out` analytics to stdout —
no persistence, no counter, no visible signal of reach. With the
WhatsApp brand glyph + horizontal reaction row + post-detail polish
all just shipped, the share rail is now visually anchored and ready
to grow a counter affordance. Members get to see their reach without
anxiety-inducing badges.

The "Did you send it?" prompt already exists inline on the
`PostPublishModal` (the tick_or_cross publish flow); extracting it
into a reusable `<ShareConfirmDialog />` is a matter of lifting code,
not designing copy.

---

## Out of scope (parked)

- **Coordinator-level Amplification reach dashboard** — separate
  parking-lot item using these counts as input. Not part of this BU.
- **Per-user attribution publicly visible.** `userId` is stored but
  never appears in any public response shape. The personal "you've
  shared this" indicator is the only viewer-specific surface.
- **Logged-out viewer counts.** Counter is hidden from logged-out
  viewers; server-side gate.
- **Backfill of historical share-intent stdout logs.** Counts start
  empty on migration day. The honest baseline.

---

## 4-phase plan

The brief organises around four sequential, individually shippable
phases. Each can be its own BU PR; together they assemble the full
counter.

### Phase 1 — Foundation (~½ day)

- ADR-0003 / D077 for the new `PostShare` table.
- Schema columns: `id, postId, userId, destination (enum), intentAt,
  confirmedAt?, createdAt, updatedAt`.
- Forward-only additive migration; cascade delete on Post / User.
- Replace `/api/analytics/share-intent` stdout stub with a real DB
  write (upsert on `(postId, userId, destination)`).
- New service `server/services/post-share.ts` exposing:
  - `recordIntent({ postId, userId, destination })`
  - `recordConfirmed({ postId, userId, destination })`
  - `getShareCounts(postId)` → `{ total, perChannel }`
- Existing share buttons unchanged in UX; just write to DB now.

### Phase 2 — Verified-send (~½–1 day)

- Extract `<ShareConfirmDialog />` from `PostPublishModal` —
  kind-agnostic, reusable, accepts `onConfirm / onDeny / onSkip`
  callbacks.
- Wire to `WhatsAppShareButton` plus future `XShareButton` /
  `InstagramShareButton` / `FacebookShareButton`.
- Use Page Visibility API (`document.visibilitychange`) to detect
  return-from-external-app and surface the dialog at that moment.
- Honest copy: "Did you send it?" → "I sent it" / "Not yet" / "Skip".
- "I sent it" → flips `confirmedAt`. "Not yet" / "Skip" → leaves the
  intent row, dismisses the dialog.

### Phase 3 — Counter UI (~½ day)

- New `<ShareCountPill />` component — `↗ 47` style, on PostCard's
  bottom row alongside reactions.
- Tap pill → tooltip / inline expand with per-channel breakdown.
- Hide when `total = 0` (honest empty state).
- Server: extend `listPosts` and `listUpcoming` to include
  `shareCounts: { total, perChannel }`. **Single aggregated query,
  no N+1.**
- Post-detail page gets the richer breakdown (bar-chart-style).

### Phase 4 — Polish (~½ day)

- Author personal indicator on the author's own view of their post:
  *"↗ Your post — shared 47 times across 4 channels · You shared on:
  WhatsApp · X"*.
- Empty + loading skeleton states.
- Update `docs/product/analytics-events.md` — `post_shared_out`
  event gains `intent_or_confirmed: 'intent' | 'confirmed'` property.
- Optional: `/me/impact` member-stats summary surface (could spin out
  as its own BU).

---

## Resolved decisions (verbatim, accepted defaults)

These eight decisions are baked into the brief. No further
clarification needed before build.

1. **Idempotency:** One row per `(user, post, destination)` —
   upsert with `confirmedAt = max(existing, new)`. Counts of *people*,
   not *taps*.
2. **Display threshold:** Show pill when `total > 0`. Honest, no
   popularity floor.
3. **userId privacy:** Raw `userId` stored. Aggregates-only public
   exposure. Powers the personal "you've shared this" indicator only.
4. **Destination enum:** Strict — `whatsapp | x | instagram |
   facebook | email | copy_link | other`. Matches existing
   `post_shared_out` analytics enum.
5. **Headline number:** Verified-only
   (`COUNT WHERE confirmedAt IS NOT NULL`). Intent total revealed in
   tooltip / expand for transparency.
6. **"Skip" handling:** "Not yet" + "Skip" both leave the intent
   row as-is; no extra flag. Counter only counts confirmed; intent
   number is accurate tap-count regardless.
7. **Logged-out visibility:** Counter hidden from logged-out viewers.
   Server-side gate.
8. **Abuse / bot protection:** Soft 30-second rate limit per
   `(user, post, destination)`. UX-invisible; kills accidental
   double-fires.

---

## Scope

### Build in this BU (across the four phases)

- **Schema (Phase 1):** `prisma/schema.prisma` — new `PostShare`
  model + `ShareDestination` enum (per ADR-0003 / D077).
- **Migration (Phase 1):** New additive migration in
  `prisma/migrations/` creating the table, the enum, and the indexes.
- **Service (Phase 1):** `server/services/post-share.ts` — new.
  Exports `recordIntent`, `recordConfirmed`, `getShareCounts`,
  `getShareCountsForPosts`.
- **Router endpoint (Phase 1):** `app/api/analytics/share-intent/route.ts`
  — replace stdout stub with DB write via the service. Backwards-
  compatible payload.
- **Dialog (Phase 2):** `components/share/ShareConfirmDialog.tsx` —
  extracted from `PostPublishModal`. The modal continues to use it
  inline.
- **Visibility hook (Phase 2):** `components/share/useReturnFromShare.ts`
  — wraps the Page Visibility API for the share-confirm flow.
- **Share buttons (Phase 2):** `WhatsAppShareButton` (+ future
  X/IG/FB siblings) wire up the dialog; existing styling unchanged.
- **Pill (Phase 3):** `components/share/ShareCountPill.tsx` — new.
- **PostCard wiring (Phase 3):** add the pill to the bottom row,
  alongside reaction count.
- **Post detail (Phase 3):** richer breakdown panel beneath the share
  rail.
- **Author indicator (Phase 4):** `components/share/AuthorShareSummary.tsx`
  — new. Conditional render on `post.authorId === viewer.id`.
- **Tests:** unit + integration + component coverage per phase
  (see Test plan below).
- **Docs:** `docs/product/analytics-events.md` (update event row);
  `docs/architecture/decision-log.md` (D077 entry); `docs/adrs/0003-…`
  (ADR file).

### Do NOT touch

- `Post` schema. Counter rides on a sidecar table; `Post` is unchanged.
- `User` schema (FK only).
- `PostPublishModal`'s outer flow — we extract the dialog component;
  the modal's tick_or_cross publish flow continues unchanged.
- Existing reactions / comments wiring — pill sits alongside, not
  inside.

### Out of scope for this BU

- Coordinator amplification dashboard (parking-lot).
- `/me/impact` cross-post member summary (Phase 4 mentions; could
  spin out).
- WhatsApp Business API verified-send — D016 says self-dispatch via
  copy-and-deeplink, no Business API.
- X / Instagram / Facebook actual share buttons — Phase 2 wires the
  dialog into them; the buttons themselves are pre-existing or land
  in adjacent BUs.

---

## Contracts

### Inputs consumed

- `Post` from Prisma (id, authorId, visibility).
- `User` from Prisma (FK only).
- Existing `WhatsAppShareButton` props/contract.
- `PostPublishModal`'s "Did you send?" copy + state machine
  (extracted, not changed).

### Outputs produced

- `POST /api/analytics/share-intent` — body
  `{ postId, destination }`. Writes `PostShare` row. Returns
  `{ ok: true }` or `{ ok: false, reason }`.
- `POST /api/analytics/share-confirm` — body
  `{ postId, destination }`. Sets `confirmedAt` on the matching row.
- `getShareCounts(postId)` from the service — `{ total, perChannel,
  intentTotal }`.
- `listPosts` / `listUpcoming` projection adds `shareCounts: { total,
  perChannel }`.
- `<ShareConfirmDialog />` component, kind-agnostic, exported from
  `components/share/`.
- `<ShareCountPill />` component, exported from `components/share/`.
- `<AuthorShareSummary />` component, exported from `components/share/`.

---

## Acceptance criteria (per phase)

### Phase 1 — Foundation

- [ ] Tapping any share button writes a `PostShare` row with
      `intentAt` set.
- [ ] Re-tapping within 30s does NOT create a duplicate row (rate
      limit).
- [ ] Re-tapping after 30s does NOT create a duplicate row for the
      same `(user, post, destination)` — upserts the existing row.
- [ ] `/api/analytics/share-intent` returns 200 on success, 400 on
      invalid destination.
- [ ] Stub stdout logging removed.
- [ ] `getShareCounts(postId)` returns `{ total: 0, perChannel: {} }`
      for an empty post.

### Phase 2 — Verified-send

- [ ] Tapping a share button → external app opens → user returns →
      "Did you send?" dialog appears.
- [ ] "I sent it" → server records `confirmedAt`.
- [ ] "Not yet" → row stays as intent, dialog dismisses.
- [ ] "Skip" → row stays as intent, dialog dismisses, no flag set.
- [ ] Dialog appears once per share-tap, not on subsequent reloads.
- [ ] Existing `tick_or_cross` `PostPublishModal` flow unaffected
      (it already had this dialog inline; the extraction must not
      break it).

### Phase 3 — Counter UI

- [ ] Counter pill renders on PostCard when `total > 0`; hidden
      when `total === 0`.
- [ ] Tapping the pill reveals the per-channel breakdown.
- [ ] Logged-out viewers see no counter (server-side gated).
- [ ] `listPosts` includes share counts in response (single
      aggregated query, no N+1 — verified by query count assertion
      in integration test).
- [ ] `/post/[id]` page shows the expanded breakdown.

### Phase 4 — Polish

- [ ] Author personal indicator shows on the author's own view.
- [ ] "You shared on" channel list reflects the current user's
      confirmed shares.
- [ ] Counter updates within 5s of a confirmed share (cache
      invalidation).
- [ ] Empty + loading skeleton states render correctly.
- [ ] `post_shared_out` analytics catalogue updated with the
      `intent_or_confirmed` property.

---

## Permission matrix

| Action                         | Logged-out | Member | Author of post | Coordinator | Director |
| ------------------------------ | ---------- | ------ | -------------- | ----------- | -------- |
| Tap share button (write intent)| —          | ✓      | ✓              | ✓           | ✓        |
| Confirm a share                | —          | ✓      | ✓              | ✓           | ✓        |
| See aggregate counter pill     | —          | ✓      | ✓              | ✓           | ✓        |
| See per-channel breakdown      | —          | ✓      | ✓              | ✓           | ✓        |
| See "you shared on …" indicator| —          | ✓ (own)| ✓ (own)        | ✓ (own)     | ✓ (own)  |
| See per-user share lists       | —          | —      | —              | —           | —        |

Per-user listings are intentionally absent — D047 (honest tracking,
no inflated reach) and the privacy stance in resolved decision #3.

---

## UI states

| State                | Trigger                        | What user sees                                      |
| -------------------- | ------------------------------ | --------------------------------------------------- |
| Pill hidden          | `total === 0`                  | No pill on PostCard                                 |
| Pill visible (idle)  | `total > 0`                    | `↗ 47`                                              |
| Pill expanded        | Tap on pill                    | Tooltip / inline panel with per-channel breakdown   |
| Dialog after share   | Page Visibility return-event   | "Did you send it?" + 3 buttons                      |
| Dialog dismissed     | Skip / Not yet / Confirm tap   | Pill animates by +1 if Confirm, otherwise no change |
| Author personal      | Viewer is post author          | "↗ Your post — shared N times…"                     |
| Loading              | First render, counts pending   | Skeleton pill                                       |

---

## Test plan outline

| Test type             | What                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **Unit**              | `getShareCounts` aggregation logic; 30s rate-limit window; idempotent upsert; channel-totals math   |
| **Integration**       | Full intent → confirm → count flow; counts respect post visibility filter; logged-out viewer gets no counter data; query-count assertion to prevent N+1 |
| **Component**         | `<ShareCountPill />` renders/hides at threshold + tooltip expands on tap; `<ShareConfirmDialog />` "I sent it" / "Not yet" / "Skip" branches |
| **E2E manual**        | Walk SCN-28, SCN-29, SCN-30 end-to-end                                                              |
| **Privacy assertions**| Logged-out request returns no counter data; userId never appears in any public response shape      |

---

## Scenarios to verify against

- **SCN-28 — Sharon-shares-then-confirms** (Phase 1 + 2)
- **SCN-29 — Eddie-sees-impact** (Phase 3)
- **SCN-30 — Bette-views-her-own-post** (Phase 4)

Each scenario should be clicked through manually in dev before
declaring the corresponding phase done.

---

## Estimated effort

~2–3 days total, splittable as four sequential BUs:

- `bu-post-share-foundation` (Phase 1)
- `bu-post-share-verified-send` (Phase 2)
- `bu-post-share-counter-ui` (Phase 3)
- `bu-post-share-polish` (Phase 4)

Each phase ships an independent PR; the brief stays the parent
document. Front-matter `status` flips through `planned →
in_progress → shipped` as each phase merges.

---

## Known gotchas

- **Page Visibility API false-positives.** Members switching tabs
  for unrelated reasons should not see "Did you send?" appear out of
  context. Gate the dialog on a recent `intent` write (within ~60s).
- **Cache staleness.** Counts on `listPosts` are cached; confirming
  a share must invalidate the relevant entry within ~5s. Use the
  existing tRPC invalidation pattern.
- **Aggregation N+1 risk.** `listPosts` already iterates posts; the
  share-count projection must use a single GROUP BY join, not a
  per-post lookup. Integration test asserts query count.
- **Rate-limit clock skew.** 30-second window is server-clock-relative;
  client retries within the window are silently absorbed (200 OK with
  `noop: true`), not 429'd.
- **Author self-share.** Bette sharing her own post counts toward
  the public aggregate. There is no "exclude author" rule — actual
  reach is real.

---

## Open questions to surface

These are *not* blockers — the resolved-decisions section above
covers all eight pre-build questions. New questions that may surface
mid-build:

- Should the per-channel breakdown sort by count (highest first) or
  by enum order (whatsapp → x → instagram → facebook → email →
  copy_link → other)? Default: by count.
- Should the author personal indicator hide when `total === 0` (no
  shares yet)? Default: yes — match the public pill behaviour.
- Should `/me/impact` ship in Phase 4 or as its own BU? Default:
  separate BU.

If a session reaches one of these and Paul isn't around, default
as noted; surface the choice in the PR description.

---

## Definition of done (for the parent BU once all four phases ship)

- [ ] All four phase PRs merged.
- [ ] `status: shipped` + `shipped_in: "#NNN, #NNN, #NNN, #NNN"` in
      this brief's front-matter.
- [ ] D077 in `decision-log.md` flipped from `decided` (already on
      ship) to remain as the canonical reference.
- [ ] `npm run trackers` re-run to refresh `bu-sequence.md`.
- [ ] All three SCN scenarios click-through verified in dev.
- [ ] Privacy assertions held: no `userId` in any public response
      shape across the entire feature.

---

## Context

- Feature spec: parking-lot section "1-click social sharing —
  CRITICAL FEATURE" (will become §3.31 in v0.6).
- Decisions: D016 (self-dispatch via copy/deeplink, no Business API),
  D047 (honest tracking — no inflated reach), D067 (the existing
  WhatsApp share analytics stub this brief replaces with real
  persistence).
- ADR-0003 / D077 — the schema decision for `PostShare`.
- Existing share buttons: `components/share/WhatsAppShareButton.tsx`
  and the share rail in `components/post/PostCard.tsx` /
  `app/post/[id]`.
- Existing dialog source: `components/post/PostPublishModal.tsx`
  (the `tick_or_cross` publish flow's "Did you send?" branch).
