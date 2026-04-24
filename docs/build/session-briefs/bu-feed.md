# SESSION BRIEF · BU-feed — Feed page + Post router + realistic seed

*Brief version: 1.0 · Author: Paul · Date: April 2026*
*Refined from v0.9 after BU-001-lite executed. Key refinements:*
*- Context shape confirmed (`ctx.user`, `ctx.activeRoles`)*
*- `publicProcedure` + `authedProcedure` helpers available*
*- Seed file is `scripts/seed.ts` (extend, don't create)*
*- Lib → DB boundary; all DB work in services*
*- Prefer type narrowing over `!` assertions*

---

## Objective

Build the feed — the core demo page. Eddie logs in, lands on `/feed`,
sees realistic posts from the 5 seeded users, and encounters "Open in
Activist Mailer" buttons on posts that have AM URLs. This is the
**visible centrepiece** of the demo.

Success looks like: visit `/feed` (or `/` redirects to it), see 15-20
posts newest-first, each with author + timestamp + title + body +
optional AM link button. "Load more" at the bottom extends the list.
Different seeded posts showcase the range — urgent action calls,
quiet cultural moments, news shares, event announcements.

---

## Scope

### Build in this session

**Server — data layer (services):**
- `/server/services/post.ts` (new — `listPosts()` with visibility
  filtering + cursor pagination)

**Server — router layer:**
- `/server/routers/post.ts` (new — tRPC `postRouter` with `.list()`
  procedure via `publicProcedure`)
- `/server/routers/_app.ts` (MODIFY — register `post` router)

**Client:**
- `/app/feed/page.tsx` (new — server-rendered feed list)
- `/app/page.tsx` (MODIFY — redirect to `/feed` for authenticated
  users; show "please log in" for unauthed)
- `/components/feed/PostCard.tsx` (new — single post rendering)
- `/components/feed/FeedList.tsx` (new — list wrapper with pagination)
- `/components/feed/LoadMore.tsx` (new — client component for "load
  more" button)
- `/components/feed/EmptyFeed.tsx` (new — empty state)

**Seed data extension:**
- `/scripts/seed.ts` (MODIFY — extend with 15-20 realistic posts
  across the 5 existing seed users; stays idempotent)

**Tests:**
- `/tests/integration/post-list.test.ts` (new — list procedure across
  all visibility + pagination scenarios)
- `/tests/unit/post-service.test.ts` (new — service-layer filtering)
- `/tests/integration/feed-flow.test.ts` (new or combined — end-to-end:
  seed → list → verify shape)

**Docs:**
- `/CLAUDE.md` (MODIFY — tiny note: `/feed` is the default landing for
  authenticated users)

### Do NOT touch

- `/prisma/schema.prisma` — no schema changes; Post exists with
  required fields
- `/server/lib/auth.ts`, `/server/services/auth.ts`,
  `/server/services/audit.ts` — BU-001-lite infrastructure; use don't
  modify
- `/server/lib/trpc.ts` — `publicProcedure`, `authedProcedure`,
  `requireRole` all in place; use as-is
- `/server/routers/context.ts` — context factory stays; don't modify
- `/server/routers/dev.ts` — dev-only; leave alone
- `/app/dev/**` — BU-001-lite territory
- `/app/layout.tsx` — already has `<LoggedInAs />`; feed page doesn't
  need layout changes
- `/components/auth/LoggedInAs.tsx` — don't modify
- `/eslint.config.js` — F06 rules apply
- ADRs, decision-log.md — no new decisions needed
- Every file under `/docs/` except CLAUDE.md

### Out of scope for this session

- **Post creation** — BU-composer (next session)
- **Post editing / deletion UI** — BU-020 post-demo
- **Comments, reactions, attachments** — ERD Slice 2 full, post-demo
- **Filter by group / type / author / region** — post-demo
- **Real-time updates / polling** — chronological static is fine
- **Infinite scroll** — "Load more" button is the MVP pattern
- **Image rendering in post body** — Phase 2
- **Markdown rendering** — plain text with preserved line breaks
- **Share / boost / dispatch UI on cards** — post-demo
- **Moderation affordances (flag, report)** — BU-009 post-demo
- **Accessibility audit beyond basics** — WCAG pass is a later dedicated
  session
- **Feed personalisation / algorithmic ranking** — chronological only
- **Detail page per post** — no individual post URL for MVP
- **"Read more" expansion to detail page** — just show full body
  inline; if body is long, card is tall (acceptable for MVP)

---

## Contracts

### Inputs consumed

- `/prisma/schema.prisma` — Post, PostVisibility, User models
- `/server/lib/trpc.ts` — `publicProcedure`, `authedProcedure`,
  `router`, `TRPCContext`
- `/server/routers/context.ts` — how context populates
- `/server/services/audit.ts` — exists; NOT called (reads don't audit)
- `/server/db/client.ts` — Prisma client import path
- `/scripts/seed.ts` — existing 5 users + role grants; extend additively
- `/docs/product/post-creation-flow.md` — what a post feels like
  (noting D048 supersession on type list)
- `/docs/product/design-philosophy.md` — honest copy, quiet tone,
  cultural moments
- `/docs/product/scale-and-audience.md` — the real scale context
- `/docs/architecture/decision-log.md` — D045 (visibility defaults),
  D048 (type deferred)
- `/styles/tokens.css` — design tokens (reuse, don't invent)

### Outputs produced

Contracts future sessions rely on:

- **`post.list({ cursor?, limit? })` procedure** — returns posts in
  newest-first order, visibility-filtered, with next cursor
- **`<PostCard />` component** — reusable render; BU-composer uses
  the same shape after creation
- **`<FeedList />` pattern** — future feeds (group feed, my posts,
  author feed) can follow this shape
- **`/feed` route** — canonical feed URL
- **Realistic seed posts** — 15-20 across 5 users, mixed tones

---

## Acceptance criteria

### Functional (click-through verifiable)

- [ ] Log in as Eddie → `/` redirects to `/feed`
- [ ] `/feed` shows 15-20 posts newest-first
- [ ] Each post card shows:
  - Author name and their role (small label if queue_manager/admin)
  - Timestamp (relative — "2 hours ago", "yesterday", "last week")
  - Title
  - Body (full text, preserved line breaks, no truncation for MVP)
  - "Open in Activist Mailer" button IF `activistMailerUrl` is set
- [ ] Clicking "Open in Activist Mailer" opens URL in new tab
  (`target="_blank" rel="noopener noreferrer"`)
- [ ] Not-logged-in users visiting `/feed` see "Please log in" with a
  link to `/dev/login`
- [ ] "Load more" at bottom; clicking appends older posts; hides when
  no more posts
- [ ] Visibility filtering: `authenticated_only` posts excluded for
  unauthed callers (no such unauthed access for MVP — but filter
  must be in service layer regardless, enforced by service)
- [ ] Soft-deleted posts (deletedAt NOT NULL) never appear
- [ ] Log in as different users → same feed content (MVP: no
  personalisation)

### Seed requirements

- [ ] Script still idempotent — re-running doesn't duplicate posts
- [ ] 15-20 posts created across the 5 users (distribute evenly:
  3-4 posts per user)
- [ ] At least **40%** of posts have `activistMailerUrl` set to a
  plausible-looking URL (e.g., `https://activistmailer.com/c/abc123`)
- [ ] Timestamps spread across last 2-3 weeks (not all "now")
- [ ] Posts vary in content:
  - 3-4 action calls (send email, sign, click link)
  - 2-3 cultural moments (Shabbat, remembrance, celebration)
  - 3-4 news shares (article + commentary)
  - 2-3 event announcements
  - 1-2 outcome reports
  - 1-2 questions/discussions
- [ ] Posts vary in length (short 50-word + medium 200-word + long
  400+ word)
- [ ] Mix of visibility — most `public`, at least 2 `authenticated_only`
- [ ] `groupTags` — at least a few posts have non-empty groupTags
  (using slugs from existing seeded groups; if no groups exist yet,
  this is empty)

### Non-functional

- [ ] All F06 lint rules pass (header, no PII logs, no z.any, no
  inline auth, feature-flag gates if used)
- [ ] Every new file has `@build-unit BU-feed` JSDoc header
- [ ] TypeScript strict; no `any`; minimise `!` assertions (prefer
  type narrowing); if a `!` is genuinely needed, document why in a
  comment
- [ ] Prettier clean
- [ ] All previous tests still pass + new tests pass (78+ new
  should be 90+)
- [ ] `npx prisma validate` passes (no schema changes expected)
- [ ] Husky hooks pass cleanly
- [ ] No DB imports from `server/lib/` or `server/routers/` (only
  from services)

---

## The list procedure — contract

### Input

```typescript
import { z } from 'zod';

const listInputSchema = z.object({
  cursor: z.string().optional(),  // last post's createdAt + id composite
  limit: z.number().min(1).max(50).default(20),
});
```

### Output

```typescript
{
  posts: Array<{
    id: string;
    title: string;
    body: string;
    activistMailerUrl: string | null;
    visibility: 'public' | 'authenticated_only';
    groupTags: string[];
    createdAt: Date;
    author: {
      id: string;
      displayName: string;
      roles: SystemRole[];  // derived from author's active RoleGrants
    };
  }>;
  nextCursor: string | null;  // null when no more posts
}
```

### Cursor format

Composite: `{createdAt_iso}_{id}` — ensures stable ordering even when
multiple posts share a second. Service parses and uses in `where`:

```typescript
where: {
  deletedAt: null,
  visibility: caller.isAuthenticated
    ? { in: ['public', 'authenticated_only'] }
    : 'public',
  OR: cursor ? [
    { createdAt: { lt: cursorDate } },
    { createdAt: cursorDate, id: { lt: cursorId } },
  ] : undefined,
},
orderBy: [
  { createdAt: 'desc' },
  { id: 'desc' },
],
take: limit + 1,  // fetch one extra to detect "has more"
```

### Authentication

`publicProcedure` — anyone can call, but visibility filtering varies:
- `ctx.user == null` → only `public` visibility
- `ctx.user != null` → `public` + `authenticated_only` both visible

No `authedProcedure` needed — the feed can be read by an anonymous
user (they just see fewer posts). When real auth lands (BU-002), the
public feed may be restricted further; that's a separate decision.

---

## Seed posts — specific content direction

### The 5 authors

- Eddie Morales (member)
- Cary Whitfield (queue_manager)
- Bette Rosenthal (admin)
- Humphrey Kline (member)
- Ingrid Blum (member)

### Example posts to include (adapt language/details)

These are ILLUSTRATIVE. Claude Code invents plausible bodies matching
the shapes below. Keep content generic, avoid referencing real
campaigns or real people.

1. **Eddie — action call** — "Write to your MP re: this week's vote"
   - Body: ~150 words explaining context, asking to send a prefilled
     letter
   - `activistMailerUrl`: `https://activistmailer.com/c/vote-letter-123`
   - visibility: public
   - 2 days ago

2. **Cary — cultural moment** — "Shabbat Shalom"
   - Body: ~60 words, warm tone
   - no AM URL
   - visibility: public
   - last Friday at 3pm

3. **Bette — news share with commentary** — "Guardian piece on community
   organising worth reading"
   - Body: quote a phrase + two paragraphs of reflection
   - no AM URL (the article URL is just inline text in the body)
   - visibility: public
   - 4 days ago

4. **Humphrey — event announcement** — "Community gathering next
   Thursday at 7pm"
   - Body: ~100 words with time, location (invented),
     who to RSVP to
   - no AM URL
   - visibility: public
   - 1 week ago

5. **Ingrid — outcome report** — "42 letters sent — here's the council's
   reply"
   - Body: ~200 words reporting back on a previous action
   - no AM URL
   - visibility: public
   - 5 days ago

6. **Eddie — action call, urgent** — "Council meeting Thursday — 48
   hours to register objection"
   - Body: ~100 words, time-pressure tone
   - `activistMailerUrl`: yes
   - visibility: public
   - 12 hours ago

7. **Cary — authenticated only** — "Internal update for verified
   members"
   - Body: ~80 words
   - no AM URL
   - visibility: authenticated_only
   - 3 days ago

8. **Bette — news share** — second piece, different angle

9. **Humphrey — question** — "Anyone know a good speaker for a March
   panel event?"
   - Body: ~60 words
   - no AM URL
   - visibility: public
   - 1 day ago

10. **Ingrid — cultural moment** — "Remembrance reflection"
    - Body: ~120 words, quieter tone
    - no AM URL
    - visibility: public
    - 10 days ago

11-15. **Mix** — further action calls, one or two longer posts
(400+ words), a post with `groupTags` populated, another
`authenticated_only` post.

### Content DOs and DON'Ts

**DO:**
- Make posts feel real — like they could have been written by
  actual people
- Vary lengths meaningfully (short announcements vs long reflections)
- Use specific-but-invented details (fake council names, fake
  dates, fake organisations)
- Preserve line breaks in body text (use `\n\n` for paragraph breaks)
- Include AM URLs that look plausible (real-ish format, fake path)

**DON'T:**
- Reference real politicians by name (use "our local councillor" or
  "the minister")
- Reference real campaigns (use invented issue names)
- Use real organisation names (keep them generic: "the council",
  "the community centre")
- Use placeholder Lorem Ipsum
- Make every post the same tone (variety is the point)

### Idempotency

The seed script must be safe to re-run. Pattern — each post has a
deterministic ID or unique key:

```typescript
// Option A: hash-based deterministic IDs (preferred)
const postData = SEED_POSTS.map(p => ({
  id: hashToUuid(`post:${p.authorEmail}:${p.title}`),  // deterministic
  ...p,
}));

// Option B: upsert by (authorId, title) — requires unique constraint
```

Option A is cleaner (no schema change needed). Use it.

Claude Code: pick the approach, surface trade-offs if unsure.

---

## The PostCard component — render spec

### Layout (approximately — exact details are design call)

```
┌─────────────────────────────────────────────────────────┐
│  Eddie Morales · 2 hours ago                            │
│                                                         │
│  Write to your MP re: this week's vote                  │
│                                                         │
│  Body text here, preserved line breaks, full content.   │
│  Multiple paragraphs render naturally.                  │
│                                                         │
│  This paragraph break works as expected.                │
│                                                         │
│  [ Open in Activist Mailer ↗ ]                          │
└─────────────────────────────────────────────────────────┘
```

### Component contract

```typescript
interface PostCardProps {
  post: {
    id: string;
    title: string;
    body: string;
    activistMailerUrl: string | null;
    createdAt: Date;
    author: {
      displayName: string;
      roles: SystemRole[];
    };
  };
}
```

- Timestamp uses `date-fns` `formatDistanceToNow(post.createdAt, { addSuffix: true })`
  → "2 hours ago", "yesterday", etc.
- Role label: if `roles` contains `'admin'` or `'queue_manager'`, show
  a small text label next to the author name ("queue_manager" or
  "admin"). Members show no label.
- Body rendering: `<p>` per paragraph, split by `\n\n`; preserve
  single-newlines within paragraphs.
- AM button: only if `activistMailerUrl` present; external link icon
  (from `lucide-react`, which is available per earlier setup); opens
  in new tab with `rel="noopener noreferrer"`.
- No hover state for the whole card (it's not clickable — there's no
  detail page).
- Responsive: works on mobile viewport (narrow) — body text wraps,
  AM button full-width if space-constrained.

### Styling

- Use design tokens from `/styles/tokens.css`
- Card: light border, rounded corners, modest padding
- No shadows (per design-philosophy's "quiet, honest" direction)
- Font scale should match the system — no heroic heading sizes

---

## Known gotchas (v1.0, refined from v0.9)

### Context handling

- Feed query uses `publicProcedure`; read `ctx.user` to determine
  visibility filter. Do NOT use `authedProcedure` — we want
  unauthenticated users to see public posts too.
- `ctx.activeRoles` available on context but not needed for list
  procedure.

### Services boundary

- ALL Prisma queries in `server/services/post.ts` — **never in
  `server/routers/post.ts`**. Router imports from service and calls it.
- If you find yourself reaching for Prisma in the router, stop and
  move the logic to services.

### No audit writes

- Reading posts is NOT audited. Only mutations audit.
- If you catch yourself calling `auditLog()` in the list procedure,
  remove it.

### Cursor pagination edge cases

- Empty feed: return `{ posts: [], nextCursor: null }`
- All posts fetched: `nextCursor` is `null` (not empty string)
- Invalid cursor string: throw `BAD_REQUEST` — don't silently ignore
- Composite ordering prevents ties at `createdAt` second-precision

### Seed idempotency

- Use `prisma.post.upsert` with deterministic IDs
- The `deletedAt` field: seed posts MUST have `deletedAt: null`
- Don't delete posts during re-seed — keeps history stable

### `!` assertions

- BU-001-lite shipped with 4 legitimate `!` assertions (ESLint
  warnings, not errors). Match that pattern:
  - Prefer type narrowing (`if (user) { ... }`)
  - Prefer early returns (`if (!user) throw ...`)
  - Only use `!` where the type system can't see a value is non-null
    but the code has already verified it
  - Add a comment explaining why the assertion is safe

### Server components vs client components

- `/app/feed/page.tsx` → server component; fetches server-side via
  tRPC caller or direct service call
- `/components/feed/PostCard.tsx` → server component (no interaction)
- `/components/feed/LoadMore.tsx` → client component (`'use client'`,
  uses useState for loading, calls tRPC from client)
- `/components/feed/FeedList.tsx` → likely client (hosts LoadMore
  state); or split server+client

### Mock-ish AM URLs in seed

- Use `https://activistmailer.com/c/<slug>` format
- Domain `activistmailer.com` should be in the allowlist
- Slug can be random-ish (no real destinations for seed)

### Timezone / timestamps

- Database timestamps are UTC
- `formatDistanceToNow` from `date-fns` handles rendering
- Don't try to make seed posts look like exact London times; relative
  display handles it

### `date-fns` install

- If not already installed: `npm install date-fns`
- Likely already present for other reasons; check first

---

## Tests required

### Integration (`post-list.test.ts`)

- Returns posts in newest-first order
- Returns empty result when no posts
- Respects `limit` parameter
- Cursor pagination returns next batch correctly
- Excludes soft-deleted posts
- Filters `authenticated_only` for unauthenticated context
- Includes `authenticated_only` for authenticated context
- Returns correct `nextCursor` format; `null` when done
- Returns author object with `displayName` and `roles` populated

### Integration (`feed-flow.test.ts`)

- After seed: list returns the expected count of public posts
- Author roles populate correctly (Bette shows admin, Cary shows
  queue_manager, Eddie shows empty roles array)
- Posts with AM URLs have the field populated; posts without have
  null
- Re-running seed doesn't duplicate

### Unit (`post-service.test.ts`)

- Cursor parser accepts valid cursor, rejects invalid
- Visibility filter logic: unauthed gets only public, authed gets both
- Limit bounds: 1-50, default 20

---

## Open questions to surface

Pre-identified. Claude Code — surface these before major design
decisions.

1. **Feed URL routing.** `/feed` as canonical, `/` redirects when
   logged in? Or `/` is the feed? Recommend: `/feed` canonical,
   redirect at `/` for logged-in users, "please log in" for unauthed.
   Confirm.

2. **Author roles in PostCard — display all or only elevated?**
   Eddie is just a member — show nothing, or show "member" label?
   Recommend: show nothing for plain members; show tiny label only
   for `queue_manager` and `admin` roles. Confirm.

3. **Seed idempotency approach.** Hash-based deterministic IDs vs
   upsert-by-unique-constraint. Recommend: hash-based (no schema
   change). Confirm.

4. **Body rendering — paragraph splitting.** Split on `\n\n` into
   `<p>` elements. Confirm or propose richer markdown.

5. **Empty state when no posts.** Just "No posts yet. [Compose one →]"
   but `/compose` doesn't exist yet. The link would 404 until
   BU-composer. Recommend: show the text but omit the link for now;
   BU-composer adds the link.

6. **`groupTags` in seed — how many groups exist?** Slice 1.5
   introduced Group + GroupMembership. If seeded, use those slugs;
   if not seeded, leave `groupTags: []`. Surface the state.

7. **`date-fns` dep check.** If not in package.json, note the
   install. If it's there, proceed.

8. **Post-to-post vertical spacing.** Design call — generous, medium,
   or tight? Recommend: medium (24-32px between cards). Confirm.

9. **Timestamp format for "very recent" posts.** Under 1 minute →
   "just now"? `formatDistanceToNow` handles this. Confirm no
   override needed.

10. **Load-more behaviour.** Does it REPLACE the list (pagination-
    style) or APPEND (continuous)? Recommend: APPEND. Confirm.

11. **Lucide-react icon for AM button.** Use `ExternalLink` icon.
    Confirm.

12. **Mobile viewport.** Feed tested at 375px width. Body wrapping
    + AM button layout must work. Acceptance: no horizontal scroll
    at 375px. Confirm.

---

## Definition of done

- [ ] All files in "Build" list present; none in "Don't touch"
  modified except `_app.ts` and `CLAUDE.md`
- [ ] `npx prisma validate` passes (no schema changes)
- [ ] `npm run db:generate` succeeds
- [ ] `npm run seed` (or `npx tsx scripts/seed.ts`) creates 15-20
  posts on top of existing 5 users; re-run doesn't duplicate
- [ ] `npm run test` passes (new + existing)
- [ ] `npm run lint` passes with 0 errors (warnings OK; match
  BU-001-lite's pattern — ~4 legitimate `!` warnings)
- [ ] `npm run typecheck` passes
- [ ] `npx prettier --check .` passes (hooks handle)
- [ ] Manual click-through: log in as Eddie → see feed with 15-20
  posts → AM buttons on posts that have URLs → click opens new tab
- [ ] Log in as Bette (admin) → see `authenticated_only` posts too
- [ ] Not-logged-in: visit `/feed` → "please log in" message
- [ ] Every new file has `@build-unit BU-feed` JSDoc header
- [ ] Commit message: `feat(feed): BU-feed — feed page + post router + realistic seed`
- [ ] Branch pushed; PR opened; CI green; merged

---

## Context

**Specs:**
- `/docs/architecture/decision-log.md` D045 (visibility), D048
  (no type field), D041 (region tags), D043 (group tags)
- `/docs/architecture/admin-surface.md` — role model
- `/docs/product/design-philosophy.md` — honest, quiet, varied
- `/docs/product/post-creation-flow.md` — post shape (note D048
  supersession on types)
- `/docs/product/scale-and-audience.md` — scale context
- `/docs/product/scenarios.md` — user journeys
- `/docs/product/copy-library.md` — strings

**Existing code to read first:**
- `/server/lib/trpc.ts` — procedures + middleware already exist
- `/server/routers/context.ts` — context factory
- `/server/routers/_app.ts` — where to register postRouter
- `/server/routers/dev.ts` — pattern to mirror for postRouter shape
- `/server/services/auth.ts` — pattern to mirror for post service
- `/prisma/schema.prisma` — Post, PostVisibility, User
- `/scripts/seed.ts` — existing seed pattern
- `/styles/tokens.css` — design tokens
- `/app/layout.tsx` — existing layout with LoggedInAs
- `/app/dev/login/page.tsx` — pattern for server-component pages

**Process:**
- `/docs/process/session-brief-template.md`
- `/docs/process/session-hygiene.md` — especially brief-ahead section
- `/CLAUDE.md` — operating context
- `/docs/process/api-contract-discipline.md` — tRPC rules

---

## What this brief does NOT cover

1. **Post creation** — BU-composer (next)
2. **Post detail page** — no single-post URL for MVP
3. **Comments, reactions, attachments** — Slice 2 full post-demo
4. **Search** — Phase 2
5. **Group feeds** — post-demo
6. **Notifications about new posts** — post-demo
7. **Bookmarks / saves** — post-demo
8. **Markdown rendering** — plain text only for MVP
9. **Read receipts / view tracking** — post-demo
10. **Real-time updates** — post-demo
11. **Post filters UI** — post-demo

---

## Slice convention

BU-feed is the second Phase 1 (demo path) feature-building session.
Establishes conventions that BU-composer inherits:

- Services hold DB queries; routers orchestrate
- `publicProcedure` for reads that work unauth'd (with visibility
  filter)
- `authedProcedure` for mutations (BU-composer uses this)
- `<PostCard />` is reused by BU-composer's post-submit success
  behaviour
- Seed extends `scripts/seed.ts` additively
- `@build-unit BU-feed` header on every new file

---

## What lands after this session

- Eddie can log in and see a realistic-looking feed
- Range of tones visible — action calls, cultural moments, news
  shares, events, outcomes
- AM buttons work end-to-end (click opens new tab)
- Different users see appropriate visibility filtering
- Half the demo loop complete

Next session: **BU-composer** — Eddie writes a new post, it appears
at the top of the feed. Demo complete.
