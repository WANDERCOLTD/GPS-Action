# Build Unit sequence plan

**Status:** Planning doc, April 2026. Authoritative for build order.
**Authored by:** Paul + Claude (planning conversation).
**Purpose:** Map the full feature-build sequence, explicitly shaped by
the near-term objective of a local demo.

Read alongside:
- `docs/build/engineering-roadmap.md` — the broader roadmap
- `docs/build/phase-0-foundations.md` — Phase 0 infrastructure sessions
- `docs/architecture/environments.md` — environment model and pipelining
- `docs/process/session-brief-template.md` — how each BU becomes a brief

---

## The demo objective

> Get Eddie (the test member) logging in on Paul's laptop, seeing a
> realistic feed of posts, writing a new post that optionally includes
> an Activist Mailer campaign URL, and having that post appear on the
> feed with a "Open in Activist Mailer" action when a URL is present.

**All dev-only.** No staging, no real auth, no production integrations.
The goal is "watchable demo" in 2-3 focused days of work, not "shippable
product."

After the demo works, sequence continues with real auth, moderation,
groups, and the rest of the product. The demo is milestone one; the
rest unlocks a pilot with real users.

---

## What's already done

**Demo path complete (April 2026).** The full Phase 1 demo loop is
shipped — login → feed → compose → post-with-AM-URL → click through.

| Item | Status | Notes |
|---|---|---|
| **ERD Slice 1** (User, Region, WorkItem, RoleGrant, CoordinatorProfile, CoordinatorGroup, AuditLog, FeatureFlag, UserRegion) | ✅ Merged | Foundation entities in place |
| **ERD Slice 1.5** (Group, GroupMembership, WorkItem.groupTags) | ✅ Merged | Community affiliation schema |
| **ERD Slice 2 (minimal)** (Post model + PostType, PostVisibility enums) | ✅ Merged | Demo-path post schema |
| **BU-001-lite** (Dev auth stub) | ✅ Merged | `/dev/login`, cookie auth, `requireRole`, audit log writer, `<LoggedInAs />` |
| **BU-feed** (Feed page + post router + seed) | ✅ Merged | `/feed`, `post.list`, ~18 seeded posts |
| **BU-composer** (Post creation form) | ✅ Merged | `/compose`, `post.create`, AM URL allowlist |
| **BU-am-link** (AM URL display) | ✅ Merged | Folded into BU-composer + BU-feed as planned |
| **F03** (Husky pre-commit + commitlint) | ✅ Merged | Auto-formats every commit |
| **F04** (Secret scanning — gitleaks) | ✅ Merged | Pre-commit + CI; server-side scanning deferred (paid plan) |
| **F05** (Dependabot + npm audit CI) | ✅ Merged | Dependency monitoring active |
| **F06** (5 custom ESLint rules) | ✅ Merged | Mechanical enforcement live |
| **F13** (Require `@spec` tags) | ✅ Merged | Lint-enforced on all `@build-unit` files |
| **F15** (Design token enforcement + retrofit) | ✅ Merged | Components use `var(--…)` tokens |
| **Session hygiene discipline** | ✅ Committed | Context management process |

**All shipped briefs (auto-generated from front-matter; do not edit by hand — run `npm run trackers`):**

<!-- AUTOGEN:shipped:start -->
| Brief | Status | PR |
|---|---|---|
| **bu-composer** — BU-composer | ✅ Merged | — |
| **f15-require-design-tokens** — F15 | ✅ Merged | — |
| **erd-slice-1** — ERD Slice 1 | ✅ Merged | #1 |
| **f06-eslint-rules** — F06 | ✅ Merged | #2 |
| **erd-slice-1-5** — ERD Slice 1.5 | ✅ Merged | #4 |
| **f03-husky-commitlint** — F03 | ✅ Merged | #5 |
| **erd-slice-2-minimal** — ERD Slice 2 (minimal) | ✅ Merged | #6 |
| **bu-001-lite** — BU-001-lite | ✅ Merged | #10 |
| **bu-feed** — BU-feed | ✅ Merged | #13 |
| **f13-require-spec-tag** — F13 | ✅ Merged | #18 |
| **f14-require-testid** — F14 | ✅ Merged | #43 |
| **bu-reactions** — BU-reactions | ✅ Merged | #46 |
| **bu-comments** — BU-comments | ✅ Merged | #52 |
| **bu-trace** — BU-trace | ✅ Merged | #54 |
| **f07-coverage-floor** — F07 | ✅ Merged | #60 |
| **f08-migration-validation** — F08 | ✅ Merged | #60 |
| **f10-seed-data** — F10 | ✅ Merged | #62 |
| **f11-error-boundaries** — F11 | ✅ Merged | #63 |
| **f12-health-checks** — F12 | ✅ Merged | #63 |
| **bu-link-share** — BU-link-share | ✅ Merged | #70 |
| **bu-requests-urgent** — BU-requests-urgent | ✅ Merged | #75 |
| **bu-fab-intent-picker** — BU-fab-intent-picker | ✅ Merged | #78 |
| **bu-admin-crud** — BU-admin-crud | ✅ Merged | #79 |
| **bu-requests-vetting** — BU-requests-vetting | ✅ Merged | #81 |
| **bu-admin-audit-integration** — BU-admin-audit-integration | ✅ Merged | #84 |
| **bu-admin-bulk-ops** — BU-admin-bulk-ops | ✅ Merged | #86 |
| **bu-am-link-collapse** — BU-am-link-collapse | ✅ Merged | #89 |
| **bu-post-hero-demo** — BU-post-hero-demo | ✅ Merged | #95 |
| **bu-sticky-nav** — BU-sticky-nav | ✅ Merged | #106 |
| **bu-brief-status-mechanism** — BU-brief-status-mechanism | ✅ Merged | #116 |
| **bu-demo-mode** — Brief: BU-demo-mode | ✅ Merged | #124 |
| **bu-tick-or-cross** — BU-tick-or-cross | ✅ Merged | #129 |
| **bu-link-first-composer** — bu-link-first-composer | ✅ Merged | #135 |
| **bu-feed-card-clamp** — bu-feed-card-clamp | ✅ Merged | #141 |
| **bu-publish-router** — bu-publish-router | ✅ Merged | #146 |
| **bu-feed-card-affordances** — bu-feed-card-affordances | ✅ Merged | #147 |
| **bu-event-time** — BU-event-time | ✅ Merged | #150 |
| **bu-calendar-view** — BU-calendar-view | ✅ Merged | #151 |
| **bu-icon-nav** — BU-icon-nav | ✅ Merged | #152 |
| **bu-month-nav** — BU-month-nav | ✅ Merged | #153 |
| **bu-one-click-polish** — BU-one-click-polish | ✅ Merged | #161 |
| **bu-requests-card-lift** — bu-requests-card-lift | ✅ Merged | #163 |
| **bu-comments-card-lift** — BU-comments-card-lift | ✅ Merged | #166 |
| **bu-postcard-share-polish** — bu-postcard-share-polish | ✅ Merged | #167 |
| **bu-calendar-near-me** — BU-calendar-near-me | ✅ Merged | #169 |
| **bu-post-location-input** — BU-post-location-input | ✅ Merged | #171 |
| **bu-whatsapp-share** — BU-whatsapp-share | ✅ Merged | #111, #114 |
| **bu-requests-sequencing** — Sequencing brief | ✅ Merged | #74, #75, #81 |
| **bu-composer-intent-polish** — Brief: BU-composer-intent-polish (demo polish) | ✅ Merged | #85, #91, #93, #94 |
<!-- AUTOGEN:shipped:end -->

PRs without a dedicated brief (chores, fixes, polish) live in `git log` —
this table tracks brief lifecycle, not all merged work.

**Outstanding from Phase 0 / foundations:** none.

---

## Next BU — undecided

Briefs in `planned` or `in_progress` status (auto-generated; do not edit
by hand — run `npm run trackers`):

<!-- AUTOGEN:planned:start -->
- **bu-hydration-fixes** _[high]_ — BU-hydration-fixes
- **bu-prod-auth** _[high]_ — bu-prod-auth
- **bu-vercel-prep** _[high]_ — bu-vercel-prep
- **bu-drafts-inbox** _[medium]_ — bu-drafts-inbox
- **bu-reviewer-kind-review-queue** _[medium]_ — bu-reviewer-kind-review-queue
- **bu-search-surface** _[medium]_ — BU-search-surface
- **bu-composer-link-first** _[low]_ — BU-composer-link-first
<!-- AUTOGEN:planned:end -->

For BUs not yet briefed, the Phase 2/3/4 schedule further down lays
out the queue. Decision belongs to Paul.

---

## Phase 1 — Demo path (priority 1)

**Status: ✅ All Phase 1 BUs merged (April 2026).** The sections below
are kept as the historical scope-of-work record — useful for reading
back what each BU did and didn't include.

Five Build Units to get the demo working. Ordered by dependency.

### Slice 2 (minimal) — Post schema

**Why first:** everything downstream reads or writes Posts.
**Scope (minimum for demo):**
- `Post` model — id, author, type, title, body, activistMailerUrl (nullable), visibility, createdAt, updatedAt, deletedAt
- Enum `PostType` — limited set: `dispatch`, `cultural_moment`, `action_call`, `news_share`, `question`
- Enum `PostVisibility` — `public`, `authenticated_only` (author override per D045)
- Index on (visibility, createdAt) for feed queries
- Relation to User (author) with appropriate onDelete

**Explicitly deferred past demo:**
- Comment, Reaction, Attachment models (Slice 2 full)
- Post-to-WorkItem relation (moderation)
- Dedup/cosurfacing fields
- Boost/remove verdict tracking
- Share events, dispatch events
- Partner organisation tagging

**Estimated:** 30 min brief + 45-60 min Claude Code.

**Session brief file:** `docs/build/session-briefs/erd-slice-2-minimal.md`

---

### BU-001-lite — Dev auth stub

**Why second:** the feed needs a "current user" to render as.
**Scope:**
- Dev-only auth stub (rejects in production per NFR) reading a cookie
  `gps_dev_user_id`
- A user-picker page at `/dev/login` showing seeded users with a "Log
  in as X" button that sets the cookie
- `requireRole` middleware (used by /admin later; not used by /feed
  because feed is member-accessible)
- Audit log service (minimal version — just the write function; the
  full service lands with BU-admin)
- A simple "logged in as" header element showing current user, with a
  "switch user" link back to `/dev/login`

**Explicitly deferred past demo:**
- Real auth (magic links, passwords, 2FA, sessions) — BU-auth post-demo
- Full admin surface with role grants UI — BU-admin post-demo
- Coordinator profile admin — later
- Route protection on `/admin/*` (no admin routes exist yet)

**Estimated:** 45 min brief + 45-60 min Claude Code.

**Session brief file:** `docs/build/session-briefs/bu-001-lite.md`

**Note:** the original `bu-001.md` brief (full admin surface) is renamed
to `bu-020.md` and deferred. Its content stays valid — just not now.

---

### BU-feed — Feed page + Post router + seed data

**Why third:** this is the centrepiece of the demo.
**Scope:**
- `/feed` page — server-rendered or client-fetched list of Posts, newest
  first
- Post card component showing: author (name + small avatar placeholder),
  type badge, title, body (truncated with "Read more"), timestamp
  relative
- If `activistMailerUrl` is present: "Open in Activist Mailer" link
  button on the card
- tRPC router `post` with `.list()` procedure (public read for
  `public` visibility, authenticated read for `authenticated_only`)
- Cursor pagination ready but not elaborate (limit 20, next cursor)
- `scripts/seed-dev.ts` — creates 3-4 users (including Eddie), 10-15
  posts across the five post types with realistic content, 2-3 groups
- The seed script is idempotent (upsert-based), safe to re-run
- Basic empty state: "No posts yet. [Compose one →]"

**Explicitly deferred past demo:**
- Reactions, comments, bookmarks
- Filter by group / type / region
- Dedup groupings ("3 people shared this")
- Feed personalisation / ranking (chronological only)
- Real-time updates (polling or WebSocket)
- Infinite scroll (keep pagination simple)

**Estimated:** 45 min brief + 2-3 hr Claude Code (largest demo-path session).

**Session brief file:** `docs/build/session-briefs/bu-feed.md`

---

### BU-composer — Simple post creation

**Why fourth:** completes the write half of the loop.
**Scope:**
- `/compose` page — simple form (not the FAB intent cards from D044;
  those come post-demo)
- Fields: type (select), title (text), body (textarea), activistMailerUrl
  (text, optional, validated as URL if provided), visibility (radio:
  public / authenticated_only)
- tRPC procedure `post.create` with Zod validation
- On success: redirect to `/feed`, new post at top
- Inline validation errors (not silent failures)
- Cancel button returns to feed without saving

**Explicitly deferred past demo:**
- FAB intent-cards composer (D044) — this is a later iteration
- Image/attachment upload (D046)
- Deep-linking to compose with pre-filled content
- Draft saving
- Post editing after creation
- Post type selection via rich UI

**Estimated:** 30 min brief + 1-1.5 hr Claude Code.

**Session brief file:** `docs/build/session-briefs/bu-composer.md`

---

### BU-am-link — AM URL display

**Why last (and smallest):** this is the demo's distinctive feature
but is genuinely tiny in code.

**Scope:**
- On every post card: if `activistMailerUrl` is present, show an "Open
  in Activist Mailer" button
- Button opens URL in new tab (`target="_blank"` + `rel="noopener"`)
- URL is validated at input time (BU-composer) — must be a URL, must be
  https, must be from an allowlisted domain (add `activistmailer.com`
  or whatever the real domain is)
- Validation only — no API calls to AM; the URL is just a link

**Explicitly deferred past demo:**
- Creating AM campaigns from within GPS Action (would require API
  integration)
- Tracking clicks on AM links
- Showing campaign stats inside GPS Action
- Any AM integration beyond "display this URL as a link"

**Likely folded into BU-composer and BU-feed:** probably not a separate
session; the work gets woven into those two. Listed separately here for
clarity.

**Estimated:** folded into BU-composer + BU-feed.

---

### Demo milestone

After BU-feed + BU-composer + BU-am-link:

- Open `http://localhost:3001` on Paul's laptop
- Log in as Eddie (or any seeded user)
- See a realistic feed
- Click "New post"
- Write one with an AM URL
- See it land on the feed
- Click "Open in Activist Mailer" — URL opens in new tab

**This is the MVP demo.** Screenshotable, video-able, shareable on
a Zoom call. Real enough to get meaningful feedback.

---

## Phase 2 — Post-demo, toward pilot

Once the demo works, feedback shapes the next priorities. This is
speculative ordering. Actual order depends on what's learned from
demo feedback.

### BU-auth — Real authentication

Replace the dev stub with a real auth provider (likely NextAuth or
Lucia, TBD). Magic links via email. Session management. This unlocks
deploying to staging.

**Depends on:** staging environment existing. See
`docs/architecture/environments.md`.

### BU-vetting — Vetting flow

Public signup → Application work item → queue manager approves → user
becomes a vetted member. Prerequisite for any real pilot.

### BU-admin — Full admin surface

The original `bu-001.md` brief content. Generic entity admin, queue UI,
role grants, coordinator profiles. Unlocks queue managers doing real
work.

### BU-comments + BU-reactions + BU-attachments — ERD Slice 2 full

Comments, Reactions, Attachments. Makes posts interactive, not just
readable.

### BU-application + BU-flag + BU-outcome-review + BU-edit-request + BU-content-submission + BU-vouch — ERD Slice 3

Application, Flag, OutcomeReview, EditRequest, ContentSubmission,
Vouch. The moderation + contribution schema.

### BU-contact + BU-resource + BU-route + BU-dispatch-event + BU-partner-orgs — ERD Slice 4

Contact, Resource, Route, DispatchEvent, PartnerOrg. The external
network schema.

### BU-composer-fab — Composer (full, FAB intent cards)

Per D044. Replaces BU-composer's simple form with the intent-driven
composer.

### BU-dispatch — Dispatch

WhatsApp dispatch modal, social share, email dispatch. Per
share-out-mechanics.md. Needs D045 visibility rules enforced.

### BU-inbound-share — Inbound sharing

The `/share?url=...` endpoint. Bookmarklet for MVP, native share sheet
phase 2. Per D018.

### BU-groups — Groups (member-facing UI)

Join open groups, request to join closed ones, group pages. Schema
already in Slice 1.5.

### BU-flag — Flag + moderate

Flagging posts, moderation workflow. Work item type `flag`.

### BU-dedup — Dedup + cosurfacing

"Multiple people shared this article" — surface to queue managers.

### BU-outcome-review — Outcome review

"Did this dispatch work?" feedback loop.

### BU-partner-orgs — Partner orgs

Per parking-lot "v0.6 absorbing" items.

### BU-coord-verify — Coordinator verification + reach tracking

Verified coordinator workflows beyond self-claim.

### Phase 0 remainders

F01, F02, F04, F05, F07, F08, F09, F10, F11, F12 — remaining
infrastructure work. Most unblock deploying to staging or shipping to
production; none block the local demo.

---

## Dependencies

Hard prerequisites (can't start until done):

```
Slice 2 minimal ──┐
                  ├── BU-feed (both needed)
BU-001-lite ──────┘         │
                            ├── BU-composer (needs feed to redirect to)
                            └── BU-am-link (folds into the above)
                            │
                         [DEMO]
                            │
                            ├── BU-auth real auth ──────┐
                            │                          │
                            │                          ├── staging
                            │                          │   deployed
                            │                          │
                            │                          └── pilot with
                            │                              real users
```

Soft dependencies (nice to have first):

- Full admin (BU-admin) before first real user — so someone can manage
  their account, moderate content
- Vetting (BU-vetting) before public signup — otherwise anyone can join

---

## Risk register

Things that could go wrong; watching for:

- **Activist Mailer URL validation too strict** — we allowlist a domain,
  but if AM uses multiple domains (e.g., activistmailer.com,
  am.example), we miss legitimate URLs. Mitigation: start strict, relax
  as we hit real URLs.
- **Seed data getting stale** — if we seed once and iterate the schema,
  the seed script breaks. Mitigation: keep the seed idempotent and
  re-runnable; update it whenever the schema changes.
- **Post-demo scope creep** — "we have a demo, let's just add this one
  thing" before shipping. Mitigation: the sequence plan is the
  boundary. Every addition gets a brief.
- **Auth rework painful** — BU-001-lite's dev stub is tightly coupled
  to cookie-based identity. When real auth lands, the migration might
  touch more than expected. Mitigation: keep the auth stub's surface
  small — `getCurrentUser()`, `requireRole()` — so the replacement has
  a small contract to satisfy.

---

## What this plan does NOT cover

(Naming gaps explicitly.)

1. **Mobile native apps.** Web-first per D003. Native is post-pilot
   at earliest.
2. **Internationalisation.** English-only MVP.
3. **Offline mode / PWA offline support.** Phase 2+.
4. **Push notifications.** Post-pilot.
5. **Payments, donations, fundraising integration.** Out of scope
   for this year probably.
6. **Analytics / PostHog integration.** Per D037, but instrumentation
   happens per-event as features land, not as a dedicated BU.
7. **Accessibility audit.** Woven through each BU's Definition of
   Done; not a standalone BU.
8. **Performance optimisation.** Premature without users. Phase 2 or
   in response to real evidence.

---

## How to read this document

- **Each BU in Phase 1 gets a session brief** (written by Paul + Claude
  in planning conversation, executed in Claude Code).
- **BUs in Phase 2 get briefs when they're approached.** Speculative
  ordering may reshuffle based on demo feedback.
- **This doc is edited as reality diverges from the plan.** When a BU
  ships, mark it done. When priorities shift, re-order. Keep it live.
- **The demo milestone is the current horizon.** Don't plan past it in
  detail.
