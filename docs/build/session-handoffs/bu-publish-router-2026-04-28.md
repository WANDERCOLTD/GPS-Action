# Session handoff — bu-publish-router (Phase 1)

**Date:** 2026-04-28 (afternoon session)
**Branch:** `feat/bu-publish-router-20260428` (worktree at `.claude/worktrees/publish-router/`)
**Last commit:** `de97d81` — feat(bu-publish-router): schema foundation — Post lifecycle, PostKind config, kind_review (v0.2.13)
**Pushed to origin:** ✅ yes

The next session reads this handoff **and** the brief at
`docs/build/session-briefs/bu-publish-router.md`. Both are needed for
context.

---

## Current state

### What's shipped on this branch

| File | Status |
|---|---|
| `prisma/schema.prisma` | ✅ All D072 fields added — `Post.{status, publishedAt, reviewRequestId, reviewedByUserId}`, `PostKind.{actionSlugs, reviewMode, canSelfPublish, reviewPriority}`, `User.avatarUrl`, `Comment.systemKind`, new enums `PostStatus / ReviewMode / CommentSystemKind`, `RequestType += kind_review`, all relations and indexes. |
| `prisma/migrations/20260428130000_add_publish_router_foundation/migration.sql` | ✅ Single idempotent additive migration; applied cleanly to dev DB; existing 220 posts backfilled `status=published, publishedAt=createdAt`; per-kind config UPDATE statements (D072 §2 table) applied; 4 SystemSetting rows inserted with `ON CONFLICT (key) DO NOTHING`. |
| `scripts/seed.ts` | ✅ PostKind upserts now set the new columns (defensive consistency for fresh-DB seed flows). |
| Test mocks | ✅ 12 test files updated for `User.avatarUrl: null`; 2 test files updated for Post lifecycle fields (`status, publishedAt, reviewRequestId, reviewedByUserId`). |
| `app/requests/page.tsx`, `app/requests/[id]/page.tsx`, `components/RequestRow.tsx` | ✅ Three RequestType label maps gain `kind_review: 'Post review'`. |
| Gates | ✅ typecheck clean, lint 0 errors / 17 pre-existing warnings, 563 tests pass, trace:check passes, D070 invariant intact. |
| `package.json` | ✅ Bumped to v0.2.13. |

### What's NOT yet built (~80% of Phase 1 remains)

Per the brief's "Build in this session" section:

- ❌ Action registry — `shared/post-kind-actions.ts` + `shared/post-kind-actions/share-to-gps-whatsapp.ts`
- ❌ Universal modal — `components/PostPublishModal.tsx`
- ❌ Avatar component — `components/UserAvatar.tsx`
- ❌ Review badge — `components/ReviewedByBadge.tsx`
- ❌ Indicator + sheets + snackbar — `DraftSavedIndicator`, `DiscardConfirmSheet`, `UndoSnackbar`
- ❌ Autosave plumbing — `shared/autosave/indexeddb-cache.ts`, `use-autosave-draft.ts`
- ❌ New server actions — `publishPostAction`, `sendPostForReviewAction`, `saveDraftAction`, `discardPostAction`, `restorePostAction`, `autosaveDraftAction`
- ❌ Service-layer functions — `publishPost`, `sendPostForReview`, `saveDraft`, `discardPost`, `restorePost`, `autosaveDraft`, `createKindReviewRequest`, `closeKindReviewRequest`
- ❌ Auto-comment creation — Comment with `systemKind='post_review_attribution'` on review-publish
- ❌ `PostForm.tsx` refactor — preserve #135's prefill (per the brief commit `04aeedf` on PR #142), remove handoff state, replace handleSubmit, add autosave hook, add saved-indicator
- ❌ `<SendToNetworkConfirm />` — DELETE (logic moves into the share_to_gps_whatsapp handler)
- ❌ `app/compose/page.tsx` — pass kind config + system settings to form
- ❌ `app/post/[id]/page.tsx` — sub-byline with reviewed-by badge
- ❌ `components/PostCard.tsx` — render ReviewedByBadge when `post.reviewedByUserId` set
- ❌ `components/CommentItem.tsx` — render `systemKind=post_review_attribution` with system-author styling + reviewer's avatar
- ❌ Tests — new unit + integration tests per the brief
- ❌ Two new scenarios — SCN-NN, SCN-NN+1 in `docs/product/scenarios.md`

---

## CRITICAL: Two things to do FIRST in the next session

### 1. Rebase onto Prisma 7 main

This branch was based on `origin/main` at `eda7b3d` (Prisma 5 era). Main has since moved to Prisma 7 (commit `ccf6256`, PR #140). Before continuing, rebase:

```bash
cd /Users/paulwander/projects/gps-action/.claude/worktrees/publish-router
git fetch origin
git rebase origin/main
```

Expect conflicts in:

- `prisma/schema.prisma` — datasource block. **Take main's version** (Prisma 7 hard-rejects `url = env(...)` inline; main has it removed; mine still has it).
- `package.json` — version + Prisma deps. Take main's deps (Prisma 7 + `@prisma/adapter-pg` + `pg`); keep my version bump (or rebump on top of main's current value).
- Possibly `prisma/migrations/migration_lock.toml` — should be benign.

After rebase, run:

```bash
npm install              # pull Prisma 7 deps
npx prisma migrate deploy  # ensure migration still applies
npx prisma generate      # regen client (Prisma 7 client)
npm run typecheck        # any Prisma 7 API breaks?
npm test                 # 563 tests should still pass
npm run check:reference-data  # D070 invariant
```

If `prisma/schema.prisma` validation breaks under Prisma 7, the `prisma.config.ts` file (introduced by #140) handles the URL — schema.prisma stays without `url = env(...)`. My migration SQL is version-agnostic and should apply unchanged.

### 2. Renumber D071 → D072 in this branch's commit

The foundation commit (`de97d81`) was authored before the parallel session merged the Prisma 7 PR (#140) which claimed `D071`. PR #142 has been updated to call this BU's ADR `D072` (commit `f4a57de` on `docs/d071-publish-router`). My foundation commit's content is currently silent on D071/D072 (the commit message alone references "D071"), but **future commits in this branch must reference D072**, not D071.

The brief on PR #142 already uses D072 throughout. When PR #142 merges into main and I later rebase, Phase 1's references will line up.

If any new file headers or comments need adding in subsequent commits, use `D072` (not `D071`).

---

## Suggested next-session sequence

1. Pull this handoff + read the brief at `docs/build/session-briefs/bu-publish-router.md` (will be on main after #142 merges; until then read from the worktree).
2. Rebase per "CRITICAL #1" above. Resolve conflicts. Verify gates green.
3. Build commits in this order (per the brief):
   1. **Action registry + UserAvatar** (foundation pieces, small)
   2. **Server actions + service functions** (server-side; tests added inline)
   3. **PostPublishModal + DraftSavedIndicator + sheets/snackbar + ReviewedByBadge** (UI components; tests inline)
   4. **Autosave plumbing** (`shared/autosave/*` + hook tests)
   5. **PostForm refactor + delete SendToNetworkConfirm** (this is where #135 integration matters most)
   6. **Page integrations** (compose page glue, PostCard, post detail, CommentItem)
   7. **Auto-comment creation in service** (final hook)
   8. **Scenarios + final polish + version bump**

Each step a separate commit per CLAUDE.md "commit per logical chunk". Bump version on each PR-bound commit.

4. Final: open the PR with title `feat(BU-publish-router): post lifecycle + universal publish modal + three-tier review attribution (vX.Y.Z)`. Per D068, flip the brief's `status: shipped` and add `shipped_in: "#NNN"` on PR open. Run `npm run trackers` to refresh `bu-sequence.md` AUTOGEN regions.

---

## Known gotchas / risks (from the brief, surfaced for the next session)

- **PostListItem extension.** The feed's PostListItem interface (in `server/services/post.ts`) currently doesn't include `reviewedByUserId` or `reviewedBy.{id, displayName, avatarUrl}`. The PostCard badge needs them. **Extend PostListItem in commit 6 (page integrations)** when refactoring the feed.
- **Autosave + discard race.** Server-side: `discardPostAction` sets `deletedAt`; subsequent `autosaveDraftAction` checks `deletedAt IS NULL` and no-ops. Implement defensively.
- **Modal opened before postId exists.** If autosave hasn't promoted yet by publish-tap, the form first server-promotes to get a postId, then opens the modal. Brief loading state on the trigger.
- **Reviewer-edit + originator-edit collision.** Phase 1: author edits paused while in review. UI: "In review — edits paused" badge. Server-side check on post-update returns 409 with reviewer name if originator tries to edit a draft that has an open review request.
- **Comment.systemKind nullability.** Existing rows are unaffected. `systemKind = null` is the default. Reading code that doesn't know about systemKind continues to work.
- **F14 testid rule.** Every interactive element added gets `data-testid`. Modal action cards: `data-testid="publish-modal-action-{actionSlug}"`. Indicator: `data-testid="draft-saved-indicator"`. Etc.

---

## Open PRs at handoff time

| PR | Status | Notes |
|---|---|---|
| **#142** | OPEN — D072 rename pushed (`f4a57de`) | Awaiting merge. Phase 1 expects this to land before its own PR opens. |
| **This branch** (`feat/bu-publish-router-20260428`) | Pushed but no PR opened yet | Open the PR at the END of Phase 1 build, not now. The branch holds only foundation commits. |

---

## What I would have done next if context allowed

The action registry + UserAvatar are the right next step — small, foundation pieces, both reusable. Then server actions. Then the modal. Then autosave. Then PostForm refactor (the trickiest integration with #135's existing changes). Then page integrations. Then auto-comment + scenarios + polish.

Estimated remaining work: 3-4 hours of focused build, ~8 commits.
