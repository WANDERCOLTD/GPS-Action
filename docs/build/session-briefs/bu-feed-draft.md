# SESSION BRIEF · BU-feed — Feed page + Post router + realistic seed

*Brief version: 0.9 (DRAFT — refine after BU-001-lite lands)*
*Author: Paul · Date: April 2026*

---

## Status of this draft

**This is a v0.9 structural brief.** Scope, acceptance criteria, and
key gotchas are in place. It will be refined to v1.0 after
BU-001-lite executes — specifically:

- Confirming the auth context shape that BU-001-lite produces
- Confirming how the `<LoggedInAs />` component integrates
- Learning from any BU-001-lite discoveries about Next 15 / tRPC
  patterns in this project
- Tightening the seed data spec based on what gets built in
  BU-001-lite's minimal seed

Do not execute this brief before it's marked v1.0.

---

## Objective

Build the feed — the core demo page. Eddie logs in, sees a list of
realistic-looking posts from seeded users, can read their content,
and sees an "Open in Activist Mailer" button on posts that have an
AM URL. This is the centrepiece of the demo.

Success looks like: visit `/` (or `/feed`), see 15-20 posts from the
5 seeded users, newest first. Each post shows author, title, body
snippet, timestamp, and optionally an AM link button. Posts are
distinct enough to feel real. "Load more" extends the list.

---

## Scope

### Build in this session

**Server:**
- `/server/routers/post.ts` (new — tRPC router with `.list()` procedure)
- `/server/services/post.ts` (new — business logic: list posts with
  visibility filtering + pagination)
- `/server/routers/_app.ts` (modify — register post router)

**Client:**
- `/app/feed/page.tsx` (new — feed page; probably the default landing
  page for authenticated users)
- `/app/page.tsx` (modify — if currently a placeholder, redirect or
  render feed for logged-in users; keep "please log in" for
  unauthenticated)
- `/components/PostCard.tsx` (new — single post rendering)
- `/components/FeedList.tsx` (new — list wrapper with pagination)
- `/components/ui/Button.tsx` (new or existing — reuse if available
  from a parallel design-system session; otherwise create minimal)

**Seed data (big extension):**
- `/scripts/seed-dev.ts` (modify — extend with Groups + 15-20 realistic
  Posts)
- Posts authored across all 5 users, varying in length, some with AM
  URLs, some without. Content riffing on real-feeling UK Jewish
  community activism scenarios — council votes, letters to MPs, Shabbat
  announcements, event invites, news articles worth reading.

**Tests:**
- `/tests/integration/post-list.test.ts` (new — list procedure with
  various visibility and pagination scenarios)
- `/tests/unit/post-service.test.ts` (new — the service layer's
  filtering logic)

### Do NOT touch

- `/prisma/schema.prisma` — no schema changes
- `/server/lib/auth.ts`, `/server/services/audit.ts` — built in
  BU-001-lite; use but don't modify
- `/server/lib/trpc.ts` — `requireRole` etc. stay as-is; use
  `authedProcedure` or `t.procedure` (public)
- Any files under `/app/dev/` — that's BU-001-lite territory
- Auth and audit infrastructure — reuse only

### Out of scope for this session

- **Post creation** — BU-composer (next)
- **Post editing, deletion UI** — BU-020 post-demo
- **Comments, reactions, attachments** — Slice 2 full post-demo
- **Filter by group / type / author / region** — post-demo
- **Real-time updates / polling** — chronological static list is fine
- **Feed personalisation / algorithmic ranking** — chronological only
- **Infinite scroll** — "Load more" button is enough
- **Image uploads in posts** — deferred per image-handling.md
- **Share / boost / dispatch UI on cards** — post-demo
- **Moderation affordances (flag, report)** — BU-009 post-demo
- **Rich Markdown rendering** — plain text with line breaks is the
  MVP render; Markdown is a nice-to-have
- **Accessibility features beyond basics** — keyboard nav + alt text
  suffice for MVP; formal a11y audit is separate

---

## Contracts

### Inputs consumed

- `/prisma/schema.prisma` — Post, PostVisibility, User
- `/server/lib/auth.ts` — `getCurrentUser`, `authedProcedure`
- `/server/services/audit.ts` — audit service (posts being read
  don't audit, but the service exists)
- `/docs/product/post-creation-flow.md` — what a post feels like
- `/docs/product/design-philosophy.md` — honest copy, quiet tone,
  cultural moments
- `/docs/product/scenarios.md` — verify against SCN-01 (member sees
  feed) if present
- `/styles/tokens.css` — design tokens
- `/docs/architecture/decision-log.md` — D045 (visibility defaults)

### Outputs produced

- **`post.list({ cursor?, limit? })` procedure** — returns posts
  the caller can see, sorted newest first, with next cursor
- **`/feed` route** — the canonical feed URL
- **`<PostCard />` component** — future sessions reuse it
- **`<FeedList />` pattern** — future feeds (group feed, my posts,
  etc.) can follow this shape
- **Realistic dev seed data** — 15-20 posts across 5 users + 3-4 groups

---

## Acceptance criteria

**Will tighten once v1.0 is issued.** For now, v0.9 level:

- [ ] `/feed` renders a list of posts for logged-in users
- [ ] Not-logged-in users see a "Please log in" message with link to
  `/dev/login`
- [ ] Posts sorted newest first
- [ ] Each post card shows: author name, timestamp (relative),
  title, body snippet (truncated at ~200 chars with "Read more"),
  and an "Open in Activist Mailer" link if `activistMailerUrl` is
  set
- [ ] Clicking "Open in Activist Mailer" opens URL in new tab
  (`target="_blank" rel="noopener noreferrer"`)
- [ ] "Load more" button appends older posts (cursor pagination)
- [ ] `authenticated_only` posts hidden from unauthenticated views
  (if any unauthenticated view exists)
- [ ] Deleted posts (deletedAt IS NOT NULL) are excluded
- [ ] Seed produces 15-20 posts across the 5 users
- [ ] At least 30% of seed posts have AM URLs
- [ ] Seed posts span a range of timestamps (not all "now"); spread
  across recent 2 weeks or so
- [ ] Seed posts vary in length and tone (short announcements, long
  reflections, action calls, cultural moments)
- [ ] Empty state: "No posts yet" with a compose link (if compose exists)
- [ ] Loading state: skeleton rows
- [ ] All tests pass; lint + typecheck + prettier clean
- [ ] Every new file has `@build-unit BU-feed` header

---

## Seed posts — content direction

15-20 realistic posts. To be fleshed out in v1.0, but as a rough
shape, the set should include:

- 4-5 action-call posts (click this, send an email to your council /
  MP / school board) — most have AM URLs
- 3-4 cultural moment posts (Shabbat thoughts, Holocaust Memorial
  Day reflection, Chanukah greetings) — no AM URLs
- 2-3 news share posts (article + one paragraph commentary) — may
  have external URLs, not AM ones
- 2-3 event announcements (gatherings, workshops) — no AM URLs
- 1-2 outcome reports ("40 letters sent — the council responded")
  — no AM URLs
- 1-2 questions to the community — no AM URLs

Authored across the 5 users (Eddie, Cary, Bette, Humphrey, Ingrid).
Timestamps spread over last 2 weeks. Content deliberately avoids
referencing real campaigns or real people.

**Tone variety matters.** The demo needs posts that feel *different*
from each other — urgent vs. quiet vs. warm — to show GPS Action
handles range.

---

## Known gotchas (v0.9 — may expand)

- **`PostVisibility` enum handling.** The `authenticated_only` value
  filters out unauthed users. Check that the list query implements
  this correctly.
- **`deletedAt` filtering.** Every feed query must include
  `deletedAt: null`. Don't rely on reader to filter client-side.
- **Cursor pagination** — use createdAt + id as composite cursor,
  not just offset. The brief's v1.0 will specify exact cursor format.
- **`activistMailerUrl` display** — render as a button, not a raw
  URL. Button text: "Open in Activist Mailer" (per design-philosophy
  — honest, descriptive, not "Take Action!" exclamation).
- **Seed idempotency** — posts reference users by ID. If re-running
  seed, upsert by a deterministic field (e.g., `slug` or `(author, title)`).
  TBD in v1.0 — may need a `seedKey` field or careful `upsert` logic.
- **`PostCard` must NOT use `dangerouslySetInnerHTML`** for body
  content. Use plain text with preserved line breaks.
- **Post type is absent** (per D048) — PostCard doesn't branch on
  type yet. Future composer session adds type-specific rendering.

---

## Tests required (v0.9 — may expand)

- `post.list()` — returns posts in correct order
- `post.list()` — respects visibility for anonymous callers
- `post.list()` — respects visibility for authenticated callers
- `post.list()` — excludes soft-deleted posts
- `post.list()` — cursor pagination returns next batch correctly
- `post.list()` — empty result when no posts
- Service-layer test: filtering logic
- Manual verification: seed runs clean; visible data on the feed

---

## Open questions to surface (v0.9)

Pre-identified. May expand in v1.0.

1. **Feed URL.** Is it `/feed` or `/`? Or redirect `/` → `/feed`
   for authenticated users? Propose: `/feed` is the canonical URL;
   `/` redirects when logged in, shows "please log in" otherwise.

2. **Body rendering — plain text vs. Markdown.** Plain text is
   simpler. Markdown is nicer. Recommend plain text for demo;
   Markdown in a later iteration.

3. **"Read more" expansion — inline expand or link to detail page?**
   No detail page exists yet. Simplest: no truncation, show full body
   on the card. If body is long, the card is tall. Acceptable for
   demo; refine later.

4. **Page size for pagination.** 20 per page is standard. Confirm.

5. **Empty states** — what should the feed say if truly no posts?
   "No posts yet. Write one?" with a link to compose. Compose
   doesn't exist yet at BU-feed time. Handle gracefully — text only.

6. **Loading state** — skeleton rows or a spinner? Skeletons feel
   more native. Recommend skeletons.

7. **AM URL domain allowlist** — validated at input (composer) but
   also displayed verbatim. Any XSS concerns? Recommend: validate
   URL at composer only; feed card just uses the string as href
   attribute, which is safe as long as it's a URL string.

8. **Timezone handling for timestamps** — "2 hours ago" is best;
   library? Recommend `date-fns` `formatDistanceToNow`. Confirm.

(v1.0 refinement will add more based on BU-001-lite learnings.)

---

## Definition of done (v0.9 — will tighten)

Same as any session: tests, lint, typecheck, prettier, headers,
commit message. v1.0 will add specifics.

---

## Refinement triggers

This brief should be refined to v1.0 when:

- BU-001-lite executes and we see the auth context shape
- The dev seed infrastructure from BU-001-lite tells us the pattern
  for extending it
- Any parallel design-system session produces primitives to reuse
- We decide feed URL routing (`/` vs `/feed`)

Paul will paste BU-001-lite's final state to Claude (assistant) and
a v1.0 of this brief will follow before execution.

---

## What this brief does NOT cover

1. **Post creation** — BU-composer next
2. **Post detail page** — not needed for demo
3. **Comments / reactions** — Slice 2 full post-demo
4. **Search** — Phase 2
5. **Group feeds** — post-demo
6. **Notifications about new posts** — post-demo
7. **Bookmarks / saves** — post-demo
8. **Markdown rendering** — MVP is plain text

---

## Slice convention

BU-feed extends the `@build-unit` header pattern and the
post-demo path sequencing. It's the biggest of the demo-path
sessions; may need checkpoint discipline per `session-hygiene.md`.
