# GPS Action — Decision Log

_Every significant decision made in designing GPS Action. Captures what was decided, why, and when. Helps future-us remember why things are the way they are._

_Version: 0.1 · April 2026_

---

## How this log works

- One entry per significant decision
- Entries never edited in place (append-only)
- Changes to prior decisions recorded as new entries ("Revisited decision X — see entry N")
- Three tiers: Foundation (changing is expensive), Architecture (cascades), Feature (local)

Each entry has:

- **Date** when decided
- **Tier** of decision
- **Context** — what prompted the decision
- **Options considered** — what alternatives were on the table
- **Decision** — what we chose
- **Reasoning** — why
- **Consequences** — what this commits us to
- **Status** — active, superseded, revisited

---

## Foundation decisions

### D001 · Replace WhatsApp-based coordination with a purpose-built platform

**Date:** Early April 2026
**Tier:** Foundation
**Context:** GPS currently runs via ~20 WhatsApp groups. Coordination is ad-hoc, visibility is poor, member onboarding has no memory, and the signal-to-noise ratio is degrading.
**Options considered:**

- Keep WhatsApp, add better processes (rejected — doesn't scale)
- Build on an existing platform like Slack or Discord (rejected — not tuned for activism, wrong mental model)
- Build a purpose-built platform (chosen)
  **Decision:** Build a purpose-built platform called GPS Action.
  **Reasoning:** GPS's specific needs (action-focused posts, WhatsApp integration, vetting workflows, regional routing) aren't served by general platforms. The work required to retrofit is similar to building something right.
  **Consequences:** Significant engineering investment. Multi-month build. Pilot required before wide rollout.
  **Status:** Active

### D002 · Post-first platform, not information-management platform

**Date:** Early April 2026
**Tier:** Foundation
**Context:** Initial framing was "information management" — monitoring, tracking, analysis. That frames GPS as an intelligence operation rather than a community.
**Options considered:**

- Information-first (rejected — passive, centralises power)
- Post-first (chosen)
  **Decision:** GPS Action is a post-first platform where anyone can publish.
  **Reasoning:** Matches how GPS actually operates — distributed members spotting things and amplifying. Framing as "information gathering" subordinates members to central operators.
  **Consequences:** Every member is a producer. Moderation happens through community norms not gatekeeping. Design privileges publishing velocity.
  **Status:** Active

### D003 · TypeScript / Next.js / Prisma / tRPC stack

**Date:** Mid April 2026
**Tier:** Foundation
**Context:** Need to choose a stack for parallel one-shot Claude Code builds.
**Options considered:**

- TypeScript full-stack with strict type flow (chosen)
- Python/Django + React (rejected — weaker type flow, manual contract work)
- Ruby on Rails + React (rejected — similar trade-off)
- Go backend + React (rejected — more contract boundaries)
  **Decision:** Next.js + Prisma + tRPC + strict TypeScript.
  **Reasoning:** Claude Code strongest in TypeScript. Types flow from DB schema to API to client automatically. Unifies frontend + backend in one language. Single source of truth via Prisma schema.
  **Consequences:** Commits team to TypeScript. Requires Node.js hosting. Mobile native apps require React Native or separate codebase.
  **Status:** Active

### D004 · UK data residency, AWS eu-west-2

**Date:** Mid April 2026
**Tier:** Foundation
**Context:** UK GDPR requires data residency considerations. Members are UK-based.
**Options considered:**

- AWS eu-west-2 (London) — chosen
- AWS eu-west-1 (Ireland) — valid but suboptimal
- Google Cloud or Azure UK regions — considered, AWS chosen for KMS + RDS maturity
  **Decision:** AWS, eu-west-2 region.
  **Reasoning:** UK-resident data. AWS KMS for envelope encryption. Mature Postgres via RDS. GPS can be transparent with members about where their data lives.
  **Consequences:** Costs in GBP. Compliance with UK GDPR tractable. Commits to AWS ecosystem.
  **Status:** Active

---

## Architectural decisions

### D010 · High-trust network; vouching required

**Date:** Early April 2026
**Tier:** Architecture
**Context:** GPS's existing network relies on personal trust. Members are vouched for informally through the Welcome group.
**Options considered:**

- Open signup (rejected — exposes network to bad actors)
- Invite-only, casual (existing WhatsApp approach, breaks at scale)
- Vouching with explicit ledger (chosen)
  **Decision:** Every member is vouched for by an existing member. Vouches are recorded in an append-only ledger.
  **Reasoning:** Structured vouching makes the trust graph visible. If bad behaviour surfaces, vouching chains can be investigated. Also produces honest accountability — "I stood for X" is a commitment.
  **Consequences:** Enrolment requires voucher. Founding members seeded as graph roots. Vouch ledger is a first-class primitive.
  **Status:** Active

### D011 · Permission flags orthogonal to role hierarchy

**Date:** Mid April 2026
**Tier:** Architecture
**Context:** Some members do specialist work (vetting, boost/remove team) not captured by a simple role hierarchy.
**Options considered:**

- Add more roles (rejected — role explosion)
- Permission flags alongside roles (chosen)
  **Decision:** Roles are member/writer/coordinator/director. Orthogonal flags: vetter, boost_remove_team, founding_member.
  **Reasoning:** Specialist responsibilities don't require promoting to coordinator. Can be granted independently.
  **Consequences:** Permission matrix more complex. Checks use `checkPermission(user, action)` not just role comparison.
  **Status:** Active

### D012 · No member-to-member DMs

**Date:** Mid April 2026
**Tier:** Architecture
**Context:** Members might reasonably want to DM each other. But DM-at-scale is a moderation nightmare.
**Options considered:**

- Full DMs with moderation (rejected — too much surface area)
- Admin DMs only (chosen — coordinators can DM members)
- No DMs at all (considered — too restrictive)
  **Decision:** Coordinator-to-member DMs exist. Member-to-member DMs do not. @mentions in comments serve the peer-communication role.
  **Reasoning:** GPS's needs are coordinator-led. Member-to-member discussion lives in public (comments) where it's visible and accountable. Private member-to-member opens abuse and harassment surface.
  **Consequences:** Harassment risk reduced. Some legitimate use cases (planning between members) push to WhatsApp or email. Director reserves right to enable DM pair if a specific need emerges.
  **Status:** Active

### D013 · Self-dispatch default; dispatch queue as fallback

**Date:** Late April 2026
**Tier:** Architecture
**Context:** Posts need to reach WhatsApp. A queue + dispatcher rota was initial design. Simpler if poster handles their own dispatch.
**Options considered:**

- Dispatcher queue with rota (initial)
- Self-dispatch from poster's device (chosen)
- Hybrid — self-dispatch default, queue for exceptions (final)
  **Decision:** Poster dispatches from own device via dispatch modal. Queue exists for skipped posts and restricted routes.
  **Reasoning:** WhatsApp Business API can't post into groups. Manual dispatch is the only reliable way. Poster-as-dispatcher is faster, more accountable, scales better than a small rota.
  **Consequences:** Every member learns the dispatch flow. Team-owned queue still exists for fallbacks. Dispatcher permission flag removed.
  **Status:** Active

### D014 · Auto-comments in thread with user-level filter

**Date:** Late April 2026
**Tier:** Architecture
**Context:** System events (dispatches, cap milestones, edits) could be hidden in audit logs or visible in thread. Each has trade-offs.
**Options considered:**

- Audit logs only (rejected — reduces member awareness of amplification)
- Separate activity sidebar (considered — cleaner but disconnected)
- Auto-comments in thread with filter (chosen)
  **Decision:** System events become auto-comments in the thread. Members filter via three-way control: All / Discussion / Activity. Default is Discussion.
  **Reasoning:** Members get the narrative without clutter. Those who want the trail find it. Default respects warmth of ordinary conversation.
  **Consequences:** Comment primitive gains is_system, event_type, visibility_level. Filter UI on every thread. Slight complexity to model.
  **Status:** Active

### D015 · Partner organisations as co-branding

**Date:** Late April 2026
**Tier:** Architecture
**Context:** Members may be affiliated with other orgs (Action on Antisemitism, CST, etc.). Posts should accommodate co-branding.
**Options considered:**

- No co-branding, GPS only (rejected — doesn't match reality)
- Free text attribution (rejected — unverifiable, brand risk)
- Structured partner orgs with verified affiliations (chosen)
  **Decision:** Partner Organisation as entity. Members declare affiliations. Posts optionally attribute. Logo displayed on card.
  **Reasoning:** Real GPS posts already co-brand. Need a controlled way to do it. Verification layer prevents impersonation.
  **Consequences:** New entities: Partner, Affiliation. UI composer gains attribution picker. Admin surface for partner CRUD. Enrolment form may gain affiliation question.
  **Status:** Active

### D016 · Self-dispatch uses copy-and-deeplink pattern, not Business API

**Date:** Late April 2026
**Tier:** Architecture
**Context:** WhatsApp's APIs have sharp limits. Business API posts to Channels only, not Groups. Unofficial APIs risk account bans.
**Options considered:**

- Business API for everything (blocked — groups not supported)
- Unofficial APIs (rejected — ToS violation, account ban risk)
- Copy-and-deeplink manual send (chosen)
- Manual send with no software help (rejected — too friction-heavy)
  **Decision:** System formats message, copies to clipboard, deep-links to WhatsApp. User pastes, sends. Self-reports completion.
  **Reasoning:** Only reliable option. Takes ~4 seconds per send. Scales without central bottleneck.
  **Consequences:** Phase 2 can add Business API for Channels. Self-report introduces mild trust issue (user might claim sent when they didn't) — acceptable trade.
  **Status:** Active

---

## Feature-level decisions

### D030 · Bottom tabs for member navigation, FAB for posting

**Date:** Late April 2026
**Tier:** Feature
**Context:** Navigation pattern for primary app structure.
**Decision:** Four bottom tabs (Feed / Network / Inbox / Me) + FAB for posting. Desktop: left sidebar equivalent.
**Reasoning:** Matches mental model of modern apps. Thumb-friendly. Leaves posting prominent without cluttering tabs.
**Status:** Active

### D031 · 5 post types, 12 action types (pending final)

**Date:** Mid April 2026
**Tier:** Feature
**Context:** Initial framework for what people post and what actions they take.
**Decision:** Post types: Action, Seeking, Outcome, Community, Coordination. Action types: 12 in 4 clusters. Awaiting Jeremy's final sign-off.
**Reasoning:** Covers observed patterns in GPS's WhatsApp activity. Tight enough to be learnable.
**Status:** Action types pending final sign-off; post types agreed.

### D032 · 14-emoji curated reaction set + 3 seasonal

**Date:** Mid April 2026
**Tier:** Feature
**Context:** Reactions need bounded set to prevent clutter.
**Decision:** 14 core emoji (👍❤️💕🤗🙏💪‼️👀😔🎯✡️🕯️😂🔥) plus 3 seasonal (🕎🍎🌿) that appear in their relevant windows.
**Reasoning:** Matches GPS culture. Covers solidarity, urgency, grief, humour, faith moments.
**Status:** Active

### D033 · Cultural moments get distinct visual treatment (bordeaux)

**Date:** Mid April 2026
**Tier:** Feature
**Context:** Shabbat posts, remembrance posts, cultural moments deserve quieter, dignified treatment.
**Decision:** Cultural-marker colour (#6B3045 bordeaux) for Jewish-specific cultural moments. Used sparingly.
**Reasoning:** Respects cultural weight. Separates from urgent action styling.
**Status:** Active

### D034 · WCAG 2.2 AA as the accessibility bar

**Date:** Mid April 2026
**Tier:** Feature
**Context:** Accessibility commitment level.
**Decision:** WCAG 2.2 AA across both themes. Automated checks on every PR. Manual screen-reader testing before pilot.
**Reasoning:** Meaningful floor without over-reaching to AAA. Matches UK public-sector standard.
**Status:** Active

### D035 · Self-hosted design system, Lucide icons, system emoji

**Date:** Mid April 2026
**Tier:** Feature
**Context:** Icon and emoji sources.
**Decision:** Design tokens + components in our own CSS. Lucide for icons. System-native emoji for reactions.
**Reasoning:** Tokens are sovereign. Lucide is free, consistent, open-source. System emoji feels native on user's own device.
**Status:** Active

---

## Superseded decisions (kept for history)

### D013a · Dispatcher queue as default dispatch path

**Date superseded:** Late April 2026 (by D013)
**Original decision:** Posts needing WhatsApp dispatch go into a queue; a designated team dispatches them in rotation.
**Reason for superseding:** Over-engineered. Self-dispatch is simpler, faster, more accountable. Queue retained as fallback.
**Status:** Superseded

### D014a · System events in activity sidebar

**Date superseded:** Late April 2026 (by D014)
**Original decision:** System events (dispatch, milestones, etc.) shown in a separate activity sidebar on post detail, keeping comment thread clean.
**Reason for superseding:** Filter approach makes user choice the mechanism. Users who want clean thread get it (Discussion default); those who want activity get one-tap access.
**Status:** Superseded

---

## Pending decisions (not yet made)

- Native apps vs PWA for MVP
- Monolith vs modular deployment
- AI provider choice (OpenAI vs Anthropic vs other)
- Report action type split (single vs three-way)
- Founding members list (needs Jeremy)
- Initial Routes registry population plan
- Default composer cap/expiry values

See §6 of Feature Spec for full list.

---

## How to add new entries

Whenever a decision is made:

1. Append a new entry with next ID
2. Tier it honestly
3. Fill all sections — especially Reasoning and Consequences
4. Link to ADR if it has one
5. If decision supersedes an earlier one, mark the earlier one Superseded and link

Never edit past entries. Append corrections as new entries. This preserves the trail.

---

## Recent decisions (April 2026, late-month batch — added during pre-build doc consolidation)

### D015 · Partner Organisations & co-branding

**Date:** April 2026
**Tier:** Architecture
**Context:** GPS members are often affiliated with other campaigning organisations (Action on Antisemitism, CST, etc.). WhatsApp screenshot showed Action on Antisemitism logo on a Sky News complaint post — co-branding is already happening informally.
**Options considered:**

- No co-branding, GPS only (rejected — doesn't match reality)
- Free text attribution (rejected — unverifiable, brand-impersonation risk)
- Structured Partner Organisation entity with verified affiliations (chosen)
  **Decision:** Partner Organisation as first-class entity. Members declare Affiliations. Posts may attribute to one or more Partners (max 3). Logo renders on card. Admin-managed Partner records. Self-declared affiliations with verification layer.
  **Reasoning:** Real GPS posts already co-brand. Need a controlled way to do it that prevents impersonation. Verified affiliations carry a tick; unverified appear without it. Partnership archive (not retroactive removal) preserves history.
  **Consequences:** New entities — Partner, UserAffiliation. Composer gains attribution picker. Card rendering supports logo + tick. Routing engine matches partner-attributed posts to partner-specific WhatsApp routes. Profile lists user's affiliations. Affects enrolment form (asks about existing affiliations).
  **Status:** Active. To absorb into Feature Spec v0.6 as §3.30.

### D016 · 1-click social sharing as primary universal feature

**Date:** April 2026
**Tier:** Architecture
**Context:** WhatsApp screenshot shows 9,411 links across the network — overwhelming evidence that the dominant member behaviour is **amplifying content on social media**. Earlier spec treated "share" as one action type among 12. That mis-frames priority.
**Options considered:**

- Keep share as one action type (rejected — under-prioritises the dominant behaviour)
- 1-click share strip on every shareable post, multi-platform (chosen)
  **Decision:** Every shareable post carries a 1-click share strip: X, Facebook, Instagram, LinkedIn, WhatsApp, Telegram, email, plus native OS share sheet. Composer produces per-platform text variants and image crops (1:1 / 9:16 / 16:9 / 1.91:1). System tracks share-button taps (not completion — privacy by design). UTM params on outgoing URLs.
  **Reasoning:** Order-of-magnitude friction reduction at the most important moment. A member encounters bad content → wants to amplify → 1-click instead of 5-step manual flow. Without this, members will continue using WhatsApp directly and bypass GPS Action entirely.
  **Consequences:** Post primitive gains text variants + image crops fields. Composer adds platform-specific authoring with previews. Card UI gains share strip. Tracking infrastructure for tap events + UTM attribution. Boost/share as a generic action type becomes less central — sharing is universal on every post.
  **Status:** Active. To absorb into Feature Spec v0.6 as §3.31. **Critical for pilot.**

### D017 · Boost/Remove simplification — just a post + verdict

**Date:** April 2026
**Tier:** Architecture
**Context:** Earlier spec over-engineered Boost/Remove with separate composer flows, complex cap management, distinct moderation treatment. User clarified: it's nothing more than a post + verdict, into a designated WhatsApp channel.
**Options considered:**

- Maintain separate Boost and Remove flows (rejected — over-complex)
- Single composer with verdict field, dispatch routes to verdict-specific channel (chosen)
  **Decision:** Boost ✅ / Remove ❌ are a `verdict: 'boost' | 'remove' | null` field on Post. Dispatch routes verdict-carrying posts to the "Network Tick or Cross" WhatsApp channel with the appropriate prefix. No special UI flows. WhatsApp team manually actions the channel as they do today (retweet/like for boost, mass-report for remove).
  **Reasoning:** Matches existing GPS practice exactly. No invention. Lowest engineering cost. Highest fidelity to the workflow Sharon and team already run.
  **Consequences:** Spec simplifies materially. Verdict field on Post primitive. One additional Route record for the boost/remove channel. Dispatched message format prefixes ✅ or ❌. No bespoke moderation pipeline needed.
  **Status:** Active. Supersedes earlier over-engineered Boost/Remove design. To absorb into Feature Spec v0.6 §3.22.

### D018 · Inbound sharing — share INTO GPS Action

**Date:** April 2026
**Tier:** Architecture
**Context:** Inverse of share-out. When a member encounters content elsewhere (X, Safari, an article), they should be able to send it INTO GPS Action with one tap, not copy-paste-switch-app.
**Options considered:**

- Manual flow only — copy URL, switch app, paste (current — high friction)
- URL endpoint as foundation + bookmarklet for MVP (chosen MVP)
- Native OS share sheet integration (Phase 2, requires native app or PWA Share Target)
- Browser extension (Phase 2, polish)
  **Decision (MVP):** Build `/share?url=...&title=...&note=...` endpoint. Build a bookmarklet that members install in their browser bookmarks bar — one click while viewing any page opens the GPS Action composer pre-filled. **Decision (Phase 2):** Native share sheet via PWA Share Target API or native app integration.
  **Reasoning:** Removes the same order-of-magnitude friction as share-out, at the inbound moment. Bookmarklet is universal (works in every browser), needs no app-store approval, ships in days. URL endpoint is the foundation everything else builds on (native share, browser extension, automation tools).
  **Consequences:** New `/share` route in app. Composer accepts URL parameters and pre-fills. Bookmarklet code distributed to pilot users on day one. Share Target API specified in PWA manifest (Phase 2).
  **Status:** Active. Parked for v0.6 or v0.7 depending on capacity.

### D019 · Useful Links repository (member-contributed, admin-curated)

**Date:** April 2026
**Tier:** Feature
**Context:** WhatsApp screenshot showed Sharon saying "I'll add it to our repository of useful info" after Candice shared standwithus.com link. The repository exists informally; should be formalised.
**Decision:** Members submit external links with context. Lands in admin review queue. Approved links appear in Network → Resources area, searchable/filterable by topic and region. Distinct from Content Library (GPS's own assets), Partner Organisations (relationship records), Contacts (outreach), and Routes (dispatch).
**Reasoning:** Existing practice should be supported, not bypassed. Centralising the "useful links" library removes WhatsApp scroll-back searching and makes resources discoverable to new members.
**Consequences:** New Resource entity. Submission form. Admin review queue. Browse/search UI in Network area.
**Status:** Parked for v0.6 or later. Naming TBD ("Resources" / "Library" / "Useful Links" / "Know This").

### D020 · Engineering discipline framework adopted

**Date:** April 2026
**Tier:** Foundation
**Context:** User wants extreme parallel one-shot Claude Code builds against contracts. Without explicit discipline, parallel sessions drift.
**Decision:** Adopt the full discipline framework: Session Brief Template, Reviewer Checklist, Ratchet Discipline, Security Baseline, Change Absorption Guide, Decision Log, Parking Lot, Scenarios library. ESLint with boundary plugin enforces MVC layer separation as errors. CI blocks merges on typecheck/lint/test failures. Definition-of-done is non-negotiable per session.
**Reasoning:** Parallel work without contracts produces unassembleable output. The discipline framework is what makes one-shot parallel builds actually work. The cost (rigorous briefs, reviewer time) is far less than the cost of integration failure.
**Consequences:** Every Claude Code session uses the brief template. Every PR walks the reviewer checklist. Layer boundaries are physical (file paths) not just conventional. All decisions go to this log.
**Status:** Active.

### D021 · Naming exploration deferred to pre-pilot

**Date:** April 2026
**Tier:** Feature
**Context:** "GPS Action" is institutional. Member-facing name should be warmer, verb-led, shorter (e.g. Stand, Echo, Rally). Internal vocabulary also under exploration (Coordinator → Steward, Vetting → Welcoming).
**Decision:** Keep "GPS Action" as internal working name through build. Lock member-facing name 1-2 weeks pre-pilot after testing 3 candidates aloud with Jeremy, Sharon, and a few trusted members.
**Reasoning:** Naming this early commits to domain/handles/trademark searches before we know what we're shipping. But thinking is captured (parking lot) so it's not lost.
**Consequences:** Code uses "GPSAction" or "gps-action" internally. Display strings parameterise the app name so a single-file change updates everything when the name lands.
**Status:** Pending — pre-pilot decision.

### D022 · Repo structure — single monorepo with layer-first directories

**Date:** April 2026
**Tier:** Foundation
**Context:** Need to commit to a repo organisation before code lands.
**Options considered:**

- Polyrepo (separate frontend/backend repos) — rejected, over-engineering for MVP
- Monorepo with feature-first directories — rejected, breaks layer boundaries
- Monorepo with layer-first directories (chosen)
  **Decision:** Single repo `gps-action`. Directories organise by layer (`/app`, `/server/routers`, `/server/services`, `/server/db`, `/server/lib`, `/shared`, `/components`, `/styles`, `/prisma`, `/tests`, `/scripts`, `/docs`). Features cut across layers — a "dispatch" feature has files in `/server/services/dispatch.ts`, `/server/routers/dispatch.ts`, `/app/(member)/dispatch/...`.
  **Reasoning:** Layer-first preserves MVC discipline at the file-system level. ESLint boundary rules enforce import direction. Feature-first directories make boundaries conventional (easily violated); layer-first makes them physical.
  **Consequences:** Sessions building one feature touch multiple directories — that's expected and correct. Reviewers check layer boundaries by file location alone. Architecture decisions don't drift.
  **Status:** Active. Skeleton script implements this structure.

---

## Late-April additions to "Pending decisions"

- Partner Organisations spec details for v0.6
- 1-click social sharing spec details for v0.6 (CRITICAL)
- Boost/Remove simplification absorbed into v0.6 §3.22
- Inbound sharing endpoint (decide MVP scope vs Phase 2)
- Useful Links repository (decide MVP scope)
- App naming (1-2 weeks pre-pilot)
- Steward / Welcoming vocabulary (test with members)

# Decision Log — April 2026 addendum

**Instructions:** Append everything below to `docs/architecture/decision-log.md`.
Four new decisions (D036–D039) covering feature flags, observability, traceability
infrastructure, and the Build Unit model. All four are foundational — must land
before feature-level Claude Code sessions begin.

---

### D036 · Feature flag tooling — homegrown, DB-driven, discipline-enforced

**Date:** April 2026
**Tier:** Foundation
**Context:** We stated the principle "feature flags everywhere" (v0.5 spec §5.4)
but never chose tooling. Every substantial feature must ship behind a flag. Without
a locked approach, each Claude Code session invents its own pattern.

**Options considered:**

- **LaunchDarkly** — industry leader, per-user targeting, full audit. Rejected: ~$180/month
  baseline, scales punishingly, vendor lock-in, overkill pre-revenue.
- **Unleash (self-hosted)** — OSS, feature-complete. Rejected for MVP: adds another
  service to deploy, secure, and monitor. Reconsider Phase 2.
- **GrowthBook** — OSS with hosted tier, A/B testing built-in. Rejected: A/B testing
  is not a near-term need; its strength doesn't help us.
- **PostHog feature flags (piggyback on analytics)** — attractive integration. Rejected
  as primary: client-side evaluation risks tampering; we need server-side authority.
- **Env vars only** — Rejected: requires redeploy to flip, no per-user targeting,
  cannot act as a kill switch in seconds.
- **Homegrown, DB-driven (chosen)**

**Decision:** Single `feature_flags` table in the primary database, evaluated
server-side by a `isFeatureEnabled(name, context)` function. Admin UI for flip +
audit. Client receives booleans only, never flag names.

**Three flag types must be declared explicitly:**

1. **Rollout flags** — short-lived. Ramp pilot → wider release. Mandatory TTL.
2. **Kill switches** — long-lived. Instant disable for abuse/failure. Named owner.
3. **Pilot gates** — restrict feature to named cohort during pilot.

Config values (max post length, rate limits) are **not flags** — they live in
`config/` and change via PR.

**Schema:**

```
feature_flags:
  id              uuid
  name            text unique        -- e.g. "ff_flagging_v2"
  description     text
  purpose         enum(rollout, kill_switch, pilot_gate)
  enabled_globally        boolean
  enabled_for_user_ids    uuid[]
  enabled_for_group_ids   uuid[]
  enabled_for_regions     text[]
  rollout_percentage      int        -- 0..100, stable hash(user_id)
  ttl_remove_after        date       -- required for rollout flags
  owner_user_id           uuid       -- required for kill switches
  created_at, created_by, updated_at, updated_by
```

**Discipline rules (enforced in review):**

1. Every new feature lands with `enabled_globally=false`. Default OFF.
2. Every flag declares its `purpose`. Generic flags rejected in review.
3. Rollout flags must have `ttl_remove_after`. Default: 90 days. Enforced by a
   weekly script that opens issues for expiring flags.
4. Kill switches are permanent and have a named owner.
5. No nested flags. If a feature needs two flags, the feature is too big.
6. Flags evaluated server-side. Clients never see flag names.
7. Every flag flip is audit-logged: who, when, old state, new state, reason.
8. Test suite must cover feature behaviour in both states.
9. Every flag is listed in `docs/product/feature-flag-register.md` (live registry).

**Consequences:**

- One Claude Code session builds the service + admin UI (~half day).
- Adds a `feature_flags` table and corresponding audit entries.
- ESLint rule enforces `isFeatureEnabled` wrapping for new features (custom rule).
- Weekly cron opens "Flag X expires in 7 days — plan removal or extend" issues.
- The "nothing new" week (ratchet-discipline doc) is where expired flags get removed.

**Status:** Active. Build the service in Phase 0 before any feature-flag-dependent
work. Register file seeded with initial flags during Build Unit definition.

---

### D037 · Observability stack — Sentry + PostHog + Better Stack

**Date:** April 2026
**Tier:** Foundation
**Context:** "Observability is a feature" was stated as principle but no concrete
stack chosen. Three audiences need different tools: operators (is it up, fast?),
product (are people using it?), incident responders (what broke at 3am?).

**Options considered:**

- **Datadog (all-in-one)** — Rejected: excellent, expensive, lock-in.
- **Grafana Cloud + Loki + Tempo** — Rejected for MVP: assembly required, three
  tools to learn, team size doesn't justify the DIY premium now. Reconsider if
  costs escalate on the chosen stack.
- **AWS CloudWatch only** — Rejected: painful DX, no product analytics, weak
  error triage.
- **OpenTelemetry + homegrown** — Rejected: huge time sink pre-scale.
- **Sentry + PostHog + Better Stack (chosen)**

**Decision:**

| Concern                                      | Tool                                | Why                                                                                                         |
| -------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Errors + performance traces                  | **Sentry**                          | Next.js integration in minutes; free tier covers MVP; the best tool for "what broke in this user's session" |
| Product analytics + funnels + cohorts        | **PostHog**                         | Event model in `docs/product/analytics-events.md`; self-hostable later if costs rise; strong free tier      |
| Structured logs + uptime monitoring + alerts | **Better Stack (Logtail + Uptime)** | Cheap; searchable; alerting via multiple channels                                                           |

**Instrumentation discipline (enforced in every feature):**

1. **Structured logs at lifecycle points** — handler entry/exit, external calls,
   decisions. One log = one JSON object. Fields: `event_type`, `user_id_hash`,
   relevant props. **Never** log PII, tokens, post bodies, comment text, emails.
2. **Metrics on critical paths** — latency histograms, success/failure counters,
   queue depths.
3. **Traces across service boundaries** — AI call, email send, webhook delivery,
   external API. Sentry handles this natively for HTTP; manual spans for queues.
4. **Sentry breadcrumbs before every `try` block** — future-you will thank you.
5. **Analytics event at every meaningful user action** — list in
   `docs/product/analytics-events.md`.

**PII policy (non-negotiable):**

- `user_id` → hashed (sha256 + salt) before logging or analytics
- Email addresses → never logged, never sent to analytics
- Post/comment bodies → never logged, never sent to analytics
- IP addresses → logged for security events only, retained 30 days, then purged
- Tokens/secrets → filtered by framework-level middleware; any leak is a P1

**Deployment order (Phase 0, before feature #1):**

1. Sentry SDK in both Next.js app and server
2. PostHog SDK in Next.js; server-side event emission from tRPC procedures
3. Logtail transport for Pino/Winston structured logger
4. Better Stack uptime monitors on public endpoints
5. Alert rules: error rate spike, P95 latency spike, uptime loss, queue depth

**Consequences:**

- Three vendor accounts to manage + secrets in the vault.
- ~£50/month at MVP scale. Scales with volume; review at 6 months.
- Every feature ships with a dashboard (a saved PostHog insight or Grafana panel).
- Data export agreements checked — all three vendors support UK/EEA residency or
  offer EU processing. Verify at contract time.

**Status:** Active. Install in Phase 0 before any feature PR. Instrumentation
added retrofit always misses the interesting edges.

---

### D038 · Traceability infrastructure — YAML frontmatter + file annotations + `trace` script

**Date:** April 2026
**Tier:** Foundation
**Context:** Moving into code, we need bidirectional traceability: forward (spec →
scenarios → build units → code) and backward (code → build units → scenarios →
spec). Without this, impact analysis is archaeology and regressions hide.

**Decision:** Adopt a six-part convention enforced by automation.

**1. Scenarios reference spec sections.** Every scenario file starts with a
YAML block:

```yaml
---
id: SCN-04
name: Sharon flags a post
spec_sections: ['3.15', '3.15.2', '3.22']
build_units: [BU-flag]
related_scenarios: [SCN-05, SCN-12]
---
```

**2. Build Units are the canonical linked-list node.** Each `docs/build/units/BU-NNN.md`
file begins with:

```yaml
---
id: BU-flag
name: Flagging pipeline
status: proposed | ready | in_progress | done | blocked
scenarios: [SCN-04, SCN-05, SCN-12]
spec_sections: ['3.15', '3.15.2', '3.22']
adrs: [D019]
erd_entities: [Flag, Post, User]
trpc_procedures: [flagPost, listFlags, resolveFlag]
ui_components: [FlagButton, FlagReasonModal, FlagQueueScreen]
events: [post_flagged, flag_resolved]
feature_flags: [ff_flagging_v2]
depends_on: [BU-admin, BU-composer]
blocks: []
estimated_sessions: 3
---
```

**3. Every code file declares its Build Unit.** Top of file:

```typescript
/**
 * @build-unit BU-flag
 * @scenarios SCN-04, SCN-05
 * @spec §3.15
 */
```

Enforced by ESLint custom rule (`require-build-unit-header`). New files without
the header fail CI. The `@spec` tag is enforced by a companion rule
(`require-spec-tag`, F13) — files with `@build-unit` must also have at least
one `@spec` annotation.

**4. ADRs reference the features they constrain.** Already partial — formalise:

```markdown
**Affects:** §3.15.2, BU-flag
**Triggered by:** SCN-04
```

**5. Analytics events declare their source.** In `docs/product/analytics-events.md`,
each event lists the file(s) that fire it and the Build Unit owning it.

**6. `scripts/trace.ts`.** One script, takes any ID (scenario, build unit, file path,
procedure name, component name, event name, ADR ID) and prints the full dependency
tree both directions.

**Consequences:**

- Adds ~5 minutes per Build Unit to maintain.
- Adds ~10 seconds per file to annotate (auto-generated by Claude Code if the
  session brief includes the Build Unit ID — which it should).
- Enables single-command impact analysis before any change.
- Enables regression scope in one query after a bug.
- Enables coverage gap detection (scenarios with no code, ADRs referenced by
  nothing, events declared but never fired).
- Retrofitting this later is 10× the cost of doing it day one. Hence day one.

**Status:** Active. The convention + ESLint rule + `trace.ts` script are Phase 0
deliverables, before the first feature Build Unit. See
`docs/build/README.md` for the full operator's guide.

---

### D039 · Build Unit as the work-scoping primitive

**Date:** April 2026
**Tier:** Foundation
**Context:** We have Feature Spec and Scenarios but nothing between them and code.
Claude Code needs scoped work packages. Humans need "tickets" to pick up. Both
need a unit that maps cleanly down to session briefs and up to scenarios.

**Options considered:**

- **GitHub Issues as tickets** — Rejected as sole mechanism: no structured links
  to scenarios/ADRs/components; search is weak; lives outside the repo.
- **Jira / Linear** — Rejected: weight, cost, context-switch, outside the repo.
- **Markdown files with YAML frontmatter (chosen)** — in-repo, grep-able,
  machine-readable, version-controlled, diff-able in PRs.

**Decision:** Build Units are markdown files in `docs/build/units/BU-NNN.md`.
Schema defined in D038. Ordered in `docs/build/plan.md` by phase.

**A Build Unit:**

- Covers one or more scenarios end-to-end
- Delivers a viewable artifact (scenario demo, Storybook entry, or preview deploy)
- Is chunky enough to represent real progress (1–3 Claude Code sessions)
- Is small enough that a human can hold its scope in their head
- Has explicit dependencies on other Build Units
- Has an owner (even if that owner is "Paul + Claude Code")
- Has a status in {proposed, ready, in_progress, done, blocked}

**Phasing principle:** Vertical slices early. Phase 2 must deliver an end-to-end
demo-able scenario within 2 weeks of Phase 0 completing. Horizontal scaffolding
(all models, then all APIs, then all UI) is rejected — it delays visible progress
and hides integration problems until late.

**GitHub Issues may still be used** for ad-hoc bugs, operational tasks, and
external collaborator asks. They do **not** replace Build Units for planned work.

**Consequences:**

- Planning cadence: weekly pull of 1–3 Build Units from `ready` into `in_progress`.
- No stand-ups, no sprint planning ceremony, no Jira grooming. The Build Plan +
  Build Units + weekly demo is sufficient ritual for a team this size.
- Session Briefs (see `docs/process/session-brief-template.md`) are generated
  from Build Units when starting a Claude Code session.
- Parking lot items become Build Units when they're ready to build (or stay parked).
- "Done" requires the scenario demo recorded, not just PR merged.

**Status:** Active. Build Unit catalogue is the first deliverable after ERD lands.
Target: ~30 Build Units covering MVP scope, sequenced into 4 phases.

### D040 · `work_items` as the unified queue primitive

**Date:** April 2026
**Tier:** Foundation
**Context:** Multiple coordinators must be able to work the same admin
surface from day one without conflicting. The naïve approach is per-domain
queues (one for vetting, one for flags, one for outcome reviews, etc.) each
with its own claim mechanism, audit pattern, notification system, and queue
UI. This produces duplication, drift, and a scattered coordinator
experience ("which page do I check?").

**Options considered:**

- **Six separate queues, six separate UIs (per-domain claim mechanics)**
  Rejected: every queue reimplements the same pattern; coordinators have to
  visit multiple pages to know what needs them; per-domain drift accumulates.

- **One queue list, dedicated detail pages per type (Pattern C)**
  Considered: better than six queues but still requires per-type page
  scaffolding. Marginal gain over Pattern B.

- **One unified `work_items` table, type-driven UI (Pattern B — chosen)**
  All claimable workflows live in one table. Type drives which form/resolution
  flow renders. One claim mechanic, one heartbeat endpoint, one audit pattern,
  one queue UI. Adding a new claimable workflow is metadata + a form
  component, not a new table.

**Decision:** Adopt Pattern B. The `work_items` table is the workflow
primitive; the underlying entities (Flag, Application, Submission, etc.) are
what's being worked on. Schema spec lives in `docs/architecture/claim-and-lease.md`.

**Eight initial types:** `vetting`, `flag`, `outcome_review`, `dedup_merge`,
`edit_request`, `incident`, `content_submission`, `link_submission`. Extends
as features add new claimable workflows.

**Reasoning:**

- One place coordinators look ("what needs me?" → /queue)
- Cross-type queries become trivial ("Sharon's open work this week",
  "average resolution time by type")
- Auto-scaffold synergy — admin-surface.md's auto-generation pattern applies
  cleanly at the queue level too
- Adding a new claimable type is metadata, not new infrastructure

**Consequences:**

- ERD must include `work_items` per spec in claim-and-lease.md (the schema
  block in §"Schema for ERD")
- The `context` JSONB carries type-specific payload; each type defines its
  shape via a TypeScript type + Zod schema
- BU-admin (admin scaffolding) is the first Build Unit and includes the
  generic queue UI on top of work_items
- Per-type resolution forms are specified per-Build-Unit (vetting form in
  BU-vetting, flag form in BU-flag, etc.)
- Five claim/lease design decisions confirmed and locked in claim-and-lease.md
  (single-worker exclusive claims, tab-split queue UI, three-tier release,
  scoped lock — locks the work-item, not the underlying entity)

**Status:** Active. Foundational for ERD. All claimable workflows route
through this primitive.

### D041 · Region as optional tag only; no filtering in MVP

**Date:** April 2026
**Tier:** Foundation
**Context:** Region in GPS Action could mean many things: where members
live, where posts are "for," where events happen, what scope coordinators
have. The initial assumption was that region is identity (pick one at
signup; derive filtering from there). A reframe considered proximity (use
phone location; radius-based filters). After discussion, a simpler answer
emerged.

**Options considered:**

- **Region-as-identity + structured filtering** (original lean). Rejected:
  locks us into a specific model of "where members belong" that may not
  match the community texture.
- **Region-as-proximity, phone-location-driven** (Paul's reframe).
  Rejected: privacy surface, geospatial complexity, council-action still
  needs structured regions anyway.
- **Region as optional informational tag; no filtering in MVP** (chosen,
  per Jeremy's reframe).

**Decision:** Region is an optional tag attached to posts. Members see
every post in their feed regardless of the post's region tag. Queue
managers see every work item regardless of region. No location services,
no postcode collection, no geospatial queries in MVP.

**Schema implications:**

- `Region` table exists (hierarchy: national / region / council) for
  tagging and future council-action features
- `Post.regionTagId` is an optional foreign key to `Region`
- `WorkItem.regionSlug` is informational only (display, not filtering)
- `User` has no `homePostcode`, `homeLat/Lng`, or location-permission fields
- No PostGIS extension needed

**Reasoning:**

- Pilot scale is small; everyone seeing everything is feature, not bug
- Cross-regional solidarity is a value in the movement
- Defers privacy question cleanly (no member location ever collected)
- Preserves optionality — filtering can be added later without schema
  change
- Example use cases ("Event in Manchester," "Urgent — people needed now in
  Glasgow") work with region-as-tag even without filtering

**Consequences:**

- Default feed query: `posts ORDER BY createdAt DESC` with no region filter
- Queue UI: every queue manager sees every work item
- Region picker in post composer: optional dropdown, can be left blank
- Future filtering feature is a parking-lot item with clear trigger
- Council-action features (future Module 11) still use the Region table for
  structured councillor-contact lookup

**Status:** Active. Foundational for ERD Slice 1. See
`docs/product/region-and-proximity-decision.md` for the full decision
memo.

### D042 · Coordinator identity vs queue_manager permission — split into two concepts

**Date:** April 2026
**Tier:** Foundation
**Context:** In early discussions, "coordinator" was conflated with two
different things: (a) a member who runs other communities/groups outside
GPS Action, and (b) a member with elevated permissions to work GPS Action's
queues. Jeremy clarified these are different — coordinators in the
movement sense are _community bridges_, not queue workers. Queue work is
separate.

**Options considered:**

- **One role with multiple capabilities** (the confused earlier model).
  Rejected: conflates identity with permission; "coordinator" carries
  movement-specific meaning that shouldn't be tied to admin privileges.
- **Separate tables, separate semantics** (chosen).

**Decision:** Split into two orthogonal concepts:

**1. Coordinator identity** — data attached to a member describing what
external communities/groups they run.

- Table: `coordinator_profile` (one-to-one optional with User)
- Table: `coordinator_group` (one-to-many under coordinator_profile)
- Captures: group name, optional description, optional logo, optional
  reach estimate (self-reported)
- Self-claim with no verification for MVP (per M3a); admin-verification
  is parking-lot (add when analytics reliability matters)
- Captured at onboarding (optional) and via profile settings (editable)
- Confers no special powers in GPS Action

**2. Queue manager permission** — dynamic grant-based permission to work
queues.

- Table: `role_grants` (with columns for grant provenance and revocation)
- Roles: `queue_manager`, `admin`
- Single-admin grant (MVP); two-admin approval deferred (revisit past ~5
  admins)
- Admin-initiated only (MVP); self-nomination deferred
- Full audit provenance: who granted, when, why; who revoked, when, why
- Revocation auto-releases any claimed work items
- Admin role has special safeguards: no self-revoke; cannot remove the
  last admin

**The two are independent.** Any member can be:

- Just a member (most common)
- A coordinator only (movement bridge, no queue access)
- A queue manager only (queue access, no external groups)
- Both

**Schema implications:**

- `User` gets optional relation to `CoordinatorProfile`
- `User` gets one-to-many relation to `RoleGrant`
- Active role test = exists RoleGrant where `revoked_at IS NULL`
- Admin surface has two new areas: `/admin/coordinators` and `/admin/roles`

**Reasoning:**

- "Coordinator" has real movement-specific meaning that shouldn't be
  tied to admin privileges
- Queue management is a job; coordinator is an identity
- Separating them enables future amplification-reach analytics (which
  coordinators amplify to how many people) without tying to admin
  privileges
- Dynamic role grants with provenance is more auditable than a static
  `user.role` column

**Consequences:**

- BU-001 (admin scaffolding) builds role-grants UI and coordinator-
  profile admin views
- Future amplification analytics can sum reach across coordinators
- Queue-manager cohort can be sized to workload without affecting
  coordinator identification

**Status:** Active. Foundational for ERD Slice 1. See
`docs/architecture/admin-surface.md` for the full role model and schema.

### D043 · Groups as identity markers + queue filters (not permission gates)

**Date:** April 2026
**Tier:** Foundation
**Context:** GPS Action's design has one unified feed (per D041). But
members have natural affinities — writers, BDS responders, geographic
cohorts, skill-based teams. The question: should we have group-style
features, and if so, what do they actually do?

**Options considered:**

- **No groups at all** — keeps unified-feed principle pure. Rejected:
  members do organise into affinities; surfacing this in the data model
  enables operational value (queue routing) and identity (badges).
- **Strong groups with their own feeds and permissions** — Slack/Discord
  pattern. Rejected: fragments the feed; contradicts D041.
- **Light groups: identity + soft queue filtering, no permission impact**
  (chosen).

**Decision:** Groups exist as first-class entities with names,
descriptions, optional logos. Members can join and display group
badges on profiles. Groups can be tagged on posts and work items as
informational metadata. Queue managers can filter the queue by group
to focus on items relevant to communities they identify with.

Crucially: **groups confer no permissions**. Joining a group doesn't
gate visibility, doesn't grant queue-manager rights, doesn't restrict
or expand what members can see. The unified feed remains; groups are
identity + soft routing only.

**Schema implications:**

- New `Group` table (slug, displayName, description, logoUrl, joinPolicy)
- New `GroupMembership` table (user × group, with role member|lead)
- `WorkItem.groupTags` (string[] of group slugs)
- `Post.groupTags` (string[] of group slugs)
- Per-group `joinPolicy` (open | request_to_join | admin_only)

**Reasoning:**

- Members organise into affinities anyway; data-modelling them enables
  operational value
- Queue routing benefits enormously from "show me items relevant to my
  groups"
- Identity badges support member visibility and recognition
- Avoiding permission impact preserves D041's unified-feed principle
- Per-group join policy lets sensitive groups be admin-curated while
  most stay open

**Consequences:**

- BU-groups (Groups foundation) builds the entity, membership, admin UI
- Group filter in queue UI lets queue managers focus
- Group badges visible on profiles, post bylines (subtle)
- Initial seed of ~10 starter groups (Writers, Newsletter Editors,
  Vetting Team, etc.) bootstraps the model
- Phase 2 may revisit: hide-my-groups privacy, group-private feeds,
  algorithmic suggestions

**Status:** Active. ERD Slice 1.5 includes Group + GroupMembership.
Full spec in `docs/product/groups.md`.

### D044 · Intent-first post creation (FAB cards model)

**Date:** April 2026
**Tier:** Foundation
**Context:** A generic composer with a type-picker dropdown imposes 14+
taps for what should be a 4-tap action (sharing a link). The most common
case (share a link) requires the most fields when actually it needs the
fewest. WhatsApp-native posting is ~5 taps; we should match it.

**Options considered:**

- **Single generic composer with type-picker** (original implied model).
  Rejected: 14+ taps for share-a-link; treats every post the same when
  posts have shapes.
- **Multiple composers, no shared shell** — separate pages per type.
  Rejected: code duplication; inconsistent UX; harder to add new types.
- **Intent-first FAB cards leading to purpose-shaped composers**
  (chosen).

**Decision:** The FAB opens a card overlay with 6 intent cards:

- 🔗 Share a link
- 📢 Call for action now
- ✊ Boost something
- 📅 Tell us about an event
- ✏️ Just write something
- 🤔 I'm not sure (escape hatch → generic composer)

Each card opens a purpose-shaped composer with smart defaults
appropriate to that intent. The "I'm not sure" card opens the fully
generic composer with a type-picker for unusual cases.

**Specifics:**

- "Share a link" auto-pastes clipboard URL and fetches og:metadata,
  achieving 4-tap parity with WhatsApp-native sharing
- Each card has its own visibility default (public for amplification
  cards, members_only for general writing)
- Clipboard detection at FAB tap highlights "Share a link"
- Each post records `intentCard` + `postType` so analytics can
  measure card adoption
- "I'm not sure" remains the escape hatch — full flexibility for
  unusual intents

**Reasoning:**

- Most posts are share-a-link; optimise the common case ruthlessly
- Different intents have different field needs; one composer can't
  optimise for all
- Defaults shape behaviour without removing flexibility
- The "I'm not sure" card preserves freedom for cases that don't fit

**Consequences:**

- BU-composer (Composer foundation) and BU-composer-fab (Intent cards) become
  separate Build Units
- Post schema gains `intentCard` and `composerVersion` fields
- Drafts model needed (per the spec) for resume-later support
- Live preview becomes a first-class composer feature
- Help text and smart defaults are integral to the composer, not
  optional polish

**Status:** Active. Full spec in `docs/product/post-creation-flow.md`.

### D045 · Public-by-default post visibility with author override

**Date:** April 2026
**Tier:** Foundation
**Context:** When members share GPS Action posts to WhatsApp/X/etc.,
recipients need a path back to GPS Action — to comment, take action, or
join. Without that, GPS Action is invisible to recipients. The question:
should posts be readable by non-members via deep link?

**Options considered:**

- **All posts members-only.** Recipients tapping a deep link see "join
  to view." Rejected: most posts are _meant_ to be amplified; gating
  defeats the purpose.
- **All posts public.** Anyone can read any post. Rejected: some posts
  (vetting context, incident reports, internal coordination) must NOT
  be visible to non-members.
- **Per-post visibility with public default for amplification post types**
  (chosen).

**Decision:** Every post has a `visibility` enum field with three
values:

- `public` — anyone with the deep link can read; renders server-side
  with og:metadata
- `members_only` — signed-in members only; non-members see a gated
  landing page
- `private` — author and admins only; non-members see a 404

Defaults vary by post type:

- Share a link / Call for action / Boost / Event / Outcome → `public`
- General writing → `members_only` (conservative)
- Incident report → `private`

Author can override per-post in the composer; can change after
posting (with audit log entry).

**Reasoning:**

- The "share a link" use case requires public visibility to fulfil its
  purpose
- Author judgment is the right default-setter; per-type defaults guide
  toward right answer
- Conservative default for general writing prevents surprise
- Three-tier model (public / members_only / private) covers the
  meaningful cases without over-engineering

**Consequences:**

- Public posts render server-side with proper og:image, og:title, etc.
- Non-members landing on public posts see a public view with comments
  hidden; gated by membership for action and engagement
- Members-only posts return a gated landing page to non-members
- Private posts return 404 (indistinguishable from deleted)
- Search engine indexing: public posts opt-in by post type (Boost,
  Event, Action default index; others default noindex)
- Schema additions: `Post.shortId`, `Post.visibility`, deep-link view
  tracking
- BU-deep-link (Deep linking + public post views) becomes its own Build Unit

**Status:** Active. ERD Slice 2 includes the Post visibility model.
Full spec in `docs/product/deep-linking-and-tracking.md`.

### D046 · Image handling phased — day 1 simple, richer later

**Date:** April 2026
**Tier:** Foundation
**Context:** Images appear in many places (avatars, post heroes, group
logos, og:image cards). Building all image features at once would be
heavy. The question: which image features are essential for MVP day 1,
and which can phase in later?

**Options considered:**

- **Build everything at once** — all image features (avatar, hero,
  bank, logos, generated cards) in one Build Unit. Rejected: large
  scope, delays MVP.
- **Skip images entirely for MVP** — text-only product. Rejected:
  posts without images look dead; sharing without preview cards has
  no impact; member identity needs avatars.
- **Phased adoption: simple day 1, richer in 1.5+** (chosen).

**Decision:** Three phases of image richness.

**MVP day 1:**

- Member avatars: upload at signup, or auto-generated initials
- Post hero images: scraped from URL og:metadata, or type-default
  placeholder
- og:image for outbound shares: pulled-through from post hero (Tier 1)
- 5 type-default placeholder images shipped with the app
- EXIF stripping on uploads
- Alt text auto-generated for scraped, member-supplied for uploads

**Phase 1.5:**

- Group logos (admin upload)
- Coordinator group logos (member upload)
- Curated image bank (~30 images, admin-curated)
- Tier 2 generated og:image cards (GPS Action branded; @vercel/og)
- Bank submission queue for member-submitted images

**Phase 2:**

- Member-uploaded post hero images
- Content moderation API integration
- Per-post admin override
- "Show preview images" member setting

**Reasoning:**

- og:image scraping covers the most common case (most posts share URLs
  with og:images)
- Generated cards (Tier 2) are polished but require infrastructure;
  Tier 1 is acceptable while we ship
- Group logos depend on Groups feature itself (Slice 1.5)
- Member uploads add moderation complexity; defer until volume warrants
- EXIF stripping at MVP for privacy; non-negotiable

**Consequences:**

- BU-image (Image handling foundation) covers MVP day 1
- Object storage + CDN serving from day 1
- Schema additions phased: avatars in Slice 1, post hero in Slice 2,
  group logos in Slice 1.5, image bank in Phase 1.5
- Sensitive content concerns documented but not auto-detected at MVP

**Status:** Active. Full spec in `docs/product/image-handling.md`.

### D047 · Honest tracking only (no inflated reach numbers)

**Date:** April 2026
**Tier:** Foundation (process discipline)
**Context:** When members share posts to external platforms, GPS Action
can measure some things reliably (outbound dispatch initiation,
inbound deep-link views) and cannot measure others (third-party
platform impressions, engagement, onward forwarding). Many products
inflate reach numbers using multipliers and guesswork. We will not.

**Options considered:**

- **Inflated reach estimates** — "estimated 12,000 reached based on
  multipliers." Rejected: dishonest; design philosophy principle 5
  forbids it.
- **No tracking at all** — privacy-maximalist. Rejected: members
  legitimately want to know if their shares are landing.
- **Honest tracking of what we can measure, transparent about what
  we cannot** (chosen).

**Decision:** Track and surface to members:

- Outbound dispatch initiations and confirmations (per platform)
- Inbound deep-link views (anonymous, hashed sessions)
- Non-member landings on public posts
- Attributed signups within 7 days of a non-member landing
- Per-post "reach scoreboard" showing the above honestly

Do NOT track or surface:

- Estimated platform impressions (we don't know)
- Estimated likes, retweets, etc. on third-party shares (we can't see)
- Inferred audience reach via multipliers (made-up numbers)
- Onward forwarding beyond first hop (invisible to us)

**Future enhancements (parking-lot, all opt-in):**

- Member self-reporting of platform stats
- Member-authorised API integrations with their X/Facebook accounts
- UTM tagging on outbound URLs (with member consent)

**Reasoning:**

- Honest copy is non-negotiable (design philosophy principle 5)
- Inflated numbers degrade member trust when discovered
- The honest measurements (5 events) are sufficient for pilot decisions
- Future enhancements can add real data without compromising honesty

**Consequences:**

- The "Reach scoreboard" UI shows only verified numbers
- UI copy is precise: "47 views via direct link" not "reached 12,000"
- Schema includes counters for verified events only
- Five new analytics events: dispatch_initiated, dispatch_confirmed,
  deep_link_view, non_member_landed, non_member_signup_attributed

**Status:** Active. Discipline applies to all share/reach UI. Full
context in `docs/product/deep-linking-and-tracking.md`.

# D048 — Post axes taxonomy + deferred PostType

**Status:** Accepted · April 2026
**Context:** ERD Slice 2 minimal session, April 2026
**Superseded by:** —
**Supersedes:** the functional-type list in `docs/product/post-creation-flow.md`
(which is retained as draft reference for future composer design)

---

## Context

During ERD Slice 2 minimal implementation, a contradiction surfaced:

- The session brief specified a 5-value `PostType` enum
  (`dispatch`, `cultural_moment`, `action_call`, `news_share`, `question`)
  — intent/tone-driven
- `docs/product/post-creation-flow.md` specified a different 7-value list
  (`share_link`, `call_for_action`, `boost`, `event`, `general`, `outcome`,
  `incident_report`) — function-driven

Neither is a subset of the other. They solve different problems.

Claude Code surfaced the question: which list should land?

On inspection, we concluded:

1. The two lists mix categorical axes that are genuinely independent
2. Neither list was authoritative — both were working drafts
3. The demo path (Eddie sees a feed of "click-this-and-send-an-email"
   posts, writes one, ships) does not branch on post type at all
4. Committing to either taxonomy now is a premature architectural
   commitment that will constrain the composer design session later
5. A thinking-in-axes framing captures the design space better than any
   single enum

## Decision

### Deferred

**PostType is NOT included in ERD Slice 2 minimal.** Post has no `type`
field. The composer design session (BU-composer) makes the taxonomy
decision, informed by real product scenarios and the 10-axis framing
below.

### The 10 orthogonal axes of a Post

These are the ways a Post can vary, independent of each other. Each
axis can be picked without constraining the others.

#### Axis 1 — Intent / ask-type

What is the author trying to elicit from the reader?

- **Send action** — click this, send an email, sign this, donate
- **Show up** — event, attend, gather
- **Read / absorb** — news, context, explainer
- **Respond / contribute** — question, discussion, request for input
- **Report back** — outcome, incident, observation
- **Amplify / share outward** — boost to your network

#### Axis 2 — Tone / register

The emotional quality, independent of intent.

- **Urgent** — time-pressure, emergency response
- **Steady** — planned campaign, normal cadence
- **Quiet / cultural** — Shabbat, yahrzeit, remembrance, celebration
  (bordeaux colour treatment per design-philosophy.md)
- **Warm / community** — welcome, congratulations, milestone
- **Grave** — antisemitic incident, serious concern

#### Axis 3 — Subject / topic domain

What the post is about.

Expected to be free-text or extensible tags. Examples: council name,
MP name, media outlet, institution, union, police, NHS, education,
international focus, antisemitic-incident specifics. Not an enum —
likely 20-50+ items over time.

#### Axis 4 — Geographic scope

Authorial intent about where this matters.

- National
- Regional (e.g., London)
- Local (single council / borough / ward)
- Diaspora-wide (non-UK relevance)
- Specific venue

Per D041, regions are tags not filter targets in MVP. This axis is
authored metadata, not access control.

#### Axis 5 — Group affiliation

Which internal community this post speaks to or from.

- Already implemented as `Post.groupTags: String[]` (Slice 2 minimal)
  and `WorkItem.groupTags` (Slice 1.5).
- Per D043 — identity markers + queue filters, not permission gates.
- Can be empty, single, or multiple groups.

#### Axis 6 — Audience reach (visibility)

Who can see this post.

- Already implemented as `Post.visibility` enum (Slice 2 minimal).
- Per D045: `public` default, `authenticated_only` per-post override.
- Independent of every other axis.

#### Axis 7 — Artefact type

What the post contains.

- Just text
- Text + external URL (news article, AM campaign, petition)
- Text + image
- Text + video
- Text + document attachment
- Multi-media

Per `image-handling.md`, rich media is phased. MVP = text + optional
external URL. Full artefact support lands with the Attachment model
in Slice 2 full (post-demo).

#### Axis 8 — Call-to-action mechanism

If the post has an action, how does it work?

- **External link** — AM campaign, external petition, news article
  (the demo's only mechanism)
- **Internal action** — reply with your postcode, join this group,
  sign up for workshop
- **WhatsApp dispatch** — forward to your network (D017 boost-as-verdict
  pattern)
- **No action** — informational or cultural moments

#### Axis 9 — Authorship type

Who made the post, in what role?

- Personal (individual member)
- Group-on-behalf (posting as a group's lead)
- Partner organisation (when partner orgs exist — parking lot)
- Official GPS / admin (broadcast from national team)

Mostly derivable from the `author` relation + role grants + group
memberships. No schema field needed initially.

#### Axis 10 — Temporal relevance

How long does this post matter?

- Time-critical (vote tomorrow, deadline Friday)
- Near-term (this week, this month)
- Evergreen (reference material, ongoing campaign)
- Historical / outcome (retrospective, lessons learned)

Independent of tone urgency. Could surface later as `expiresAt
DateTime?` on Post.

### What each axis requires

| Axis                    | Status                      | Where it lives                        |
| ----------------------- | --------------------------- | ------------------------------------- |
| 1 — Intent              | Deferred to composer design | Likely small enum                     |
| 2 — Tone                | Deferred                    | Small enum `PostTone`                 |
| 3 — Subject             | Deferred                    | Free-text tags `subjectTags String[]` |
| 4 — Geographic scope    | Covered via regions         | Region tags (existing pattern)        |
| 5 — Group affiliation   | ✅ Implemented              | `groupTags String[]`                  |
| 6 — Audience reach      | ✅ Implemented              | `visibility PostVisibility`           |
| 7 — Artefact type       | Phased                      | Attachment model (Slice 2 full)       |
| 8 — CTA mechanism       | Partially                   | `activistMailerUrl` is one kind       |
| 9 — Authorship type     | Derived                     | From author + roles + groups          |
| 10 — Temporal relevance | Deferred                    | Optional `expiresAt DateTime?`        |

### Build sequence implications

**Demo path** uses only Axes 5, 6, 8 (partial via AM URL), and 9
(implicit via author relation). No new enums needed.

**Post-demo** adds axes in approximate order:

1. Tone (Axis 2) — small enum, high UX value. Cultural moments need
   the bordeaux treatment soon.
2. Intent (Axis 1) — drives FAB composer cards per D044
3. Artefact types (Axis 7) — Attachment model, Slice 2 full
4. Subject tags (Axis 3) — extensible tag system
5. Temporal (Axis 10) — `expiresAt`, enables filtering stale posts
6. Richer CTA mechanisms (Axis 8) — beyond just AM URLs

## Consequences

### Positive

- **Demo path is unblocked.** No premature taxonomy decision.
- **Design space stays visible.** Future composer design session
  inherits a well-documented multi-axis framework, not one preset
  enum that pre-constrains the conversation.
- **Each axis can be added independently.** Phase 2 work becomes
  incremental and commit-sized.
- **Avoids the collapsing-axes-into-one-enum trap.** Both `PostType`
  drafts (the 5-value and 7-value lists) were trying to collapse
  intent + function into one field. This decision says: don't do
  that; they're independent.

### Negative

- **Temporary ambiguity.** Demo posts have no explicit type — readers
  and authors have to infer from content + context. Mitigated: every
  demo post follows the same pattern ("click this, send an email") so
  there's nothing to disambiguate.
- **Admin UI is slightly less rich for demo.** Post listings can't be
  filtered/grouped by type. Fine — demo has <20 posts; scrolling works.
- **Doc drift risk.** `post-creation-flow.md` still mentions its 7-value
  list. Mitigation: annotate that doc with a pointer to this ADR and
  mark the list as draft-pending-composer-session.

### Neutral

- **Seed data doesn't need type branching.** Every seed Post is the
  same kind. This is fine — it's a demo, not a taxonomy showcase.
- **Future migration is cheap.** Adding an enum to an existing table
  is a simple Prisma migration. No data corruption risk.

## Alternatives considered

### Alternative 1 — Ship with the 5-value brief list

Rejected because:

- The 5 values conflate intent and tone
- `dispatch` vs `action_call` was a known overlap
- Would lock in a taxonomy without composer design input

### Alternative 2 — Ship with the 7-value post-creation-flow.md list

Rejected because:

- `boost` is a verdict per D017, not a post type
- `general` is a catch-all — a smell of insufficient categorisation
- Would lock in a taxonomy without composer design input

### Alternative 3 — Reconcile to a new 6-value list now

Rejected because:

- It's making a taxonomy decision under time pressure during schema
  implementation, rather than during composer design with full context
- Schema urgency shouldn't drive UX taxonomy decisions

### Alternative 4 — Keep a placeholder enum with one value

Considered. Rejected because:

- Adds dead schema
- "general" as the only value invites "just use general" as a habit
- Future migration from enum-with-one-value to real enum is no easier
  than adding an enum fresh

### Alternative 5 — Defer entirely (chosen)

Chosen because:

- Demo path doesn't need it
- Axes framing preserves the design space for composer session
- Additive migration later is cheap

## Related decisions

- **D017** — Boost/remove as verdict, not post type. (Why `boost`
  shouldn't appear in PostType.)
- **D041** — Regions as tags, not filter targets in MVP. (Axis 4
  context.)
- **D043** — Groups as identity markers + queue filters, not
  permission gates. (Axis 5 implementation.)
- **D044** — FAB intent-cards composer. (Will drive Axis 1
  finalisation.)
- **D045** — Post visibility defaults. (Axis 6 implementation.)
- **D046** — Phased image handling. (Axis 7 timeline.)

## Reference

- Originating conversation: April 2026 planning session (post-F03)
- Implementation: ERD Slice 2 minimal PR (amended to remove PostType)
- Future refinement: composer design session (BU-composer brief, TBD)

### 2026-04 update — blocked pending real-post screenshots

GPS leadership has indicated they will provide screenshots of **real
WhatsApp posts** covering the 10-14 post types actually in use. Until
those land:

- **PostType taxonomy is BLOCKED.** Not merely deferred — blocked.
  The composer design session cannot finalise the type list by
  reasoning from first principles; the real vocabulary is in those
  screenshots.
- **Simple BU-composer (demo path) is unaffected.** It has no type
  field per the original D048 decision. Demo proceeds.
- **Full FAB composer (BU-composer-fab, post-demo) is blocked** on
  screenshots arriving.

When screenshots arrive:

1. Add them to `docs/product/post-type-examples/` (new directory)
2. Update `docs/product/scale-and-audience.md` with the validated
   list of post types
3. Draft the PostType enum against real examples
4. Unblock BU-composer-fab

See also: `docs/product/scale-and-audience.md` for related scale
context (350k reach, coordinator-as-default, projected 1,000+
coordinators).

# D049 — Coordinator: role tier or reach attribute? [OPEN]

**Status:** Proposed / Open · April 2026
**Context:** Product strategy input from GPS leadership, April 2026
**Supersedes:** refines earlier assumptions in
`docs/architecture/admin-surface.md` about `coordinator` as a
distinct role tier

---

## Context

GPS leadership clarified (April 2026) that **nearly everyone in GPS
is a coordinator** — defined as "a member with a reachable network
beyond GPS itself, whether 15 friends or 15,000 newsletter
subscribers." The original assumption — that coordinators are a
small power-user tier — is incorrect.

Current scale: 250 members, 200 coordinators. Projected: 1,000+
coordinators out of a growing base. The distinction between "member"
and "coordinator" is vanishing; the meaningful variable is
**reach**, which varies by orders of magnitude.

See `docs/product/scale-and-audience.md` for full scale context.

## The question

Should GPS Action model "coordinator" as:

- **(A)** A discrete role tier (`member` | `coordinator` |
  `queue_manager` | `admin`), as currently in the schema, OR
- **(B)** A continuous attribute on User — e.g.,
  `selfDeclaredReach: Int?` and/or `verifiedReach: Int?` — with
  behaviours gated by reach rather than role, OR
- **(C)** Both — keep `coordinator` as an observable flag for
  "has non-trivial reach" but also track reach as a number

## Options considered

### Option A — Keep `coordinator` as a discrete role

**Pros:**

- Schema unchanged; no migration
- Admin UI mental model stays "grant someone coordinator status"
- Clear yes/no for UI branching ("is this user a coordinator?
  show the amplification flow")

**Cons:**

- The line between "member" and "coordinator" is arbitrary; GPS
  leadership says nearly-everyone has some reach
- Loses information: a coordinator with 15 people and one with
  15,000 are treated identically
- The word "coordinator" implies a small special group — which isn't
  reality
- Invites disputes at the edges ("am I a coordinator? I've got a
  small WhatsApp group")

### Option B — Replace with `reach` attribute

**Pros:**

- Captures the continuous variable that actually matters
- No arbitrary line; small reach is still reach
- Enables richer UI decisions (show dispatch flow to anyone with
  reach > 10, not just those granted coordinator)
- Matches the product strategy: amplification is the mechanism

**Cons:**

- Schema change (add fields to User, deprecate coordinator role)
- Migration path for existing coordinator role grants
- Self-reported reach is unreliable; users may over- or under-state
- Verification of reach is its own workstream
- Admin UI becomes "how do we surface reach" rather than "grant/
  revoke coordinator"

### Option C — Keep role AND add reach

**Pros:**

- Best of both — role for UI branching, reach for nuance
- Smooth migration (existing role grants keep meaning)
- Role can be derived from reach (reach > threshold → automatic
  coordinator tag)

**Cons:**

- Two sources of truth can drift
- Adds schema complexity without clear necessity
- Defers the real decision ("what's the canonical attribute?")

### Option D — Do nothing right now

**Pros:**

- Demo path doesn't care about this question
- Moving fast matters; this is a Phase 2 concern
- More information may emerge (what does GPS actually use
  "coordinator" to mean in practice?)

**Cons:**

- The admin surface (BU-admin) will assume one of the models;
  whichever it picks is hard to undo
- Continues building against an incorrect mental model

## Recommendation (not yet decided)

**Option D for now, with a commitment to decide before BU-admin.**

The demo path doesn't need this resolved. But BU-admin (full admin
surface) does — the role-grant UI will be quite different under
Option A vs. B. Forcing a decision in the next 4-6 weeks is
reasonable. Before deciding, it would help to:

1. Understand how GPS currently uses the word "coordinator" — is
   there an operational meaning beyond "has reach"?
2. See the real post-type screenshots — different post flows may
   reveal what role branching is actually for
3. Talk to 3-5 coordinators about how they self-identify and what
   they expect from the tool

Only then commit to A, B, or C.

## Decision

**NOT YET DECIDED.** This ADR documents the question and options so
the design space is visible. When a decision is made, this file is
updated to "Accepted" with the chosen option.

Target decision date: before BU-admin brief is written (within ~6
weeks).

## Consequences if we keep the question open

- BU-admin waits for this decision, OR builds against Option A
  (current schema) with awareness that migration may follow
- Admin UI design sketches support both models pending decision
- Product discussions surface the question so decision isn't made
  by default

## Related

- `docs/product/scale-and-audience.md` — the 350k reach number and
  coordinator-as-default principle
- `docs/architecture/admin-surface.md` — the existing role model
- `docs/architecture/decision-log.md` D042 — role grants as currently
  modelled
- `docs/architecture/decision-log.md` D048 — PostType taxonomy
  (also blocked on GPS input)
- Parking-lot: "Reach as schema attribute" (to be added)

## Meta

This ADR is intentionally **open** (not accepted). Documenting open
questions as ADRs makes them harder to forget and easier to resume.
When product context arrives, revisit this doc and resolve.

---

# D050 — Reaction schema, fixed 8-emoji set, polymorphic target

**Date:** April 2026
**Tier:** Feature
**Status:** Accepted
**Build Unit:** BU-reactions

## Context

BU-reactions adds quiet, multi-select reactions to posts (Scenario 3
in `docs/product/scenarios.md`). The schema and emoji-set choices
deserve a recorded decision because:

1. Emoji sets drift unless pinned. The existing
   `analytics-events.md:136` says "14 core + 3 seasonal", the
   parking-lot ("Reaction taxonomy — fixed set vs configurable")
   says 8 fixed. We need one source of truth.
2. The Reaction primitive must be forward-compatible with comments
   (BU-comments), but comments aren't built. Schema shape now affects
   migration cost later.
3. The "react to one thing with many emoji" semantics aren't a
   given — Slack does it (multi-select), iMessage doesn't
   (single-select per recipient). Scenario 3 has David picking two
   emoji on one post, so multi-select wins.

## Decisions

### 1. Fixed 8-emoji set (for now)

Ship with the eight emoji listed in the parking-lot "Reaction
taxonomy" entry: 🕯️ 🙏 ❤️ 💪 🎯 💕 👍 😢. Stored as enum values
(`candle`, `pray`, `heart`, `strong`, `target`, `sparkle`,
`thumbsup`, `sad`) — emoji-to-glyph mapping lives in the UI.

The parking-lot keeps a separate "Expand the reaction set" story
parked, triggered by real-usage data after BU-reactions ships.

The `analytics-events.md` "14 core + 3 seasonal" line is treated
as forward-looking — that's where the set might grow to. No code
in this BU touches the analytics doc.

### 2. Multi-select per user per post

A user can react with any number of emoji to the same post. Each
emoji is its own row. Toggling an existing reaction off deletes
the row.

Constraint: `(userId, targetType, targetId, emoji)` is unique. A
user can't double-react with the same emoji on the same post.

### 3. Polymorphic target via `targetType` + `targetId`

The `Reaction` model uses a polymorphic shape:

- `targetType: ReactionTargetType` enum — only `post` value at MVP
- `targetId: String` — the target's id

A separate `postId` FK column carries the concrete relation so
Prisma can express it and cascade-delete works. When BU-comments ships
(comments), it adds a `commentId` FK alongside; the
`ReactionTargetType` enum gains a `comment` value.

Why polymorphic now: changing the schema later (when comments
ship) is more expensive than carrying the slight redundancy
(`targetId` + `postId`) today. The UI never sees this — service
layer normalises the shape.

### 4. Self-reaction allowed

Authors can react to their own posts. No special-case in the
router or UI. Reactions are a community signal, not a vanity
metric.

### 5. Feature flag `ff_reactions`

Per D036, every substantial feature ships behind a flag. A new row
in `FeatureFlag` (seeded with `enabledGlobally: true` in dev) gates
both `reaction.add` (server) and `<ReactionPill />` (client). No
flag → fail closed (rule defaults to disabled).

The flag helper itself (`server/lib/flags.ts`) is built minimally
in BU-reactions: reads `enabledGlobally` only. Per-user / per-region
/ rollout-percentage evaluation is deferred to its own follow-up.

## Consequences

- New schema: `ReactionEmoji` enum (8 values), `ReactionTargetType`
  enum (1 value), `Reaction` model (with one unique constraint and
  two indexes)
- New tRPC router: `reaction.add`, `reaction.remove`,
  `reaction.listForPost`
- `listPosts` returns a `reactions` field per post
- `server/lib/flags.ts` exists with `isFeatureEnabled(name)`
  — reads `FeatureFlag.enabledGlobally` only at MVP
- The `reaction_added` analytics event fires on add (per
  `analytics-events.md:133`); `reaction.remove` fires nothing
- Future BU-comments extends `ReactionTargetType` and adds
  a `commentId` column — small migration, contract-stable
- Future flag-helper expansion adds per-user / region / percentage
  eval; existing call sites don't change

## Alternatives considered

- **Single-select per user per post** (rejected) — Scenario 3 has
  David picking two emoji
- **Free-text emoji** (rejected) — stable analytics + UI need a
  fixed set
- **`targetId` only, no concrete FK** (rejected) — Prisma can't
  cascade or express the relation
- **Build the full flag-evaluation engine in BU-reactions**
  (rejected) — scope creep; minimal helper unblocks Q4 of the brief
  without committing to the full D036 design

## Related

- Brief: `docs/build/session-briefs/bu-reactions.md`
- Decision: D036 (feature flags)
- Decision: D045 (post visibility — reactions inherit)
- Spec: `docs/product/analytics-events.md` (`reaction_added` event)
- Parking-lot: "Reaction taxonomy — fixed set vs configurable"
- Parking-lot: "Expand the reaction set" (parked story for after
  real usage data)

---

# D051 — Build Unit naming: semantic names, not numbers

**Date:** April 2026
**Tier:** Foundation
**Status:** Accepted
**Build Unit:** N/A (process decision)

## Context

Pre-D051, Build Units (BUs) were referenced by number across the
docs — BU-002, BU-003, etc. Three independent numbering schemes
emerged:

- `bu-sequence.md` had its own scheme (BU-007 = Inbound sharing)
- `analytics-events.md` + `copy-library.md` had a different one
  (BU-007 = Comments, BU-008 = Reactions)
- Side-spec docs (`inbound-sharing.md`, `share-out-mechanics.md`,
  `deep-linking-and-tracking.md`, `image-handling.md`) each
  self-claimed numbers that didn't agree with either of the above

Even within the "non-bu-sequence" cluster the schemes drifted:
`inbound-sharing.md:8` claimed BU-010 = Inbound sharing while
`analytics-events.md:146` had BU-010 = Sharing (out).

Meanwhile, every BU that has actually shipped or has a brief uses
**semantic names** organically: BU-001-lite, BU-feed, BU-composer,
BU-am-link, BU-reactions. The numbering only existed in planning
docs that hadn't shipped — and disagreed on what each number meant.

## Decision

**Drop BU numbers entirely. Use semantic names.**

Format: `BU-<short-noun-or-noun-phrase>` — lowercase, hyphenated.

Numbered BUs that have already shipped keep their historical
identifier (BU-001-lite). All other references are renamed per the
canonical mapping below.

Umbrella BUs (was: BU-021 Slice 2 full / BU-022 Slice 3 / BU-023
Slice 4) decompose into named sub-BUs. The umbrellas themselves
become parking-lot or roadmap groupings, not BUs in their own right.

## Canonical mapping

These names are now authoritative. Any pre-existing numbered
reference in any doc maps to the corresponding name.

| Old number(s) — context                                                  | New name                 | Status                         |
| ------------------------------------------------------------------------ | ------------------------ | ------------------------------ |
| BU-001 (full admin in original brief)                                    | `BU-admin`               | not started                    |
| BU-001-lite                                                              | `BU-001-lite`            | shipped — historical name kept |
| BU-002 (real auth / onboarding)                                          | `BU-auth`                | not started                    |
| BU-003 (post publishing in analytics)                                    | `BU-composer`            | shipped                        |
| BU-003 (vetting in bu-sequence) / BU-004 (vetting in analytics)          | `BU-vetting`             | not started                    |
| BU-005 (FAB composer in bu-sequence, D044)                               | `BU-composer-fab`        | not started                    |
| BU-005 (feed in analytics)                                               | `BU-feed`                | shipped                        |
| BU-006 (dispatch in bu-sequence) / BU-011 (dispatch in analytics)        | `BU-dispatch`            | not started                    |
| BU-006 (actions in analytics)                                            | `BU-actions`             | not started                    |
| BU-007 (inbound sharing in bu-sequence) / BU-010 (in inbound-sharing.md) | `BU-inbound-share`       | not started                    |
| BU-007 (comments in analytics)                                           | `BU-comments`            | not started — next             |
| BU-008 (groups in bu-sequence)                                           | `BU-groups`              | not started                    |
| BU-008 (reactions in analytics)                                          | `BU-reactions`           | shipped                        |
| BU-009 (flag+moderate in bu-sequence) / BU-012 (flagging in analytics)   | `BU-flag`                | not started                    |
| BU-009 (dedup in copy-library) / BU-010 (dedup in bu-sequence)           | `BU-dedup`               | not started                    |
| BU-010 (sharing in analytics) / BU-013 (share-out flows in side-specs)   | `BU-share-out`           | not started                    |
| BU-011 (outcome review in bu-sequence)                                   | `BU-outcome-review`      | not started                    |
| BU-012 (partner orgs in bu-sequence)                                     | `BU-partner-orgs`        | not started                    |
| BU-013 (coord verification in bu-sequence)                               | `BU-coord-verify`        | not started                    |
| BU-014 (deep linking in deep-linking-and-tracking.md)                    | `BU-deep-link`           | not started                    |
| BU-015 (image handling)                                                  | `BU-image`               | not started                    |
| BU-020 (full admin in bu-sequence — was renamed from BU-001)             | `BU-admin`               | not started                    |
| BU-021 (Slice 2 full umbrella)                                           | (decomposes — see below) | partially shipped              |
| BU-022 (Slice 3 umbrella)                                                | (decomposes — see below) | not started                    |
| BU-023 (Slice 4 umbrella)                                                | (decomposes — see below) | not started                    |

### Umbrella decomposition

**BU-021 Slice 2 full** decomposes into:

- `BU-comments` (Comment model + threaded UI)
- `BU-reactions` (shipped — D050)
- `BU-attachments` (image / link attachment on posts)

**BU-022 Slice 3** decomposes into:

- `BU-application` (Application entity for vetting workflow)
- `BU-flag` (Flag entity, already named above)
- `BU-outcome-review` (already named above)
- `BU-edit-request` (post-edit approval entity)
- `BU-content-submission` (third-party content submission entity)
- `BU-vouch` (vouching ledger entity)

**BU-023 Slice 4** decomposes into:

- `BU-contact` (Contact entity — councillors, MPs, etc.)
- `BU-resource` (Resource entity — templates, links, files)
- `BU-route` (Route entity — WhatsApp dispatch routing)
- `BU-dispatch-event` (DispatchEvent entity — the audit trail)
- `BU-partner-orgs` (already named above)

## Consequences

- All planning docs migrate per the mapping above (sweep PR).
- Future docs MUST use semantic names. No numbered BUs from this
  point forward (except `BU-001-lite` historical).
- ADR numbers (D001..D051) and F-rule numbers (F03, F06, F13–F15)
  are unaffected — different namespaces.
- Briefs that reference old numbers get updated when next touched
  (lazy migration is fine for files outside the sweep PR's scope).
- Code annotations (`@build-unit BU-XXX` JSDoc tags) currently use
  semantic names already — no code changes needed.

## Why semantic names

- **Stable.** Names don't drift when scope is reordered. A number
  for "the third BU" gets stale the moment a fourth BU is inserted
  earlier.
- **Self-describing.** `BU-comments` tells a reader what it is.
  `BU-007` requires lookup in 1+ docs.
- **Already organic.** Every shipped BU post-demo used a name. The
  numbers were vestigial.
- **Decomposable.** Umbrellas like Slice 2 don't fit a single
  number; they fit a list of sub-BUs.

## Alternatives considered

- **Pick one numbered scheme and migrate everything to it.**
  Rejected — every numbered scheme already disagreed with at least
  one other; choosing a winner doesn't solve the underlying drift.
- **Hybrid (numbers for umbrellas, names for sub-BUs).** Rejected
  — adds ceremony without stability benefit; numbers still drift.
- **Status quo (live with the disagreement).** Rejected — every
  brief writer would have to pick a side.

## Related

- `docs/build/bu-sequence.md` — the canonical sequence doc, now
  uses names
- `docs/process/ratchet-discipline.md` — same philosophy: forward-
  only, mechanically enforced where possible
- `CLAUDE.md` — points at this decision as the naming authority

---

# D052 — Comment schema + polymorphic reuse of ReactionTargetType

**Date:** 2026-04-26
**Tier:** Feature
**Status:** Accepted
**Build Unit:** BU-comments

## Context

BU-comments adds the post-detail page with a flat discussion thread
(per Scenario 20). The schema needs a Comment entity, and reactions
must be able to target comments — extending the polymorphic shape
established in D050 for the Reaction primitive.

Comments must be:

- Attachable to posts (only target type at MVP — `comment-on-comment`
  threading is parking-lot)
- Soft-deletable (audit-friendly; preserves thread coherence)
- Reactable, eventually (schema-ready now; UI deferred)
- Visibility-respecting at the parent post level (comments inherit
  the post's `visibility`)

## Decisions

### 1. Comment model — flat, post-scoped

`Comment` model carries `postId` (required FK), `authorId` (required
FK), `body` (string, 1–5000 chars at the validation layer),
`createdAt`, `updatedAt`, `deletedAt` (soft-delete). Indexes on
`(postId, createdAt)` for thread render + `(authorId, createdAt)`
for the "your comments" admin view + `(deletedAt)` for cleanup
sweeps.

`onDelete` policy:

- `Comment.author`: Restrict (mirrors `Post.author` — a user with
  comments can't be hard-deleted; soft-delete preserves community
  history)
- `Comment.post`: Cascade (if a post is hard-deleted — rare; posts
  use soft-delete — its comments go with it; no orphans)

### 2. Extend `ReactionTargetType` rather than create a parallel

reaction-on-comment primitive

Per D050, `ReactionTargetType` was designed polymorphic with the
explicit forward intent of accommodating comments. This BU
delivers on that intent:

- Add `comment` value to `ReactionTargetType`
- Add `commentId String?` FK on `Reaction` (nullable, since
  existing post-reactions remain post-targeted)
- Cascade on Comment delete (if a comment vanishes, its reactions
  go with it)

The `(userId, targetType, targetId, emoji)` unique constraint
already accommodates the new target type without modification.

### 3. No edit / delete UX in MVP

Authors cannot edit or delete their own comments. Coordinators
cannot remove or pin comments. These all land later (BU-flag /
BU-admin / a dedicated edit-window BU). The `deletedAt` column
exists for future use; manual DB / admin-patch is the escape
hatch if a comment must be removed urgently.

### 4. Body length cap: 5000 characters

Matches the Post body upper bound. Soft hint at 4000 in the UI.
Zod rejects above 5000.

### 5. Sort: oldest-first

Chronological reading order per Scenario 20. Newest-first was
considered and rejected — discussion threads read top-to-bottom,
not bottom-to-top.

### 6. Visibility inheritance

Comments inherit the parent post's `visibility`:

- `public` post → comments visible to everyone (server-render)
- `members_only` → comments visible only to authed callers; gated
  landing for unauthed
- `private` → comments visible only to author + admins; 404 for
  non-authed (per D045)

The service layer applies the visibility filter at the parent-post
level, not per-comment. This keeps the model simple.

### 7. `commentCount` on `listPosts`

The feed render shows a "💬 N comments" affordance per card. The
count is derived from a single `groupBy postId` query joined into
service code (mirrors the `listReactionsForPosts` bulk pattern from
D050; avoids N+1).

## Consequences

- New schema: `Comment` model + `ReactionTargetType.comment` enum
  value + `Reaction.commentId` nullable FK
- New tRPC router: `comment.add`, `comment.listForPost`
- `listPosts` returns a `commentCount` field per post
- New page route: `/post/[id]` — first dynamic route in the app;
  deep-linkable per D045
- New components: CommentList, CommentItem, CommentComposer
- Behind `ff_comments` feature flag (per D036)
- Reactions-on-comments schema is ready; UI is a follow-up
- BU-flag / BU-admin can now build moderation surfaces that
  reference Comment

## Alternatives considered

- **Threaded replies (parentCommentId)** — rejected for MVP. Flat
  thread is enough for SCN-20. Future addition is non-breaking
  (add nullable `parentCommentId` later).
- **Comment-level visibility flags** — rejected. Inherit from the
  parent post; one source of truth.
- **Author edit-within-window UI in this BU** — rejected. The
  `updatedAt` column exists but no UI updates it in MVP. Out of
  scope per the brief.
- **Build a separate ReactionOnComment table** — rejected. Reuse
  the polymorphic shape from D050 instead. One Reaction table is
  the right primitive.

## Related

- Brief: `docs/build/session-briefs/bu-comments.md`
- Decision: D050 (Reactions polymorphic schema this BU extends)
- Decision: D045 (Post visibility — comments inherit)
- Decision: D036 (Feature flags)
- Spec: `docs/product/analytics-events.md` (`comment_added` event)
- Scenario: SCN-20 (Eddie writes his first comment)
- Parking-lot: "Comment-on-comment threading" (deferred)
- Parking-lot: "Edit / delete comments UX" (to be added if needed)

---

# D053 — trace.ts output format + parked-scenario marker

**Date:** 2026-04-26
**Tier:** Foundation
**Status:** Accepted
**Build Unit:** BU-trace

## Context

D038 §6 specced `scripts/trace.ts` as a Phase 0 deliverable. The
script was deferred. BU-trace builds it. Output format + check
thresholds + parked-scenario semantics deserve recorded
rationale.

## Decisions

### 1. Three modes, one entrypoint

`npm run trace <id>` for single-ID lookup (forward + reverse).
`npm run trace:check` for CI guard. `npm run trace:matrix` to
regenerate the markdown matrix.

### 2. Parked-scenario marker: `<!-- @no-code-yet -->`

HTML comment placed on the line immediately after a
`### Scenario N` heading exempts the scenario from the
`trace:check` zero-refs failure mode. Invisible in rendered
markdown. Removed when the scenario gains backing code.

Why HTML comment: scenarios.md is plain markdown. Frontmatter is
overkill for a single boolean. Inline shortcodes look weird in
prose.

### 3. Matrix file: `docs/architecture/traceability-matrix.md`

Architecture-flavoured (sits with ADRs). Generated by
`trace:matrix`. Committed to git. CI fails if drifted (i.e. if
running matrix produces a file different from the committed one).

Why commit: a one-glance health snapshot in PRs is high-value.
Why drift-check: prevents the matrix from going stale.

### 4. Check thresholds — what fails CI

`trace:check` exits non-zero when:

- A code file's `@spec product/scenarios.md (SCN-N)` references an
  N that doesn't exist in scenarios.md
- A code file's `@spec architecture/decision-log.md (D0NN)`
  references a D-number that doesn't exist
- A code file's `@build-unit BU-<name>` references a name not in
  the canonical list (per D051 — for now, soft-warn until a
  registry exists)
- A scenario has zero backing code files AND no
  `<!-- @no-code-yet -->` marker

`trace:check` exits non-zero (drift) when:

- The committed `traceability-matrix.md` doesn't match the output
  of `trace:matrix`

### 5. Legacy `@scenarios SCN-N` tags warn but don't fail

Some early files use `@scenarios SCN-04` instead of the canonical
`@spec product/scenarios.md (SCN-4)`. The script accepts both,
prints a deprecation warning, and treats the legacy tag as
equivalent. A future cleanup PR can ratchet to hard-error after a
sweep.

### 6. CI placement: after lint, before tests

`trace:check` is a fast static-analysis pass. Failing it before
the test suite saves CI time and surfaces missing references at
the same point F-rules surface them.

### 7. Performance target: <2s on cold cache

Soft target. The whole repo is small (<200 source files). If perf
degrades as the codebase grows, optimisation is fair game (memoise
file reads, parallelise globs).

### 8. Direct references only — no transitive chains

The script reports immediate `file → scenario`, `scenario → file`,
`file → ADR`, `BU → file` edges. No "scenario → BU → ADR → other
BUs that depend on it" chain expansion. Transitive analysis is a
future enhancement.

## Consequences

- 17 parked scenarios get `<!-- @no-code-yet -->` markers in this
  PR (the ones without backing code today: SCN-1, 2, 4–17, 19;
  SCN-3, 18, 20 are unmarked because they're shipped)
- New code files needing scenario backing add `@spec
product/scenarios.md (SCN-N)` per D038
- The matrix becomes a recurring artefact in PR reviews
- The legacy `@scenarios` tag becomes a deprecation target

## Alternatives considered

- **No matrix file, regenerate on demand only.** Rejected — losing
  the one-glance reviewer view costs more than the drift-check
  ceremony.
- **Hard-error on legacy `@scenarios` tags.** Rejected — would
  require a sweep first; deferred to a future cleanup.
- **Frontmatter parked-scenario marker.** Rejected — overkill for
  a single boolean.
- **Transitive chain expansion in MVP.** Rejected — direct edges
  cover 95% of the value at a fraction of the complexity.

## Related

- Parent: D038 (traceability discipline; this BU implements §6)
- D051 (BU naming — referenced by the BU-name resolution logic)
- F06 rule 1 + F13 + F14 (the three lint rules whose tags this
  script reads)
- Brief: `docs/build/session-briefs/bu-trace.md`

---

# D054 — Request entity (the unified "things needing decision/discussion" surface)

**Date:** 2026-04-26
**Tier:** Foundation
**Status:** Accepted
**Build Unit:** BU-requests (forthcoming)

## Context

The system needs a single home for everything the moderation /
admin / vetter team picks up and resolves: vetting applications,
flagged content, edit requests, post drafts submitted for review,
auto-generated tips, urgent calls for help, and so on.

Pre-D054, this surface had three overlapping concepts:

1. The `WorkItem` entity (per claim-and-lease.md / D040) — a polymorphic
   queue with 8 types and `unclaimed/claimed/in_review/resolved`
   statuses.
2. The bottom-tab "Inbox" (per D030) — a member-facing nav slot,
   never specced beyond the label.
3. Admin "inbox"-style notifications (per SCN-5) — a third hand-wavy
   surface for things like account-recovery requests routed to a
   coordinator.

These three were never reconciled. The user-facing UX implication
("how does Eddie see his vetting application status? where does Maya
pick up a flag? where does Jeremy see an escalation?") fell through
the gaps.

D054 collapses all three into one entity, one surface, one status
enum.

## Decisions

### 1. Naming

| Layer           | Name                                                                 |
| --------------- | -------------------------------------------------------------------- |
| Entity          | `Request`                                                            |
| Tab / surface   | "Requests" — replaces "Inbox" in D030                                |
| Schema rename   | `WorkItem` → `Request`, `WorkItemType` → `RequestType`               |
| F14 area prefix | rename `inbox` → `requests` (one-shot sweep when BU-requests builds) |

"Request" was chosen over alternatives (`Submission`, `Case`,
`Ask`, `Item`) because:

- It accommodates the breadth: vetting requests, post-review
  requests, system-generated tips, urgent help requests
- Plain English; not formal (Submission) or heavy (Case)
- Already used naturally in product writing ("requests are new /
  in discussion / done")
- Reads well in copy: "3 requests waiting", "your request is in
  discussion", "Sharon raised an urgent request"

### 2. Three statuses (collapsed from claim-and-lease.md's five)

| Status          | Meaning                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `new`           | Created. Awaiting reviewer pickup.                                                                                    |
| `in_discussion` | A reviewer has claimed it. Threaded discussion may be open with the submitter, with internal reviewer notes, or both. |
| `done`          | Resolved with an outcome (approved / dismissed / rejected / edited / published / archived / etc., type-specific).     |

This collapses claim-and-lease.md's `unclaimed → claimed →
in_review → resolved` into three. `claimed` and `in_review` were
operationally indistinguishable; merging them as `in_discussion`
matches how reviewers actually work the queue.

### 3. Eleven types (extends claim-and-lease.md's eight)

The eight existing: `vetting`, `flag`, `outcome_review`,
`dedup_merge`, `edit_request`, `incident`, `content_submission`,
`link_submission`.

Three new:

| Type                | What it is                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `draft_post`        | A member sends a post for team review before publishing. Outcomes: publish / archive / delete.                                              |
| `system_suggestion` | Auto-generated tip — "the system noticed X, should we make a post?" Outcomes: act on it / dismiss.                                          |
| `alert`             | Urgent help / awareness call. Auto-`urgency=urgent` (per D058). Created via the FAB alert tile by members. Outcomes vary by alert category. |

### 4. Submitter is a first-class participant

Every Request has a `submitterId` (User or system marker). The
submitter:

- Reads the Request's status as it changes (notifications fire)
- Reads the `audience: 'all'` slice of the discussion thread (per
  D056)
- Can post replies to the thread (always `audience: 'all'`)
- Cannot resolve, claim, or change status

System-generated requests (`system_suggestion`) have a synthetic
`submitterId` (a designated system user, e.g. `system@gps-action`).

### 5. Discussion thread reuses Comment primitive

A Request's discussion is a thread of `Comment` rows with
`targetType: 'request'` (extends D050's `ReactionTargetType`-style
polymorphism). The Comment model gains a nullable `requestId` FK
mirroring how `commentId` was added in D052.

Per-comment audience flag is captured in D056.

### 6. The eleven outcomes are type-specific

`done` requests carry an `outcome` field whose valid values depend
on `type`. Service-layer validation enforces the type×outcome
matrix; details land in BU-requests's brief.

Examples:

- `vetting` outcomes: `approved` / `declined` / `withdrawn`
- `flag` outcomes: `dismissed` / `removed` / `escalated_to_admin`
- `draft_post` outcomes: `published` / `archived` / `deleted`
- `alert` outcomes: `acted_published_post` / `acted_dispatched` / `dismissed_no_action`

## Consequences

- Schema migration: rename `WorkItem` → `Request` table, columns,
  enum, FKs. Status enum collapse with data backfill.
  `unclaimed → new`, `claimed/in_review → in_discussion`,
  `resolved → done`.
- New `Request.outcome` column (text, type-specific values
  enforced in service layer)
- New `Request.alertCategoryId` nullable FK (per D058)
- Comment model gains `requestId` nullable FK
- `ReactionTargetType` enum gains `request` value (forward-compat;
  reactions on requests are not part of MVP but schema-ready)
- F14 `inbox` area prefix renames to `requests` (sweep)
- `bu-sequence.md` updated: BU-requests becomes a named BU
- `claim-and-lease.md` updated to reflect the simplified status
  set (or the file is renamed since "claim and lease" is now a
  sub-section of D054's larger architecture)

## Alternatives considered

- **Keep WorkItem name; add types.** Rejected — the old name was
  warehouse-y and didn't capture the editorial / urgent flavours.
- **Split into Request + Submission + Alert separate entities.**
  Rejected — three entities with near-identical lifecycles (claim,
  discuss, resolve) collapse to one with type as a discriminator.
- **Five statuses.** Rejected — claim-and-lease's `claimed` vs
  `in_review` was a distinction reviewers didn't experience.
- **Submitter sees everything in the thread.** Rejected (per
  D056) — internal reviewer deliberation needs a private channel.

## Related

- D040 (work_items as the queue primitive — superseded by D054 in
  naming and status taxonomy; the underlying single-table polymorphic
  design is preserved)
- D041 (region as tag, not filter — preserved)
- D042 (coordinator vs queue-manager split — preserved; extended in
  D055)
- D055 — per-type role scopes (companion ADR)
- D056 — Comment audience model (companion ADR)
- D057 — Notifications entity (companion ADR)
- D058 — urgency + alerts + admin-configurable TTL (companion ADR)
- D044 (FAB intent-cards composer — the alert tile lands when
  BU-composer-fab ships per D058)
- SCN-21, SCN-22, SCN-23 — canonical Requests UX scenarios

---

# D055 — Per-type role scopes (granular reviewer permissions)

**Date:** 2026-04-26
**Tier:** Foundation
**Status:** Accepted
**Build Unit:** BU-requests (forthcoming)

## Context

Today the `queue_manager` role is one flat capability — anyone with
the role sees every work item across all 8 types. Per the
real-world pattern surfaced in scenarios:

- SCN-12 has Sharon as "a writer with the vetter permission flag" —
  per-type specialisation, not generalist
- SCN-10 has Maya doing flag triage — different scope
- SCN-14 has Jeremy at director level

The flat model conflates two different deployments:

1. A small pilot team where everyone does everything (flat is fine)
2. A scaled team where vetters specialise on vetting and flag-mods
   specialise on flags (flat over-permissions everyone)

Today's pilot-stage GPS Action is closer to (1), but the schema
choice now affects (2). Granular scopes don't cost much at MVP and
prevent retrofitting later.

## Decision

`RoleGrant` gains a `scope` column. Granted permissions become a
`(role, scope)` pair.

### Schema

```prisma
model RoleGrant {
  // existing fields preserved
  role  SystemRole
  scope String      @default("*")  // NEW
}
```

### Scope values

A free-text column with conventional values; service-layer
validation enforces the convention.

| Scope                | Meaning                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `*`                  | All scopes (matches every type). The default for backwards-compat. |
| `vetting`            | Only `vetting` Request type                                        |
| `flag`               | Only `flag`                                                        |
| `flag:child_safety`  | Only flags with the child-safety category                          |
| `outcome_review`     | Only outcome reviews                                               |
| `edit_request`       | Only member edit requests                                          |
| `incident`           | Only incidents                                                     |
| `content_submission` | Only content submissions                                           |
| `link_submission`    | Only link submissions                                              |
| `dedup_merge`        | Only dedup merges                                                  |
| `draft_post`         | Only post drafts                                                   |
| `system_suggestion`  | Only system tips                                                   |
| `alert`              | Only alerts                                                        |

A user can hold multiple grants — Sharon might have
`(queue_manager, vetting)` and `(queue_manager, draft_post)`.

### `requireRole` middleware update

`server/lib/trpc.ts` `requireRole` middleware accepts an optional
scope:

```ts
requireRole('queue_manager', { scope: 'vetting' });
// passes if user has any grant where:
//   role = queue_manager AND (scope = 'vetting' OR scope = '*')
```

For `admin` role, scope is ignored (admin = always `*`).

For procedures that don't care about scope (e.g.
`requests.listMine` for submitters), `requireRole` isn't called —
plain `authedProcedure` is used.

### Visibility vs action separation

Two different scope checks at two different layers:

| Check                     | Used for                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **List/visibility scope** | "Which requests can this user _see_ in their Requests tab?" Filters at query level. Out-of-scope items don't appear (except urgent — see D058). |
| **Action scope**          | "Can this user _claim, comment-as-reviewer, or resolve_ this request?" Enforced in mutation procedures via `requireRole({ scope: <type> })`.    |

The two are linked: if you can't see it, you can't act on it (the
API rejects). But you might see something (urgent broadcast) you
can't act on.

### Director — not a separate role

Per the user's call: directors stay as `admin` role. Director-only
tools (lineage check, network pin) check on `admin` plus a specific
user attribute or named permission grant — not a new role tier.
Captured in BU-admin's brief when it ships.

## Consequences

- `RoleGrant` migration: add `scope String DEFAULT '*'`. Existing
  rows backfill to `'*'` (preserving today's flat behaviour).
- `server/lib/trpc.ts` `requireRole` accepts an options object with
  `scope`. Backwards-compat for non-Request procedures.
- Admin UI for granting roles (BU-admin) gains a scope picker
  alongside the existing role picker.
- Audit log entries on grant/revoke include the scope value.
- F06 rule 4 (`no-inline-auth-check`) continues to reject inline
  `ctx.user.role` checks — middleware does the work.

## Alternatives considered

- **Stay flat (one queue_manager role)**. Rejected — locks the
  product into "everyone sees everything" and creates a future
  migration when scopes inevitably arrive.
- **Per-type roles instead of (role, scope)**. Rejected — creating
  `vetter`, `flag_mod`, etc. as separate roles fragments the
  permission model. (Role, scope) keeps the role tier (member /
  queue_manager / admin) clean and adds scope as an orthogonal
  axis.
- **Hierarchical scopes** (e.g. `queue_manager:flag:*` matches
  `queue_manager:flag:child_safety`). Rejected — over-engineered
  for MVP. Sub-scopes are explicit strings; matching is exact
  except for `*` wildcard.

## Related

- D042 (coordinator vs queue-manager identity split — preserved)
- D054 (Request entity — companion)
- F06 rule 4 (`no-inline-auth-check`) — middleware-only enforcement

---

# D056 — Comment audience model (reviewer-internal vs all-participant)

**Date:** 2026-04-26
**Tier:** Foundation
**Status:** Accepted
**Build Unit:** BU-requests (forthcoming)

## Context

Per D054, the comment thread on a Request is the feedback loop
between submitter and reviewer team. But reviewers genuinely need
to discuss internally — vetting deliberation ("this voucher seems
weak"), flag triage ("dismiss vs remove?"), child-safety calls
("escalate to director"). If every comment is visible to the
submitter, reviewers self-censor and the discussion dies. If nothing
is visible, the submitter never gets feedback.

The scenarios already encode this implicit two-channel model:

- SCN-12 — Sharon's internal thinking ("Anna looks like a real
  person") is internal; her DM to Grant the voucher is external
- SCN-10 — Maya's internal call ("documenting adversary content,
  not amplifying") becomes a context note added to the dismissal
- SCN-14 — Jeremy reviews a vetter's "discussion thread" — implies
  there's a thread distinct from anything the applicant sees

D056 makes this explicit and uniform.

## Decision

A single Comment thread per Request, with a per-comment audience
flag.

### Schema

```prisma
model Comment {
  // existing fields preserved (D050, D052)
  audience CommentAudience @default(reviewers)  // NEW
}

enum CommentAudience {
  all         // visible to submitter + reviewers
  reviewers   // visible to reviewers only (internal note)
}
```

The default is `reviewers` for comments authored by users with a
reviewer role on this Request type. For submitters, the default
(and only allowed value) is `all` — they cannot post to the
internal channel.

For comments on a regular `Post` (not a Request), `audience` is
always `all`. The flag matters only on Request-target comments.

### Behaviour

| Author                               | Default audience | Allowed audiences    |
| ------------------------------------ | ---------------- | -------------------- |
| Submitter (own Request)              | `all`            | `all` only           |
| Reviewer (any role with scope)       | `reviewers`      | `all` or `reviewers` |
| Admin                                | `reviewers`      | `all` or `reviewers` |
| System (auto-posted status messages) | `all`            | `all` only           |

The composer UI surfaces an explicit toggle / "Reply to submitter"
button. Default is internal; sending to submitter requires explicit
opt-in.

### Visibility filter

`Comment.findMany` for a Request applies:

```sql
WHERE requestId = ? AND (
  audience = 'all'
  OR caller_can_see_reviewers_audience  -- has any reviewer role on this Request type
)
```

Submitters see only their slice. Reviewers see the full chronology
(both audiences interleaved by createdAt) with internal notes
visually marked ("internal · only reviewers see this").

### System messages

Status transitions (`new → in_discussion`, `in_discussion → done`,
urgency change) auto-post a system Comment with `audience: all`,
`authorId = system user`, formatted as a small grey line:

- "Sharon picked up this request · 14:32"
- "Decision: approved · 16:08"
- "Marked urgent by Maya · 09:15"

These provide submitter-visible audit trail without requiring
manual reviewer effort.

## Consequences

- Comment migration: add `audience CommentAudience DEFAULT 'reviewers'`
  for new column. Existing comments backfill to `all` (they're on
  Posts, not Requests, so all are public).
- Comment query layer wraps with the audience filter — service
  function takes a `callerCanSeeInternal: bool` flag derived from
  caller's roles
- Composer UI on Request thread defaults to internal; explicit
  "Reply to submitter" toggle for `all`
- System-message authorship via a designated synthetic user
  (`system@gps-action`) seeded as a special account
- F06 rule 3 (`no-pii-in-logs`) continues to apply — no PII
  leakage via system messages either

## Alternatives considered

- **Two separate threads (internal + external)**. Rejected —
  reviewers lose chronological context jumping between threads.
  One thread with audience marking is the cleaner UX.
- **Hard channel separation via separate tables**. Rejected —
  same access-control logic ends up enforced anyway; one table
  keeps the model simple.
- **Submitter-can-mark-private**. Rejected — submitters posting
  to a channel only some reviewers can see invites confusion.
- **No internal channel; reviewers use DMs for internal**.
  Rejected — DMs are not threaded with the case context, so
  context loss compounds.

## Related

- D050 (Reaction polymorphic schema — Comment polymorphism predates
  this)
- D052 (Comment schema with `commentId` FK on Reaction — same
  forward-compat pattern this extends)
- D054 (Request entity — primary consumer)
- D057 (Notifications — sends to submitter on `audience: all`
  comments only)

---

# D057 — Notifications entity + in-app delivery

**Date:** 2026-04-26
**Tier:** Foundation
**Status:** Accepted
**Build Unit:** BU-notifications (forthcoming, may fold into BU-requests)

## Context

The Requests workspace (D054) needs a notification mechanism so
submitters know when their request has been picked up, reviewers
know when they've been @mentioned, and the team learns about
urgent requests in near real-time. Today the codebase has no
notification primitive — events fire silently via audit log.

Per the user's call (option B in the design discussion):
notifications are a **separate entity** surfaced **in the same tab**
as Requests, not collapsed into Request sub-types.

## Decision

A new `Notification` entity, delivered in-app, surfaced in the
Requests tab in a dedicated section.

### Schema

```prisma
model Notification {
  id           String           @id @default(uuid())
  recipientId  String
  recipient    User             @relation("notificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)

  type         NotificationType
  payload      Json             // type-specific; references the source entity

  // For tap-to-navigate
  targetType   NotificationTargetType  // 'request', 'post', 'comment'
  targetId     String

  readAt       DateTime?
  createdAt    DateTime         @default(now())

  @@index([recipientId, readAt])
  @@index([recipientId, createdAt(sort: Desc)])
}

enum NotificationType {
  new_request_in_scope        // throttled; one per scope per hour
  request_claimed             // submitter — your request was picked up
  submitter_message           // submitter — reviewer added an `audience: all` comment to your request
  mention                     // anyone — you were @mentioned in a comment
  request_done                // submitter — your request was resolved
  urgent_request_raised       // all reviewers; NOT throttled
  flag_outcome                // flagger — your flag was resolved
}

enum NotificationTargetType {
  request
  post
  comment
}
```

### Throttling

Some notification types fire frequently and must bundle:

| Type                    | Throttle                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new_request_in_scope`  | At most one per (recipient, scope) per hour. Subsequent triggers update the existing one's payload (count, latest_request_id) instead of creating new rows. |
| `submitter_message`     | Up to 3 unread for one Request before bundling: "Sharon and 2 others have replied"                                                                          |
| `mention`               | Never throttled — explicit @ should always notify                                                                                                           |
| `urgent_request_raised` | Never throttled — explicit point of the type                                                                                                                |
| Others                  | Never throttled                                                                                                                                             |

Throttling logic lives in `server/services/notification.ts` —
`createNotification` checks for an existing unread notification
matching the throttle key before creating a new row.

### Delivery — in-app only at MVP

- Notifications appear in the Requests tab's "Notifications"
  section (above or interleaved with Requests, with type chip)
- The bottom-tab navbar shows an unread count badge
- `readAt` set when user taps the notification (navigates to its
  target) — single-touch acknowledgement, no separate "mark as
  read" step
- "Mark all as read" affordance per design-philosophy principle 3
  (give people permission to close the app)

Future delivery channels (parking-lot):

- Email digest (daily / weekly)
- Web push (PWA)
- Native push (Phase 2 native apps)

These all consume the same `Notification` rows; delivery is a
fan-out from the canonical store.

### Quiet hours

Per design-philosophy principle 3, notifications respect quiet
hours (default 22:00–07:00 local). In-app delivery isn't affected
(no audible/visible alert outside the app), but future push
channels will honour the user's quiet-hours preference.

### Permission

`Notification.recipientId` is the only access vector — users can
only list/read their own. tRPC procedure: `notification.listMine`,
`notification.markRead({ id })`, `notification.markAllRead()`.

## Consequences

- New `Notification` table + enums — migration adds them
- `User` model gains relation back-ref `notifications`
- `server/services/notification.ts` — `createNotification`
  helper (throttle-aware), `listMine`, `markRead`, `markAllRead`
- `server/routers/notification.ts` — tRPC surface
- Hooks into Request status transitions (D054), Comment
  posting with `audience: all` (D056), Comment @mentions
- Hook into Urgent flag (D058) — fires `urgent_request_raised`
- F06 rule 3 (`no-pii-in-logs`) — Notification payloads stored
  in `payload` JSONB are NOT logged; only IDs are
- Audit log unchanged — Notifications are user-visible delivery,
  not an audit primitive

## Alternatives considered

- **Collapse into Request sub-type** (Option A in design
  discussion). Rejected — stretches Request semantically; mention
  notifications aren't really "things needing decision."
- **Single global event stream that clients filter**. Rejected —
  privacy risk + bandwidth waste. Per-user rows are simpler.
- **Push-only (no in-app surface)**. Rejected — in-app is the
  canonical store; push is a delivery channel layered on top.
- **Send to email immediately**. Rejected for MVP — needs
  email infrastructure (BU-email or similar future BU). In-app
  first; email digest later.

## Related

- D054 (Request entity — primary trigger source)
- D056 (Comment audience — `audience: all` triggers
  `submitter_message`)
- D058 (Urgent flag — triggers `urgent_request_raised`)
- D036 (feature flags — notifications behind `ff_notifications`)
- design-philosophy.md principle 3 (no anxiety amplification)

---

# D058 — Urgent flag, AlertCategory, admin-configurable TTL, polling

**Date:** 2026-04-26
**Tier:** Foundation
**Status:** Accepted
**Build Unit:** BU-requests (forthcoming)

## Context

Some Requests are time-sensitive — "child safety incident at school
gate", "gathering happening now, who can help?", "post needs urgent
review before 5pm". Without a priority signal these mix in with
routine vetting work and lose their urgency. Without delivery, even
flagged urgent items wait until reviewers happen to refresh.

D058 introduces:

1. A `urgency` field on Request (binary — normal / urgent)
2. Admin-configurable TTL (default 4 hours) via a new `SystemSetting`
   table
3. An `AlertCategory` admin-managed table for member-facing alert
   sub-types (seeded with "Happening now")
4. A new RequestType `alert` — auto-urgent, surfaced in the FAB
   composer's "alert tile" (red triangle exclamation icon)
5. 10-second polling for MVP delivery; SSE deferred to Phase 2
6. Visibility broadening: urgent Requests appear in every reviewer's
   tab regardless of scope (acting still scope-restricted)

## Decisions

### 1. Two-tier urgency, not three

`Request.urgency` is `normal | urgent`. Resist the temptation of
`low | medium | high` — three tiers is a deference-to-feeling
problem, not a real distinction. Urgent means "interrupt now";
normal means "work the queue."

### 2. Schema additions

```prisma
model Request {
  // existing fields per D054
  urgency             RequestUrgency  @default(normal)
  urgentReason        String?
  urgentExpiresAt     DateTime?
  urgentSetByUserId   String?
  urgentSetAt         DateTime?

  alertCategoryId     String?
}

enum RequestUrgency {
  normal
  urgent
}

model AlertCategory {
  id              String   @id @default(uuid())
  slug            String   @unique  // "happening_now"
  label           String              // "Happening now"
  description     String?
  iconKey         String              // matches a known icon set
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())
  createdByUserId String

  @@index([active])
}

model SystemSetting {
  id              String      @id @default(uuid())
  key             String      @unique
  value           String                 // string-encoded; service parses by type
  type            SettingType
  description     String
  updatedAt       DateTime    @updatedAt
  updatedByUserId String
}

enum SettingType {
  int
  string
  json
}
```

### 3. Who can set urgency

| Setter        | When                                                                                     | Reason required             |
| ------------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| **Submitter** | At creation, self-declared. Tight friction (typed reason required).                      | Yes                         |
| **System**    | Auto-flag for `incident` and `flag:child_safety` types and for any `alert`-type Request. | No (system reason recorded) |
| **Reviewer**  | Can upgrade `normal → urgent` after creation, or downgrade.                              | Yes — typed reason audited  |

### 4. TTL — admin-configurable default

`SystemSetting` row seeded:

```
key:         request_urgent_default_ttl_hours
value:       4
type:        int
description: Default urgency time-to-live for Requests (hours). Auto-downgrade after expiry unless re-flagged.
```

Admin UI (BU-admin) lets admins edit this value. On urgency
escalation, `urgentExpiresAt = now() + ttl`. A scheduled job (or
on-render check) auto-downgrades expired urgents — sets `urgency =
normal`, leaves `urgentReason` for audit history, audit-logs the
auto-downgrade.

### 5. AlertCategory — admin-managed; seeded with one

Admins create alert categories via BU-admin's generic entity scaffold
(per admin-surface.md `/admin/[entity]` pattern). Seeded with one
row at install:

```
slug:        happening_now
label:       Happening now
description: Something is happening right now and we need eyes / help
iconKey:     warning_triangle
active:      true
```

Future admins can add (e.g. "Witness call", "Venue logistics",
"Press inquiry") without code changes. `iconKey` references a known
icon set; if a slug doesn't have an icon, falls back to a generic
warning icon.

### 6. The FAB alert tile (D044 integration spec)

Per D044 (FAB intent-cards composer), tapping the FAB shows a tile
picker. One tile is the **alert tile**:

- **Visual**: red warning triangle with exclamation mark
  (`iconKey: warning_triangle`)
- **Label**: "Alert"
- **Tap behaviour**: opens the alert composer
  - If only one active AlertCategory, it's preselected
  - If multiple, member picks via segmented control
  - Member types reason / context (free text, max 1000 chars)
  - Submit creates Request with `type=alert`, `urgency=urgent`,
    `urgentReason=<typed text>`, `alertCategoryId=<picked>`,
    `urgentExpiresAt=now() + ttl`

This integration lives in BU-composer-fab when it ships. D058
documents the contract; the alert composer is built then.

### 7. Visibility broadening

While `urgency=urgent AND status != done`, the Request appears in
every reviewer's Requests tab in a pinned "Urgent" section above
the New / In Discussion / Done filters. **Visibility broadens;
acting stays scope-restricted.**

Service-layer behaviour (`requests.list` with reviewer caller):

```
WHERE
  -- normal scope-filtered list
  (scope_matches(request.type, caller_scopes))
  -- OR urgent broadcast (any reviewer sees urgent regardless of scope)
  OR (request.urgency = 'urgent' AND request.status != 'done')
```

Mutation procedures (claim, comment-as-reviewer, resolve) still
require the right scope via `requireRole({ scope: request.type })`
per D055.

### 8. Real-time delivery — 10s polling for MVP

Client-side `useEffect` in the Requests tab polls
`requests.urgent.list` every 10 seconds while the tab is mounted.
Lag ≤10s for "Maya raised urgent at the school gate."

Trade-offs:

- Battery: 6 requests/min while tab open. Acceptable for MVP.
- Server: tRPC endpoint that returns urgent IDs only (cheap).
- Cache: HTTP `Cache-Control: no-store` on the urgent endpoint.

**SSE (Server-Sent Events) is parking-lot for Phase 2** when
concrete UX wins justify the infra. WebSockets are explicitly
not pursued (one-way push doesn't need bidirectional).

### 9. Anxiety-amplification guardrails (per design-philosophy.md §3)

- TTL forces re-evaluation; no permanent urgency
- Required reason on every escalation
- Auto-urgent only on a small set of types (incident, child-safety
  flag, alert)
- Bottom-tab badge counts unread _notifications_, NOT urgency count
  (avoids "3 urgent!" anxiety on the icon)
- Quiet hours respected for any future push delivery
- Reviewer downgrade button audited

### 10. Notification interaction

D057 fires `urgent_request_raised` to all reviewers when a Request
becomes urgent. Not throttled. Re-flagging the same Request after
downgrade fires again. The notification deep-links to the Request.

## Consequences

- Schema migration: add urgency fields to Request, create
  `AlertCategory` and `SystemSetting` tables, add the `alert`
  RequestType.
- Seed migration: insert "Happening now" AlertCategory + 4-hour
  TTL SystemSetting row.
- New tRPC procedures: `requests.urgent.list`,
  `requests.markUrgent`, `requests.downgradeUrgent`,
  `alertCategory.list/create/update`,
  `systemSetting.get/update` (admin-scoped).
- New scheduled job: auto-downgrade expired urgents (Vercel cron
  or similar).
- `requests.list` query gains the urgent-broadcast OR clause.
- BU-composer-fab brief incorporates the alert tile spec.
- `bu-sequence.md` updated to add `BU-notifications` and
  acknowledge `BU-requests` consumes D058.

## Alternatives considered

- **Three-tier urgency** (low / medium / high). Rejected —
  practical distinction is binary.
- **Urgency as a Request type** (`urgent` type). Rejected —
  urgency is orthogonal to type; vetting can be urgent, flag can
  be urgent, alerts are urgent-by-default.
- **Hardcoded TTL**. Rejected — admins need to tune this without
  code releases.
- **AlertCategory as code constants**. Rejected — admins should
  add categories without engineering work.
- **WebSocket / SSE in MVP**. Rejected — polling delivers
  acceptable lag with zero new infra.
- **Push notifications in MVP**. Rejected — needs PWA service
  worker + auth setup; defer to BU-pwa or similar.
- **Bottom-tab badge for urgent count**. Rejected — anxiety
  amplification per design-philosophy.

## Related

- D044 (FAB intent-cards composer — alert tile lands here)
- D054 (Request entity — primary surface)
- D055 (per-type scopes — gates ACTING on urgent, not seeing)
- D056 (Comment audience — internal-vs-all comments on urgent
  Requests work the same as on normal)
- D057 (Notifications — `urgent_request_raised` type)
- design-philosophy.md §3 (no anxiety amplification —
  governing principle for the guardrails)
