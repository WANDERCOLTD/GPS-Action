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

# D059 — Prisma 7 upgrade (deferred behind ADR; draft)

**Date:** 2026-04-26
**Tier:** Foundation
**Status:** Proposed / Open · April 2026
**Build Unit:** BU-prisma-7 (forthcoming, not yet briefed)

## Context

Dependabot opened PR #40 to bump `@prisma/client` from 5.22.0 to
7.8.0. CI failed at the `npm run db:generate` step — but the failure
was a **packaging mismatch**, not a real upgrade signal: Dependabot
bumped only `@prisma/client`, leaving the `prisma` CLI pinned at
`^5.22.0`. The Prisma 7 client expects a `prisma-schema-wasm` peer
that ships only in matching `prisma@7.x`, so the generator hits an
ENOENT immediately. Pairing the two would unmask the _real_ work.

CLAUDE.md is explicit:

> Don't change `prisma/schema.prisma` without an ADR (it's
> contract-locked).

Prisma 7 is a major bump that almost certainly requires schema-level
changes (`previewFeatures` defaults, `binaryTargets` config, possibly
implicit relation cascading). Some of those bleed into the TypeScript
surface area used by `server/services/*.ts`, `server/db/client.ts`,
and tests — the strict-typed services would silently drift if we
upgraded the runtime without auditing the codegen surface.

The right move is to gate the upgrade behind this ADR rather than let
Dependabot's auto-PR force the question on the wrong terms.

PR #40 is closed in favour of this ADR. The auto-PR will be re-opened
or replaced by a manually-authored upgrade PR once decisions below are
made.

## Decisions

### 1. The packaging mismatch is a non-issue once we control the upgrade

Any manually-authored upgrade PR bumps `prisma` and `@prisma/client`
together (and `prisma migrate dev` regenerates the engine binaries
matched to the client). Dependabot's split-PR behaviour is a known
limitation. We will not chase Dependabot's individual `@prisma/client`
auto-PRs — closed when raised, with a comment pointing here.

### 2. The schema-locked contract still holds

`prisma/schema.prisma` cannot be edited without a **further** ADR
that documents the specific schema directive/migration changes Prisma
7 introduces. This ADR (D059) authorises the _upgrade work_, not the
specific schema edits. The schema-edit ADR (D060 if/when written)
must enumerate:

- Every changed `previewFeatures` flag and what behaviour it now
  emits at runtime
- Every changed `binaryTargets` entry and the supported deploy
  surfaces
- Any implicit-relation default that migrated (e.g. cascading
  `onDelete` defaults)
- Any `@db.<type>` mapping that no longer round-trips identically

### 3. Prisma 7's TS surface area must be audited before merge

Prisma 7 changes some return types (`findUnique`/`findFirst` null
handling, JSON field type widenings, possibly relation include
inference). The audit must run a `tsc --noEmit` against the new
client and surface any service that needs a type cast or refactor.
No `any` / `@ts-ignore` workarounds — fix the call site or roll back.

### 4. Migration must run against a copy of production data before merge

Prisma 7 may emit different SQL for edge cases (Postgres array
handling, JSON path queries, decimal precision). A migration test on
a snapshotted copy of the production database — not just the seed
fixture — is a hard prerequisite. This is the first project precedent
for a "real-data dry run" before merging a major dep bump; document
the procedure as part of the BU brief.

### 5. Sequence

1. **D059 (this ADR) accepted** — authorises upgrade work
2. **BU-prisma-7 brief written** — scoping the audit + migration test
3. **D060 schema-edit ADR drafted** — enumerating exact schema changes
4. **Audit branch** — pair `prisma` + `@prisma/client` to 7.x, run
   typecheck, surface every service-layer break
5. **Production-snapshot migration dry-run** — record results in BU
6. **PR opens** — schema diff + service patches + brief link in
   description; merge requires reviewer sign-off on the schema
   directive changes specifically

This is at least a multi-session piece of work, not a "knock it out"
afternoon.

## Consequences

### Wins

- Stops Dependabot from re-raising auto-PRs that can't merge: each
  one gets closed with a one-line comment pointing at D059.
- The contract-locked schema policy remains intact — no upgrade
  shortcut exists.
- Forces the type-surface audit and data-migration dry-run _before_
  any mainline change, not as a post-merge fire drill.

### Costs

- Multi-session investment instead of a one-shot Dependabot merge.
- Locks us into Prisma 5 for the immediate term (acceptable —
  Prisma 5 is still in active support; no security CVEs as of this
  ADR).
- The `prisma`/`@prisma/client` version pin stays at 5.x in
  `package.json` until the upgrade brief lands; Dependabot will
  keep raising auto-PRs against this pin.

### Open questions (deferred to BU-prisma-7 brief)

- Do we want to wait for Prisma 7's first patch release (7.x.1+)
  before upgrading, to let early-adopter bug reports surface?
- Does the migration dry-run procedure become a permanent
  requirement for any future schema-affecting dep bump, or a
  one-shot for this upgrade?
- Are there `previewFeatures` we currently rely on that became
  GA in Prisma 6/7 — i.e. the `previewFeatures` array shrinks in
  the upgrade?

## Alternatives considered

- **Merge Dependabot's auto-PRs as-is** (paired manually). Rejected —
  ignores the contract-lock, no audit, no data dry-run.
- **No ADR; just upgrade in a feature branch later**. Rejected —
  CLAUDE.md is explicit; ADR-gated work is the discipline.
- **Stay on Prisma 5 indefinitely**. Rejected as a final state but
  acceptable as a holding pattern; revisit if Prisma 5 hits EOL or
  a security CVE.
- **Pin `@prisma/client` to 5.x exactly** to suppress Dependabot
  noise. Rejected — minor/patch updates inside 5.x are still
  desirable; the noise from major-bump auto-PRs is acceptable
  cost for keeping minor security patches automated.

## Related

- CLAUDE.md ("contract-locked schema" rule)
- D059 directly authorises future BU-prisma-7
- D062 (forthcoming, reserved) — specific schema edits Prisma 7
  requires (number bumped from D060 because D060/D061 were drafted
  first for the link-share work)
- `docs/build/session-handoffs/dependabot-major-bumps-diagnosis.md`
  — original diagnosis of PR #40
- Closed PR #40 (Dependabot auto-PR superseded by this ADR)

# D060 — Post schema additions for link-share preview cards

**Date:** 2026-04-26
**Tier:** Foundation
**Status:** Accepted
**Build Unit:** BU-link-share

## Context

SCN-19 (Sharon shares a Guardian article with a preview card) and the
inbound-sharing.md product spec require GPS Action to render link
preview cards for shared URLs — title, description, hero image, site
name, and the URL itself. Today, `Post` has only `activistMailerUrl`
as a URL field, treated as a CTA button rather than a preview card.

The user's confirmed direction (this session): both `activistMailerUrl`
and a new `linkUrl` should render through the same preview-card
primitive ("title, picture, words, action") with no separate button
treatment for AM URLs. That means we need the same five preview-card
data fields available regardless of which URL the user supplied.

CLAUDE.md is explicit: `prisma/schema.prisma` is contract-locked and
edits require an ADR.

## Decisions

### 1. Five new optional fields on `Post`

```prisma
model Post {
  // ... existing fields ...

  // Link preview card data (BU-link-share — D060)
  linkUrl         String?
  linkTitle       String?
  linkDescription String?
  linkImageUrl    String?
  linkSiteName    String?

  // ... existing fields ...
}
```

All five are `String?` (nullable). No backfill needed. Existing posts
remain unaffected.

### 2. Validation rules at the boundary (zod, not Prisma)

- `linkUrl`: must be a valid URL if present. `https?://` only — no
  `javascript:`, no `data:`, no `mailto:`. Validated at the tRPC input
  schema (`shared/validation/post.ts`).
- `linkTitle`: max 200 chars. Truncate silently in the composer if
  over, with a tooltip ("trimmed for display").
- `linkDescription`: max 500 chars. Same truncation rule.
- `linkImageUrl`: must be a valid URL if present. `https?://` only.
- `linkSiteName`: max 100 chars.

Schema-level constraints stay loose; product rules live at the API
boundary so they can evolve without migrations.

### 3. AM URL render policy

Both `activistMailerUrl` and `linkUrl` render through the same
`<LinkPreviewCard>` primitive — no separate CTA-button treatment for
AM URLs. The component takes a `size` prop (`'small' | 'large'`) so
the same component drives the small (in-feed, collapsed-card) and
large (expanded card + post detail) presentations.

When a post has both an AM URL and a `linkUrl`, both render — AM URL
first (as it's the primary action), `linkUrl` second (as supporting
context). MVP shows both stacked.

**AM brand mark.** When `<LinkPreviewCard>` renders an AM URL, it
displays an AM brand mark (small badge / logo / icon — exact form a
design call inside BU-link-share) so members visually recognise the
card as an Activist Mailer action distinct from a generic news-link
share. Without this affordance, the AM card and the link card look
identical and members lose the "this is the action" signal.

### 3a. Future direction — primary CTA + multiple secondary CTAs

MVP locks in two URL slots (`activistMailerUrl` + `linkUrl`). The
future model — confirmed in this session — is: every post has one
primary CTA (currently the AM URL) plus optional secondary CTAs
visible inside the post detail. Schema evolution would replace the
two-slot pattern with a typed `Action[]` array (each action carries
its own URL, label, role, and ordering).

Out of scope for D060 — captured as a parking-lot row so it surfaces
when the second-CTA need is real (e.g., share + petition + donate as
three CTAs on one post). Until then, the two-slot pattern is enough.

### 4. Migration is single-step additive

Five new nullable columns. No backfill. No data movement. No
two-phase staging needed (per F08 / B05 — additive nullable columns
are inherently safe). Lands in one Prisma migration:

```sql
ALTER TABLE "Post"
  ADD COLUMN "linkUrl" TEXT,
  ADD COLUMN "linkTitle" TEXT,
  ADD COLUMN "linkDescription" TEXT,
  ADD COLUMN "linkImageUrl" TEXT,
  ADD COLUMN "linkSiteName" TEXT;
```

### 5. Index policy — none added

Link fields are not query targets in MVP. No `WHERE linkUrl = ...`
queries; no full-text search across `linkTitle`. If the dedup
feature (BU-dedup) eventually queries by URL hash, that adds an
index in its own migration with its own ADR — out of scope for D060.

## Consequences

### Wins

- SCN-19 unblocked: schema supports the manual-fill composer flow
- AM URL + link URL share one rendering primitive — no UI duplication
- Additive migration is safe to ship without staging
- All five fields visible to the OG-scraper (Phase C of BU-link-share)
  for live auto-fill

### Costs

- Five new fields on `Post` widen the surface; every list endpoint
  that returns posts must decide whether to project them. Default:
  always project (they're small, always serialisable, the feed needs
  them on the small card).
- Existing tests with hand-built `Post` fixtures need to add the
  nullable fields (TS will warn, not fail — they're optional).
- Adds ~50 bytes of nullable column overhead per row. Negligible.

### Open questions deferred to BU-link-share brief

- Composer "Share a link?" toggle vs always-shown — affects
  composer-form layout
- OG scrape implementation lives in the brief, not here
- Image moderation (link images come from external URLs — could be
  anything) — out of scope; addressed by image-handling.md Phase 2

## Alternatives considered

- **Separate `LinkPreview` table joined to `Post` 1:1**. Rejected —
  always-1:1 join across two tables for every feed render is wasted
  IO; a single nullable field group on `Post` matches the access
  pattern.
- **JSONB blob `linkPreview JSONB?`**. Rejected — destroys typed
  access, makes validation harder, no individual-field indexing
  ever, no nice migration path when fields evolve.
- **Reuse `activistMailerUrl` for any URL**. Rejected — AM URL has
  semantic meaning ("call-to-action that the post is recruiting for")
  distinct from `linkUrl` ("article being shared"). One post can
  have both.
- **Add `linkPreviewVersion INT` for cache invalidation**. Rejected
  — premature; the OG scraper caches in-memory in MVP. If we move
  to a persistent cache later, invalidation becomes a separate ADR.

## Related

- D045 (Post visibility model — link-share posts inherit visibility rules unchanged)
- D050 (Reaction polymorphic schema — link-share posts react like any other post)
- D052 (Comment polymorphic schema — link-share posts comment like any other)
- D061 (Global tap interaction pattern — defines how the preview card responds to tap)
- SCN-19 (Sharon shares a Guardian article — primary scenario this serves)
- `docs/product/image-handling.md` (D046 — phased image strategy; link images are MVP day-1)
- `docs/product/inbound-sharing.md` (D018 — clipboard detection + share endpoint, Phase B/C of BU)

# D061 — Global tap interaction pattern

**Date:** 2026-04-26
**Tier:** Foundation
**Status:** Accepted
**Build Unit:** Cross-cutting — applies to every UI BU

## Context

GPS Action surfaces are increasingly card-shaped: post cards, comment
threads, request rows (D054), notification entries (D057), alert
tiles (D058). Each of these has multiple interactive zones — body
content, buttons, links, reactions, chevrons, comment counts.

Without an explicit pattern, every BU re-litigates "what does tap
here do?" That produces inconsistency: in one BU a body tap navigates,
in another it expands, in a third it does nothing. Members can't
predict outcomes. Discoverability rots.

The user's question this session — "We have cards, 1-click areas,
reactions, expand to detail, nav to details page... need to find our
perfect pattern" — surfaced the gap and asked for a global rule.

This ADR establishes the rule. Every UI BU after this one inherits
it; existing BUs (BU-feed, BU-composer, BU-comments) get retrofitted
opportunistically as they're touched.

## Decisions

### 1. Three element classes, three behaviours

| Element class                                                                  | Tap behaviour                                                           |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Container / content body**                                                   | Go _deeper_ (collapsed → expanded → detail). Never performs an action.  |
| **Explicit interactive element** (button, link, icon, chip, link-preview card) | Performs that element's specific action. Never navigates the container. |
| **Reaction / quick-action UI**                                                 | Performs the quick action. Never expands or navigates.                  |

"Deeper" is a defined progression: every container has at most two
"deeper" steps. Cards: collapsed → expanded → detail page. Lists:
list → focused row. Comments: row → reply composer.

### 2. Discoverability rule

Every tappable element carries a visible affordance:

- Buttons have button shape (filled or bordered, not bare text)
- Links have link colour (`var(--colour-text-link)`)
- Icons that act have icon styling distinct from decorative icons
- Chevrons indicate expand/collapse state
- "Open thread →" or similar link makes navigation discoverable

If it looks like text and isn't styled as a link, it's not tappable.

### 3. Long-press is browser-default

GPS Action does NOT override long-press in MVP / PWA. Browser
defaults handle text selection, link preview, image save-as. Reasons:

- iOS Safari has its own long-press behaviour that fights any custom
  override; experience is inconsistent
- Members reasonably expect to copy text or save an image from a
  card; overriding long-press breaks that
- Any contextual-menu need is better served by an explicit `⋯` icon
  per the discoverability rule

Long-press in native Phase 2 apps is a separate decision, deferred
to that phase's ADR (will reference D061 as the predecessor).

### 4. State persistence on expand

Card expand/collapse is **session-only**. Reload re-collapses. Not
URL-encoded. Reasons:

- URL-encoded expand state pollutes share links ("here's the post
  but also it'll be expanded for you")
- Most reload paths (browser back, hot-reload, PWA refresh) reset
  the visual state — keeping it flat avoids surprises
- The cost of re-expanding after reload is a single tap

### 5. Card three-state model

Cards specifically follow this model:

| State               | Body tap        | Action tap | Reaction tap | Chevron tap  | Comment-count tap         |
| ------------------- | --------------- | ---------- | ------------ | ------------ | ------------------------- |
| Collapsed (in feed) | Expand          | Open URL   | Add/remove   | Expand       | Detail page               |
| Expanded (in feed)  | Detail page     | Open URL   | Add/remove   | Collapse     | Detail page               |
| Detail page         | (no body click) | Open URL   | Add/remove   | (no chevron) | (focus jumps to comments) |

An "Open thread →" affordance appears at the bottom of the expanded
state to make detail-nav discoverable, even though body-tap also
navigates.

### 6. Affordance for "deeper"

Body-tap in collapsed/expanded cards must be discoverable. The
chevron is the primary affordance. In addition, a textual link
("tap to expand" / "Open thread →") gives screen-reader users and
first-time members the discovery path.

## Consequences

### Wins

- One contract for every BU; reviewer doesn't relitigate "what does
  this tap do" per PR
- Consistent member mental model: action targets do, body taps go
  deeper, reactions react
- Aligns with how X / Bluesky / Slack / LinkedIn / Apple Mail behave
  — members already know this pattern from elsewhere
- Long-press neutrality means we inherit browser/OS quality-of-life
  features for free

### Costs

- Existing BUs need retrofitting where they violate the contract
  (BU-feed and BU-comments are mostly compliant; minor tightening)
- Every new component PR has one extra reviewer-checklist item:
  "follows D061 tap contract"
- Designers can't make body-tap do an action even when it would be
  faster — discipline cost

### Open questions

- Does this contract extend to the FAB (D044 intent-cards)? FAB tap
  opens the composer, FAB long-press would be a global override
  exception. **Provisional answer: no exception; FAB obeys D061.**
  Re-open if a real need surfaces.
- Does this apply to admin surfaces (D054 Requests)? Yes — same
  contract. Admin views are still card-shaped.

## Alternatives considered

- **Body-tap = action (e.g., body-tap on AM-URL-bearing post = open AM URL)**.
  Rejected — overloads body tap, fights the discoverability rule, and
  produces invisible-actions-on-content (the worst kind of UX surprise).
- **Custom long-press menus everywhere**. Rejected — see §3.
- **Body-tap = nothing** (only buttons navigate). Rejected — modern
  cards have body-tap = navigate baked in across every comparable
  product; rejecting it would feel underbuilt.
- **Per-BU tap rules**. Rejected — that's exactly what this ADR
  prevents.

## Related

- D044 (FAB intent-cards composer — FAB is the only would-be exception; provisionally folded into D061)
- D054 (Requests — admin surface; D061 applies)
- D060 (Link-share preview cards — first BU to fully exercise D061)
- design-philosophy.md principle 1 (one-click is king)
- design-philosophy.md principle 5 (honesty — action targets do what they say)
- F14 (require-testid — every new tap target also gets a testid)

# D062 — PostKind table + alert orthogonality

**Date:** 2026-04-26 (revised in-place)
**Tier:** Foundation
**Status:** Accepted
**Build Unit:** BU-fab-intent-picker

> **Revision history:** Initial draft proposed `Post.kind` as a free-form
> string with `alert` as one peer label. Revised in place (still on the
> same draft branch) to (a) promote kind to a managed `PostKind` table
> and (b) split alert-ness into an orthogonal `Post.urgency` flag. The
> string-only model collapsed two concerns into one axis and blocked
> "urgent cultural" / "urgent outcome" combinations; this revision
> matches D058's already-orthogonal model on Request.

## Context

BU-fab-intent-picker introduces a single FAB → tile picker that dispatches to type-specific composer flows. Each intent (cultural moment, call to action, event, meeting, outcome, etc.) needs to leave a mark on the resulting Post so the feed can render type-specific affordances (chips, styling, future filtering).

Two design pressures shape the schema:

1. **D048 deferred a `PostType` enum** — premature taxonomy commitment was identified as a risk. A code-locked enum is the wrong shape.
2. **Alert-ness is orthogonal to kind.** D058 already treats alert-ness as a separate axis on Request (urgency boolean + alertCategoryId). Posts should match — a "happening now" alert and a "cultural moment" can both be urgent.

A free-form `kind` string with `alert` as one peer label conflates these axes. This ADR resolves both.

## Decision

### 1. PostKind as a managed table

```prisma
model PostKind {
  id               String   @id @default(uuid())
  slug             String   @unique
  displayName      String
  icon             String?
  sortOrder        Int      @default(0)
  isAlertEligible  Boolean  @default(false)
  createdAt        DateTime @default(now())
  deletedAt        DateTime?

  posts    Post[]
  requests Request[]
}
```

Code defines the **set of slugs** (the FAB picker tiles know which to offer); admin manages **policy per row** (`isAlertEligible`, `displayName`, `sortOrder`, soft-delete). This is between an enum (locked) and a free-form string (no shared schema). Slugs are the join key between code labels and DB rows.

Seeded with eight rows, two flagged alert-eligible:

| slug           | displayName     | isAlertEligible |
| -------------- | --------------- | --------------- |
| happening_now  | Happening now   | ✅              |
| meeting        | Meeting         | ✅              |
| cultural       | Cultural moment | —               |
| call_to_action | Call to action  | —               |
| outcome        | Outcome         | —               |
| thought        | Just a thought  | —               |
| link_share     | Share a link    | —               |
| event          | Event           | —               |

Admins can flip `isAlertEligible` per row without code changes.

### 2. Post.kindId FK + Post.urgency Boolean (orthogonal)

```prisma
model Post {
  // ... existing fields ...
  kindId   String?
  kind     PostKind? @relation(fields: [kindId], references: [id], onDelete: SetNull)
  urgency  Boolean   @default(false)
}
```

`kind` (via FK) and `urgency` are independent. Composer enforces the
gate: `urgency` can only be true when the selected `PostKind.isAlertEligible`
is true. Validated at both the form and the API.

### 3. AlertCategory dropped — merges into PostKind

D058's `AlertCategory` table (single row, "Happening now") merges into PostKind. The "Happening now" PostKind row IS what was the AlertCategory row. Existing `Request.alertCategoryId` migrates to `Request.kindId` pointing at the same PostKind FK.

Single source of truth: PostKind owns categorisation for both Posts and Requests. The same row that drives the FAB tile drives the alert category on a published post.

### 4. The composer's two buttons (consequence — not the decision itself)

This refactor pairs with **D063 (Send-for-Review)**. The composer offers `Post` and `Send for Review` buttons; the alert toggle is independent of which button is pressed. So a member can:

- Post a `cultural` `urgency: false` post → publishes to feed
- Post a `happening_now` `urgency: true` post → publishes to feed with alert flag
- Send for review a `cultural` `urgency: false` post → reviewer queue
- Send for review a `happening_now` `urgency: true` post → reviewer queue (high-stakes alert that benefits from oversight)

All four combinations are valid. The Schema doesn't enforce alert-eligibility (per D048 stance — schema stays flexible); the composer + API do.

## Consequences

### Wins

- Alert-ness is genuinely orthogonal — every kind can be alert-eligible (admin policy)
- Single source of truth — PostKind drives both kind labels AND alert categories
- Admin can edit policy (`isAlertEligible`, `displayName`, `sortOrder`) without code deploys
- Honours D048 (no enum lock) AND avoids D058's slight redundancy (separate AlertCategory + status fields)

### Costs

- Slightly more schema surface (one new table, one new boolean, one renamed FK)
- Composer logic to gate the alert toggle by `isAlertEligible` adds a small client-server call (read PostKind list)
- AlertCategory migration is non-trivial because BU-requests-urgent (#75, merged) seeded data using the old shape

### Open questions deferred

- Whether `Post.urgency` needs an `urgencyExpiresAt` like Request has (D058). MVP: no — feed alerts don't time-box; the alert flag stays on until edited.
- Whether multiple alert categories will exist (admin can add). MVP: just "Happening now" is seeded; admin can add via future BU-admin-crud or direct DB insert.

## Alternatives considered

- **String-only kind + boolean alert** (the original D062 draft, before revision). Rejected — admin couldn't manage policy; alert eligibility was hard-coded. The discussion that produced this revision is on the BU branch.
- **Keep AlertCategory separate from PostKind.** Rejected — two tables for the same conceptual thing (a labeled bucket of urgent stuff) is redundant; the merge is cleaner.
- **Add `urgentExpiresAt` on Post mirroring D058.** Rejected for MVP per the open question above; can land in a future ADR if the demand surfaces.

## Related

- D044 — FAB intent-cards composer (the BU consuming this schema)
- D048 — PostType deferred-taxonomy stance (this honours it: managed table, not enum)
- D058 — Urgent flag + AlertCategory on Request (the model this matches; AlertCategory deprecated by this ADR)
- D063 — Send-for-Review (the second button on the composer)
- BU-fab-intent-picker brief — implementation surface

# D063 — Send-for-Review pattern (Post button vs Review button)

**Date:** 2026-04-26
**Tier:** Foundation
**Status:** Accepted
**Build Unit:** BU-fab-intent-picker

## Context

Today the composer has one button (`Post`) that publishes to the feed immediately. There's no path to "I want to write a post but want a reviewer to vet it before it goes public."

Members benefit from the review path on:

- High-stakes alerts (a `happening_now` urgency=true post that goes wrong reflects on the network)
- New members building trust ("can someone check this is OK?")
- Sensitive content (cultural moments, vetting outcomes, anything that touches third parties)
- Members who simply prefer oversight

Reviewers benefit from a queue of drafts they can shape before publication.

## Decision

The composer ships **two buttons**:

| Button              | Action                                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Post**            | Existing path. Creates a published `Post` row. Visible on /feed immediately.                                                                                                           |
| **Send for Review** | New path. Creates a `Request` of `type: content_submission` containing the draft fields in `context: JSONB`. **No `Post` is created yet.** Routes to /requests for the reviewer queue. |

Both buttons are visible on every composer load, regardless of kind or urgency. Member chooses which path applies.

### Reviewer actions on a content_submission Request

A Request created via Send-for-Review carries the full draft in its `context` JSONB. The reviewer queue gains two new actions:

- **Publish** — service reads `context`, creates a `Post` row from those fields (with `kindId`, `urgency`, all link fields, etc.), then resolves the Request with `resolution: 'approved'`. Member sees a notification (D057) and the post appears on the feed.
- **Archive** — resolves the Request with `resolution: 'dismissed'`. No Post is created. Member sees a notification with reason. Optional: the reviewer leaves a comment explaining (audience: 'all').

### Why no draft-Post state on the Post table

An alternative is to create a `Post` row in `draft` status when Send-for-Review is hit, then flip it to published on approval. Rejected because:

1. Draft Posts pollute every "list posts" query unless we add a `published` filter to every call site
2. Posts are designed to be public-by-default; introducing a draft state changes the contract
3. The Request's `context: JSONB` is a perfectly good draft container — it already exists and is queryable

Storing the draft in `Request.context` is cheap, isolated, and reuses the polymorphic Request envelope.

## Consequences

### Wins

- Members get oversight on demand — no policy needed
- Reviewers get a useful queue of drafts to shape
- The Request entity stays the universal "things needing decision" surface (per D054)
- No new tables, no Post.draft state — single new code path on top of existing entities

### Costs

- Two buttons on the composer instead of one — small UX cost; clearly labelled
- Send-for-Review is a hidden gate by default; members might miss it if they don't notice the second button
- Reviewer queue gets noisier — content_submission joins vetting + flag + edit_request as a Request type. Mitigated by D055 scope filtering (reviewers can scope to specific types)

## Alternatives considered

- **One button + a "review me?" checkbox.** Rejected — easier to miss, less honest about the path divergence.
- **Auto-route certain kinds (e.g. all alerts) through review.** Rejected — paternalistic; remove member agency. Member decides.
- **Draft Posts in a separate `PostDraft` table.** Rejected — duplicates Post schema for a transient state.

## Related

- D054 — Request entity (the universal "things needing decision" surface)
- D055 — per-type role scopes (reviewer queues filter Request types)
- D062 — PostKind table + orthogonal urgency (the schema this consumes)
- D056 — Comment audience (reviewer's resolution comment uses `audience: 'all'`)
- D057 — Notifications (member sees publish/archive outcome)

# D064 — Post.heroImageUrl optional field; demo-stub picker on top of D046's phased plan

**Date:** 2026-04-26
**Tier:** Architecture
**Status:** Accepted
**Build Unit:** BU-post-hero-demo

## Context

Posts today are visually flat. The Post model carries `linkImageUrl`
(fetched from the linked URL's og:image, per BU-link-share / D060) but
no member-chosen hero image. The 2026-04-26 WhatsApp pattern review
made the gap concrete: real activist comms in our target community
lead with photos and videos (e.g. the "Asda called out" action video,
the Archway Our-Fight field-report photo, the Writers' Circle promo
graphic). Text-only "postcards" are materially weaker for the post
patterns we want to support.

D046 (Image handling phased) sets the day-1 plan as og:image-only —
no member-uploaded hero. The phased plan defers direct upload to a
proper Phase 2 BU-image scope (S3 + moderation + thumbnails + EXIF
strip + size limits). That's the right phasing for production but
leaves the demo visually flat in the meantime.

## Decision

Add an optional `heroImageUrl: String?` field to the `Post` model.
Compose-time UI is a `<HeroImagePicker>` that lets the member pick
from a fixed set of seeded demo images (8 royalty-free JPGs in
`public/seed-images/`). Server validation rejects any URL not in the
seeded set — for demo, the picker is the only legitimate path.

The `heroImageUrl` field is **additive and survives** the eventual
swap to real upload: when Phase 2 BU-image lands, only the picker UI
and the validator's allow-list change. The field shape, the storage,
the rendering on cards and detail pages, and the API contract all
stay.

This decision **does not revise D046** — the og:image-fetch path
described there remains the production day-1 plan. D064 sits on top
of it as a **demo enhancement** that becomes obsolete (its
`SEED_HERO_IMAGES` constant is removed) when real upload ships.

## Consequences

### Wins

- Demo posts can carry hero images today, materially closer to the
  WhatsApp post patterns we want to support.
- Field shape is forward-compatible — Phase 2 BU-image swap touches
  only the picker UI + validator, not the schema or rendering.
- Existing `linkImageUrl` flow (BU-link-share) is untouched. When
  both fields are present on a post, hero wins for the top-of-card
  slot; the link card keeps its own thumbnail.
- Single-purpose BU keeps the slice small and reviewable.

### Costs

- Two image fields on Post (`heroImageUrl` + `linkImageUrl`) —
  semantically distinct but visually adjacent. Documenting the
  precedence (hero > link) for future readers is required.
- The seeded image set lives in `public/seed-images/` and ships in
  the repo. Adds ~2-3 MB to repo size; goes away when Phase 2
  BU-image lands.
- Validator's allow-list constraint is a deliberate demo guard.
  Removing it before Phase 2 upload is in place would let any URL
  be stored — must not be removed casually.

### Open questions deferred

- Final image set selection — surfaced for sign-off in the brief's
  "Open questions" section, not pre-committed in this decision.
- Card aspect ratio (16:9 proposed) — surfaced in the brief.
- Hero-vs-link rendering precedence on the card — proposed in the
  brief; confirmed at build time.

## Alternatives considered

- **Wait for Phase 2 BU-image.** Rejected — the demo is now, the
  visual gap is now, and the phased plan would leave demo posts
  flat for weeks-to-months.
- **Repurpose `linkImageUrl` as a generic hero field.** Rejected —
  conflates two distinct data sources (og:image fetch vs member
  pick) with different lifecycles. og:image refreshes when `linkUrl`
  changes; a member-picked hero should not.
- **Free-form URL input (no allow-list) for demo.** Rejected — opens
  the door to arbitrary external URLs (broken links, hotlinking,
  takedowns) before any moderation infrastructure exists. The
  fixed-bucket constraint is intentional.
- **Real S3 upload as Phase 2 BU-image, no demo path.** This is the
  D046 status quo. Rejected for the demo timeline reason above.
  D064 is explicitly a stop-gap that BU-image will replace.

## Related

- D046 — Image handling phased (this decision sits on top, does not
  revise)
- D060 — Link preview card (BU-link-share, source of `linkImageUrl`)
- Parking-lot entry: "Direct image upload on Post — priority bump
  from image-handling phased plan" (the originating signal)
- Parking-lot entry: "Call out a problem — content post intent"
  (downstream consumer; hero is part of its composer field shape)

# D065 — Sticky app header + soft refresh button (BU-sticky-nav)

**Date:** 2026-04-27
**Tier:** UX / Layout
**Status:** Accepted
**Build Unit:** BU-sticky-nav

## Context

The `LoggedInAs` dev strip and the `AppNav` link strip currently render
as two separate horizontal strips: `LoggedInAs` lives in the root
layout, and `AppNav` is rendered per-page (8 pages each import it and
pass an `active` prop). Neither is sticky, so they scroll away with the
content.

Two pressures converged on 2026-04-27:

1. Members on long feeds lose access to the nav as they scroll. On
   mobile especially, having to scroll back up to reach Requests / Data
   / Settings is friction. Sticky-header is the conventional answer.
2. iPhone users who add the site to their home screen launch it in
   iOS Safari's standalone-ish mode — no URL bar, no native reload.
   Confirmed by Paul's own home-screen bookmark on 2026-04-27. The
   codebase has no PWA manifest and no `apple-mobile-web-app-capable`
   meta — this is iOS default behaviour, not opt-in. Without a
   browser-chrome reload, the user has no way to refresh.

"Stay as native as possible" is the stated preference for refresh
behaviour but doesn't apply on iOS standalone — there is no native to
fall back to. An in-app refresh affordance is required.

## Decision

Consolidate `LoggedInAs` and `AppNav` into a single sticky `<header>`
rendered once in `app/layout.tsx`. Page content scrolls underneath.
`AppNav` becomes a client component and derives the active link from
`usePathname()` rather than receiving an `active` prop per page.
Reviewer-access and unread-notification-count resolution lifts into the
layout (already adjacent to the existing `createTRPCContext()` call) so
those signals surface globally, not only on `/requests`.

A `<HeaderRefreshButton>` sits inside the header, right-justified after
the AppNav links. On tap it calls `router.refresh()` — Next.js' soft
refresh that re-runs server components for the current route, refreshes
their data, and preserves scroll position and client component state.
This is the entire answer to "how does the user refresh on iPhone
standalone." No custom pull-to-refresh, no PWA manifest work, no
`window.location.reload()`.

## Consequences

### Wins

- One sticky header instead of two scrolling strips. Nav remains
  reachable on long feeds.
- 9 pages each drop their `<AppNav active="..." />` boilerplate. The
  `active` prop is gone — `usePathname()` is the single source of truth
  for which link is highlighted.
- Reviewer-access label and unread-notification dot surface on every
  page (not just `/requests`), because they're resolved once in the
  layout. A reviewer scrolling the feed now sees their queue's unread
  count without having to navigate to `/requests` first.
- Refresh affordance solves the iOS standalone reload gap with one
  button — no pull-to-refresh gesture code, no PWA opt-in, no extra
  meta tags. `router.refresh()` is the soft-refresh primitive Next.js
  already exposes; we're just surfacing it.
- Forward-compatible with BU-user-menu, which lands the
  avatar / Sign out affordance into the same sticky header.

### Costs

- `AppNav` becomes a client component. It was previously a server
  component receiving an `active` prop; the switch trades one render
  boundary for the per-page boilerplate removal. Net win, but worth
  noting: the file gains `'use client'` and `usePathname()`.
- Layout now resolves nav data (reviewer scope, unread count) on
  every page render, not only on `/requests`. One additional service
  call per render. The count query is cheap (single indexed read) and
  the demo audience is small; if this becomes hot, cache it.
- Z-index discipline matters slightly more — the sticky header
  introduces a stacking context that must layer correctly against the
  fixed-position `<IntentFab>`. A `--z-sticky-header` token formalises
  the layer.

### Open questions deferred

- Whether to add a "scrolled" elevation style (subtle shadow when the
  page has scrolled under the header). Deferred — nice-to-have, not
  blocking. Add when the demo audience asks.
- Whether to add a Compose link to the AppNav for desktop users
  (where there's no FAB). Deferred — the FAB is the design intent;
  desktop-only Compose entry is a separate decision.

## Alternatives considered

- **Keep current structure, add `position: sticky` to both strips
  with `top` offsets.** Rejected — the `top` offset for `AppNav` would
  have to match `LoggedInAs`'s rendered height, which varies (font
  scaling, line wrap, returns null in production). Brittle.
- **Custom pull-to-refresh on `/feed`.** Rejected for now — gesture
  handling on iOS WebKit is fiddly (detecting "scroll is at top",
  swallowing the gesture only then, not breaking native rubber-band).
  A header button is robust, accessible, and works in every mode. We
  can revisit if the demo audience asks for the gesture.
- **Add a PWA manifest with `display: browser` to force the URL bar
  to appear in home-screen-launched mode.** Rejected — opting into a
  manifest opens unrelated decisions (icons, theme colour, name) we
  shouldn't make as a side-effect of a header BU. The button gives us
  the same outcome with less surface.
- **Hard refresh via `window.location.reload()`.** Rejected — flashes
  the page, loses scroll, regresses the demo's perceived smoothness.
  `router.refresh()` is strictly better.

## Related

- D054, D061 — original `AppNav` scope (this decision consolidates)
- D051 — BU naming convention (`BU-sticky-nav`)
- BU-user-menu (next BU) — the avatar / Sign-out affordance lands
  into the same sticky header
- Memory: `project_ios_standalone_constraint` — the iPhone home-screen
  bookmark constraint that motivates the refresh button

# D066 — Multi-CTA Action model for Post (primary + secondary CTAs)

**Date:** 2026-04-27
**Tier:** Foundation
**Status:** Proposed (UI placeholders shipped first; schema migration deferred until composer link-first work begins)
**Build Unit:** BU-multi-cta (proposed)

_Originally drafted as D065; renumbered to D066 after merge collision
with the BU-sticky-nav ADR that landed first on `main`._

## Context

D060 §3a flagged the future direction: every post has one primary
CTA plus optional secondary CTAs available inside the post detail.
The current schema is a stop-gap with two hardcoded URL slots —
`activistMailerUrl` (primary) and `linkUrl` (secondary, currently
treated as a preview card rather than a button). Post-demo, the
user has confirmed:

- The primary CTA is the **first thing** in a post — both visually
  (top row of card / detail) and in the composer (URL field first,
  body and title pre-filled from link metadata).
- Posts surface **secondary CTAs** alongside the primary — at MVP
  they're social re-share targets (X, Instagram, Facebook), rendered
  as a small icon rail. Future kinds include "Sign petition",
  "Donate", "Email your MP", "Share to WhatsApp", "Add to calendar".

The two-slot pattern can't grow into this — there's no array, no
labels, no kind discriminator, no ordering. Per CLAUDE.md, schema
changes need an ADR.

## Decision

Replace the two URL slots with a typed `Action[]` collection
attached to `Post`. One row per CTA. Schema-locked to a small
enum of action kinds; per-action label, URL, ordering, and a
single `isPrimary` flag.

```prisma
model Post {
  // ... existing fields, minus the two URL slots ...
  actions  Action[]
}

model Action {
  id          String     @id @default(uuid())
  postId      String
  post        Post       @relation(fields: [postId], references: [id], onDelete: Cascade)

  kind        ActionKind
  url         String
  label       String?    // optional override for the auto-derived button copy
  orderIndex  Int        // 0 = primary slot when isPrimary, else stable secondary order
  isPrimary   Boolean    @default(false)

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([postId, orderIndex])
}

enum ActionKind {
  am_action          // Activist Mailer (today's activistMailerUrl)
  external_link      // generic article / resource (today's linkUrl)
  petition
  donation
  email_mp
  share_whatsapp
  share_x
  share_instagram
  share_facebook
  calendar_invite
}
```

### Rules

1. **Exactly one primary** per post. Enforced at the API boundary
   (zod refines `actions` so `actions.filter(a => a.isPrimary).length <= 1`),
   not at the DB layer (no partial-unique-index gymnastics needed yet).
   A post may have zero primary actions (a "Just write" post with no
   CTA).
2. **Cap on secondary actions: soft, in the UI; no schema cap.**
   The composer surfaces "add up to 2 secondary CTAs" but the schema
   itself doesn't enforce a count. Reason: real growth (e.g. "petition
   - donate + share + email-MP" combos) shouldn't require another
     migration. UI cap is a product decision; let it move freely.
3. **`orderIndex` is stable.** Drag-reorder in the composer rewrites
   indices. Display orders by `orderIndex ASC` within `isPrimary` partitions.
4. **`label` is optional.** When null, the button copy is derived
   from `kind` (e.g. `am_action` → "Send email →", `donation` →
   "Donate"). Member can override per-post (e.g. "Donate to the
   appeal"). 200-char cap.
5. **`url` validation** is per-kind at the boundary:
   - `am_action`: must match `ACTIVIST_MAILER_ALLOWED_DOMAINS`
   - `share_x` / `share_instagram` / `share_facebook`: optional —
     if null, the rail uses platform homepage as a placeholder
     (matches current MVP placeholder rail behaviour)
   - all others: `https?://` only, length-capped, no `javascript:`/`data:`/`mailto:`

### Migration

Two-phase, expand-then-contract (per F08 / B05):

**Phase 1 — additive (this ADR):**

1. Add `Action` table and `ActionKind` enum.
2. Backfill: for each existing `Post`, synthesise rows:
   - one `Action(kind=am_action, isPrimary=true, orderIndex=0, url=activistMailerUrl)` if `activistMailerUrl IS NOT NULL`
   - one `Action(kind=external_link, isPrimary={NOT activistMailerUrl}, orderIndex=0|1, url=linkUrl, label=linkTitle, ...)` if `linkUrl IS NOT NULL`
3. Keep `activistMailerUrl` and `linkUrl` columns nullable on `Post` for the duration of Phase 1 — read paths consult both, write paths begin writing to `Action`.
4. Move existing link-preview metadata (`linkTitle`, `linkDescription`, `linkImageUrl`, `linkSiteName`) onto a separate concern (parking-lot already proposes a `LinkPreview` cache table keyed by URL; that work is independent of D066).

**Phase 2 — drop legacy columns:**

- After all read/write paths are off the legacy columns and at least one production deploy has run cleanly on `Action[]` only, remove `activistMailerUrl` / `linkUrl` / `linkTitle` / `linkDescription` / `linkImageUrl` / `linkSiteName` from `Post` in a follow-up migration with its own ADR. Don't bundle the drop into Phase 1.

### What ships before the schema migration

The visible UI for secondary CTAs (right-rail X / Instagram / Facebook
placeholders on every post card and detail) lands ahead of D066's
schema work. The placeholders aren't backed by `Action` rows yet —
they're a static rail in `<SecondaryCtaRail>` linking to platform
homepages. When D066 lands, the rail's `PLATFORMS` array becomes
`post.actions.filter(a => !a.isPrimary)` and the per-icon URL is
composed from the action's `url` and `kind`.

## Consequences

### Wins

- One model covers today's two slots and tomorrow's petition-and-donate
  combos. No further migrations to grow the CTA surface.
- Composer becomes URL-first with a clean primary-action concept:
  member pastes the URL, kind is auto-detected (or picked from a
  small menu), the row becomes the post's primary `Action`.
- Per-action labels solve the "Send email" vs "Donate" vs "Sign
  petition" copy problem without per-kind hardcoding in
  `<LinkPreviewCard>`.
- Secondary CTAs are typed, so analytics events can carry
  `cta_kind` (helpful for measuring petition-CTR vs donate-CTR).

### Costs

- Every `Post` read now hydrates an `Action[]` (Prisma `include`).
  At MVP scale (≤1000 posts × ≤3 actions) this is fine; if/when
  feed pagination needs further tuning, we add a projection.
- Migration writes one or two rows per existing post — straightforward
  but not free. Backfill plan needs to run inside the migration
  (idempotent), not as an out-of-band script.
- API contract churn: the tRPC `post.list` / `post.getById` payloads
  grow an `actions` field; existing callers (`PostCard`, detail page)
  must read from `actions` instead of the legacy columns. Plan to
  ship a server-side mapper that synthesises `actions` from the
  legacy columns during Phase 1 so client code can switch over once
  and not move twice.

### Open questions deferred to BU-multi-cta brief

- Composer UX for picking secondary CTA kinds (chip menu? dropdown?
  search?). Tied to the link-first composer brief.
- Whether `share_x` / `share_instagram` / `share_facebook` are
  modelled as Actions at all, or whether they're a UI affordance
  the rail renders unconditionally (no DB row). Likely the latter —
  resolve in the brief.
- Per-kind icon set. Currently hand-rolled SVGs in `<SecondaryCtaRail>`;
  the brief picks an icon dependency (simple-icons via react-icons/si
  is a strong candidate) and replaces them.
- Drag-reorder UI in the composer.

## Alternatives considered

- **Add a third `petitionUrl` slot** (and a fourth, and a fifth, ...).
  Rejected — every new CTA kind would be a schema migration; doesn't
  scale.
- **JSONB `actions` blob on `Post`**. Rejected — same reasons as
  D060 (no typed access, no per-action validation, no eventual
  per-action analytics joins, no nice migration when fields evolve).
- **Polymorphic `CtaTarget` like `ReactionTarget` (D050)**. Rejected
  for now — only `Post` has CTAs in the foreseeable surface;
  polymorphism would add complexity without a second target type
  to justify it. If `Comment` or `Request` ever grows CTAs, revisit.
- **Keep two slots; add a third "linkUrl2"**. Rejected — explicit
  YAGNI; we already know we want unbounded growth, half-measures buy
  nothing.

## Related

- D060 — Post schema additions for link-share preview cards
  (D066 supersedes §3 and §3a; the link-preview metadata fields are
  a separate refactor onto a `LinkPreview` cache table per the parking lot)
- D050 — Reaction polymorphic schema (a model for typed-target relations
  if `Action` ever needs to attach to non-Post entities)
- Parking-lot entry: "Multi-CTA model — primary action + multiple
  secondary actions per post" (this ADR fulfils that parking-lot row)
- Parking-lot entry: "Auto-fetch Open Graph metadata" (D066-adjacent —
  the URL-first composer that drives `Action` creation depends on
  OG fetch landing or being parked-explicit)
- `docs/product/post-creation-flow.md` (the link-first composer vision
  D066 unblocks)
- `components/SecondaryCtaRail.tsx` (the placeholder UI shipped
  ahead of this ADR's schema migration)

---

# D067 — WhatsApp share analytics: stub ping completes the catalogued event

**Date:** 2026-04-27
**Tier:** Analytics / Product
**Status:** Accepted
**Build Unit:** BU-whatsapp-share

## Context

PR #111 (BU-share-rail-on-detail) shipped the WhatsApp share
affordance: a green button on every PostCard right rail and a labelled
pill on the post detail page, both opening `wa.me/?text=...` with the
post title + body + post URL pre-filled. The "WhatsApp-replacement
loop" — Sharon's reflex of "I'll send this to North London" — is now
one tap away.

What did not ship in #111: the analytics ping. The catalogued event
`post_shared_out` (in `docs/product/analytics-events.md`) lists
`destination: 'whatsapp'` as a valid value but its "Fired from" line
still points at a hypothetical future `app/components/ShareMenu.tsx`.
In production today, every WhatsApp tap is invisible to us.

The full BU-share-out spec (`docs/product/share-out-mechanics.md`)
describes a richer system: a `Route` table for saved WhatsApp groups,
a `DispatchEvent` schema with a `dispatch_initiated → dispatch_confirmed
→ abandoned` state machine, and a return-confirmation prompt ("Did
you send to North London? [Yes] [Not yet] [Skip]"). Building all of
that requires multiple sessions and ERD-Slice-3 territory.

The demo audience needs visibility into share usage now, not after
BU-share-out ships.

## Decision

Wire `<WhatsAppShareButton>` to fire the existing catalogued
`post_shared_out` event on click via a stub server endpoint. Five
deliberate omissions vs the full BU-share-out spec:

1. **Stub server sink.** `POST /api/analytics/share-intent` accepts
   `{ postId, destination }` and logs a tagged line to stdout with the
   post id one-way hashed (matches the catalogue's `post_id_hash`
   property name). When BU-share-out lands a real analytics sink, this
   endpoint becomes a thin pass-through and the contract is unchanged.

2. **No DispatchEvent persistence.** No `Route` table, no
   `DispatchEvent` table, no `dispatch_initiated → dispatch_confirmed
→ abandoned` state machine. The event is fire-and-forget; the
   server has no record of which post was forwarded.

3. **No return-confirmation prompt.** The click is a plain link
   navigation to WhatsApp. We do not show "Did you send?" on return.
   Acknowledged: this means the server cannot distinguish "tapped and
   sent" from "tapped, looked at WhatsApp, backed out." Acceptable
   for demo; not acceptable for pilot — BU-share-out resolves it.

4. **`post_type` property not populated.** The catalogued event lists
   `post_type` as a property; the demo slice does not look up the post
   to populate it (would cost a DB query per share). BU-share-out's
   richer endpoint resolves this.

5. **WhatsApp only.** The X / Instagram / Facebook buttons in the
   shipped `<SecondaryCtaRail>` are not wired to the endpoint by this
   ADR. The contract supports them — `destination` accepts the full
   catalogued enum — but a follow-up slice (or BU-share-out itself)
   wires them in.

The transport mechanism is `navigator.sendBeacon` (which survives the
navigation away to WhatsApp), with a `fetch keepalive: true` fallback
for restricted contexts where sendBeacon refuses or is unavailable.
Fire-and-forget — the share UX never blocks on a ping failure.

The catalogue's "Fired from" line is updated to read:
`components/WhatsAppShareButton.tsx (BU-whatsapp-share, demo slice —
fires intent on click; post_type not yet populated, see D067) →
app/components/ShareMenu.tsx (BU-share-out, future — fires on
confirmed handoff with full property set)`.

## Consequences

### Wins

- Every WhatsApp tap on the demo now produces a server-side analytics
  line. The "is anyone using this?" question has a real answer.
- Zero schema cost. No Prisma model, no migration, no service-layer
  changes. The whole slice is one component edit + one endpoint +
  three docs.
- Forward-compatible. The `<WhatsAppShareButton>` tap handler, the
  `pingShareIntent()` helper inside it, and the
  `/api/analytics/share-intent` endpoint all become reusable inputs
  to BU-share-out.
- The catalogue's contract is honoured. `post_shared_out` is no
  longer an aspirational entry pointing at a non-existent component.

### Costs

- Tap-event analytics is not the same as confirmed-share analytics.
  We see intents, not deliveries. The "Did you send?" prompt is the
  conversion-funnel signal we are deferring; pilot needs it.
- The endpoint logs to stdout. Production deploys must capture
  stdout into something queryable (already true for any Next.js
  server log; no new infra). When BU-share-out wires a real sink,
  this endpoint becomes a pass-through.
- `post_type` stays unpopulated until BU-share-out. Analytics queries
  cannot break down WhatsApp shares by post kind from this slice
  alone.
- The tap handler now has a side-effect (the ping). Any future
  refactor of `<WhatsAppShareButton>` must preserve it; the component
  test (`tests/unit/whatsapp-share-button-analytics.test.tsx`) catches
  regressions.

### Reconciliation path

When BU-share-out builds:

- The `pingShareIntent()` helper inside `<WhatsAppShareButton>` is
  lifted into a shared client helper that the X / IG / FB buttons in
  `<SecondaryCtaRail>` also use.
- The `/api/analytics/share-intent` endpoint gains a `post_type`
  lookup (one query per share intent — acceptable when the volume
  justifies it).
- The endpoint stops logging to stdout and writes to the real
  analytics sink.
- The "Did you send?" return-confirmation prompt lands. The endpoint
  gains a separate `share_confirmed` analytics event (or extends
  `post_shared_out` to carry a `confirmed: bool` property).
- `Route` table + `DispatchEvent` state machine ship in the same
  BU-share-out PR or a sibling.

This ADR is the contract that those decisions are deliberately
deferred, not forgotten.

## Alternatives considered

- **Skip the analytics ping for the demo.** Rejected — the catalogue
  already specifies `post_shared_out` and the cost of firing it is
  trivial. Skipping leaves the "Fired from" line dangling and gives
  us no signal at all.
- **Fire the event from a tRPC mutation instead of a REST endpoint.**
  Rejected — the catalogue's "Fired from" pattern uses client-side
  fire-and-forget for share events; a tRPC mutation would block the
  navigation away to WhatsApp. sendBeacon is the right primitive.
- **Look up the post in the endpoint to populate `post_type`.**
  Rejected for this slice — costs a DB query per share intent and
  the demo doesn't need the breakdown yet. BU-share-out picks it up.
- **Wire X / IG / FB at the same time.** Rejected for scope. Same
  shape, different commit. Keeps this PR small and reviewable.

## Related

- PR #111 (BU-share-rail-on-detail) — the affordance this ADR
  instruments
- `docs/build/session-briefs/bu-whatsapp-share.md` — the brief
  implementing this decision (also fixes #111's dangling `@spec`
  reference)
- `docs/product/share-out-mechanics.md` — the full spec this slice
  intentionally narrows
- `docs/product/analytics-events.md` — `post_shared_out` event row
  consumed by this BU
- D013 — self-dispatch default
- D061 — global tap interaction pattern (the click handler respects
  it via `stopPropagation()`)
- BU-share-out (future) — reconciles every divergence recorded above
- Memory: `project_share_taxonomy` — WhatsApp + socials rail both
  fire the same event with different `destination` values

# D068 — Brief lifecycle status as typed front-matter; generator + CI gate

_Status: accepted (2026-04-27). Authored by Paul + Claude._

## Context

PRs #105, #108, #110 surfaced a real drift class: prose status sections
in `CLAUDE.md` and `docs/build/bu-sequence.md` had fallen weeks behind
the actual ship state of multiple Build Units (Reactions, Comments,
FAB intent picker, Requests/Urgent, Vetting, Admin CRUD + audit +
bulk-ops, Link share, AM-link collapse, Hero images, Versioning, F14).
The gap was severe enough that a session-mid-conversation
recommendation was based on stale information. PR #108 reset the prose;
this ADR records the decision to install the mechanism that prevents
recurrence.

## Decision

Brief lifecycle status moves from prose narrative (hand-edited in
multiple files) to typed YAML front-matter on each brief. A generator
script reads the front-matter and emits managed AUTOGEN regions in
`bu-sequence.md`. A CI gate plus a pre-commit hook block stale or
unflipped state from reaching main.

**Front-matter schema** (every `docs/build/session-briefs/*.md`):

```yaml
---
slug: <kebab-case> # filename without .md
status: planned | in_progress | shipped | abandoned
shipped_in: '#NNN' # optional unless status=shipped
phase: 0 | 1 | 2 | 3 | 4 # optional grouping
priority: high | medium | low # only meaningful when status=planned
superseded_by: <slug> # optional, status=abandoned
note: '<free text>' # optional, anything that doesn't fit
---
```

**Generator** (`scripts/generate-trackers.ts`):

- Default mode: regenerate `<!-- AUTOGEN:shipped:start -->` and
  `<!-- AUTOGEN:planned:start -->` regions in `bu-sequence.md`
- `--check` mode: exit non-zero if regenerating would change the
  file (used by CI and pre-commit)
- Idempotent. Marker-region preservation lets hand-edited prose
  surround the managed tables without conflict.

**CI gate** (`.github/workflows/brief-status-check.yml`):

1. `npm run trackers:check` — fails if AUTOGEN regions are stale.
2. `scripts/check-brief-flip.ts` — if PR title/body references
   `BU-<slug>` matching an existing brief, the PR diff must add
   `status: shipped` to that brief. Mirrors the version-bump gate.

**Pre-commit hook** (`.husky/pre-commit`): runs
`npm run trackers:check` so staleness is caught before push, not at
PR-open time.

## Consequences

- Single source of truth for brief lifecycle. Prose narrative tables
  in `bu-sequence.md` are now generated artefacts; their hand-edit
  surface is the front-matter.
- BU PRs cannot merge without flipping their brief's `status:` to
  `shipped`. The discipline becomes mechanical, not ceremonial.
- `CLAUDE.md` "Current focus" stays human-written — it is loaded
  into every Claude Code session's context, and stability beats
  auto-currency. It references `bu-sequence.md` for canonical
  ship-state.
- Existing briefs (35 at adoption time) gain front-matter via a
  one-shot retrofit tied to the bu-sequence.md #108 snapshot. PRs
  #106 and #111 (sticky-nav, whatsapp-share) are reflected by the
  retrofit.
- `bu-composer-link-first` is flagged `status: planned` with a note
  that its actual state is uncertain — surface for verification on
  next pass.

## Alternatives considered

- **Hand-edited prose (status quo).** Rejected — that's the failure
  mode this ADR exists to fix.
- **Status table in a single docs file** (instead of front-matter
  per brief). Rejected — colocating status with the brief means a
  PR that ships the BU naturally edits the brief, no separate file
  to remember.
- **Generated CLAUDE.md "Current focus".** Rejected — see consequences
  above; CLAUDE.md stability matters more than auto-currency, and the
  generated table in `bu-sequence.md` already gives Claude a stable
  reference point.
- **GitHub API auto-flip on branch creation.** Rejected for v1 —
  manual flip in the same PR is sufficient and avoids API-token
  plumbing. Reconsider if "in_progress" tracking proves useful.
- **Database / Notion as source of truth.** Rejected — markdown stays
  the canonical artefact for everything else in this repo (decisions,
  scenarios, parking lot); briefs follow the same convention.

## Related

- PR #108 — prose-status reset (the bleed)
- PR #110 — brief draft for this mechanism
- `docs/build/session-briefs/bu-brief-status-mechanism.md`
- `scripts/generate-trackers.ts`
- `scripts/check-brief-flip.ts`
- `.github/workflows/brief-status-check.yml`
- `docs/process/versioning.md` (the version-bump gate this mirrors)
- `docs/process/reviewer-checklist.md` (manual backstop row)

# D069 — `tick_or_cross` PostKind + `Post.signal` + post-publish handoff to GPS Network channel (BU-tick-or-cross)

_Status: accepted (2026-04-27). Authored by Paul + Claude._

## Context

Demo scenario: third-party allies monitor the GPS Network WhatsApp
channel for posts prefixed `✅` (amplify) or `❌` (flag/report). Today
this is hand-curated in WhatsApp. The demo needs to show a member
creating one of these posts inside GPS Action and the post landing in
the channel as part of the publish action — visibly marked in-app so
members understand what just happened.

Several adjacent decisions already exist:

- **D017** anticipated a `verdict: 'boost' | 'remove'` field on Post,
  paired with multi-channel routing.
- **D016** specified a future WhatsApp Business API integration that
  would auto-post on the user's behalf.
- **D015** scoped a `boost_remove_team` flag for who may issue
  verdicts.

This BU is a deliberately narrow demo slice on top of those. It is
**not** the full D016/D017 system — it is a single-channel,
self-dispatch handoff with a confirm step.

## Decision

1. **Add `Signal` enum + `Post.signal Signal?` column.** Same shape as
   D017's `verdict`, deliberately renamed. The internal data label is
   `signal`; member-facing copy uses `✅` / `❌` glyphs and the words
   "amplify" / "flag" — never "promote" / "remove" / "verdict".
   Service-layer invariant: `signal` is required when
   `kind.slug === 'tick_or_cross'`, forbidden otherwise.
2. **Add `Post.sharedToNetworkAt DateTime?` column.** Null until the
   author explicitly confirms the WhatsApp paste landed in the
   channel. Idempotent setter via a new
   `post.markSharedToNetwork({ postId })` tRPC procedure.
3. **Add `tick_or_cross` PostKind row.** `displayName: '✅ or ❌'`,
   `icon: 'check-square'`, `sortOrder: 5`, `isAlertEligible: false`.
   Prominent slot in the FAB picker but never #1 — the alert-eligible
   `happening_now` keeps the top.
4. **Publish flow.** On submit of a `tick_or_cross` post, the post
   saves first (post visible in feed regardless of share outcome).
   Then a confirm modal shows the formatted message
   (`✅ {title}\n{body}\n{postUrl}` or `❌ …`), writes it to the
   clipboard via `navigator.clipboard.writeText`, and offers a single
   primary CTA "Open GPS Network channel" that launches
   `WHATSAPP_NETWORK_CHANNEL_URL` in a new tab. On return, "I sent it"
   flips `sharedToNetworkAt`; "Not yet" leaves it null and the card
   surfaces a retry CTA.
5. **WhatsApp channel deep-link constraint.** `chat.whatsapp.com/`
   group-invite URLs and `wa.me/` individual-chat URLs accept
   `?text=` prefill; **WhatsApp Channel URLs do not**. Accepted for
   demo. Mitigation is the clipboard write + honest copy in the modal
   ("Message copied — open the channel and paste"). When D016 wires
   the Business API, the clipboard step disappears.
6. **Permission gate.** Anyone authenticated may create a
   `tick_or_cross` post and trigger the handoff. D015's
   `boost_remove_team` is deferred to post-demo.
7. **Tone.** `❌` posts get the same calm visual treatment as `✅`.
   No red, no alarm styling, no anxiety amplification — the glyph
   alone carries the meaning, per design-philosophy.md.

## Consequences

- The post is published regardless of whether the share confirms — by
  design. The "Sent to GPS Network" pill is gated on
  `sharedToNetworkAt`; the post itself is not.
- `signal` is internal vocabulary. Any member-facing string that needs
  to mention it uses ✅ / ❌. Reviewers should reject UI copy that
  leaks the enum names.
- `post_shared_out` analytics event is reused (no new event); the
  publish-triggered auto-handoff is an additional firer of the same
  event with `destination='whatsapp'`.
- iOS standalone (no URL bar, no native share sheet) handles the
  channel deep-link via universal link; the "did you send it?" flow
  uses focus / visibility events rather than tab-close detection.
- Future D016 work removes the clipboard step but keeps the schema
  unchanged. `signal` stays; `sharedToNetworkAt` becomes server-set
  on confirmed delivery rather than self-reported.

## Alternatives considered

- **Reuse D017's `verdict` name.** Rejected — D017's intent was
  multi-channel routing with a vetting flow attached. The demo is a
  single-channel self-dispatch with a self-report confirm. Reusing
  the name would make the future D016/D017 migration ambiguous.
- **Save the post only on confirmed share.** Rejected — pre-brief
  decision #5. Loss of the post on a cancelled share would be a
  worse UX surprise than a post visible without the "sent" pill.
- **No confirm step (assume tap = sent).** Rejected — silent lying
  about delivery violates the honest-copy principle. The "Did you
  send it?" friction is small; the trust gain is large.
- **Encode the signal in the body text instead of as a column.**
  Rejected — defeats the point of structured data. Feed filters,
  analytics, and the future D016 routing all need to read it
  directly.
- **Ship with the WhatsApp Business API now.** Rejected — D016 scope
  is multi-week (rate limits, message templates, deliverability
  monitoring). Demo deadline does not allow.

## Related

- D015 — `boost_remove_team` flag (deferred for demo)
- D016 — WhatsApp Business API for Channels (Phase 2; this BU's
  successor)
- D017 — Boost/Remove as a verdict on Post (this BU narrows it)
- D044 — Intent-first post creation / FAB cards model
- D058 — Urgent flag on Post (orthogonal to kind)
- D062 — PostKind as managed table; orthogonal urgency
- D064 — Post.heroImageUrl (recent additive Post column for reference)
- D067 — WhatsApp share analytics catalogue (event reused, not extended)
- BU-fab-intent-picker — adds the `tick_or_cross` tile
- BU-whatsapp-share / PR #111 — the share machinery this BU does
  **not** reuse for the publish flow (auto-handoff is distinct from
  user-initiated card share); the modal pattern is new code.

# D070 — Reference data ships in migrations, not seeds; CI gate fails the merge if a code-referenced row is missing

**Date:** 2026-04-28
**Status:** Accepted
**Trigger:** BU-tick-or-cross (PR #129) shipped a code path that references the `tick_or_cross` PostKind slug, but the migration only added the `Signal` enum and two columns — no `INSERT INTO "PostKind"`. The row existed only in `scripts/seed.ts`. Tests passed because tests run the seed; preview/prod did not, so the live composer threw `signal is only valid for tick_or_cross posts` for every tick-or-cross submission. Surfaced in dev as a generic `Could not create post. Try again.`

## Decision

1. **Reference data ships with idempotent migrations.** Any row the application code references by static slug or id (e.g. `PostKind.slug === 'tick_or_cross'`, future taxonomy tables, lookup enums migrated to tables) MUST be inserted by a Prisma migration with `ON CONFLICT … DO NOTHING`. `scripts/seed.ts` and `prisma/seed.ts` are reserved for **demo content** (synthetic users, posts, comments) — never reference data.
2. **Single source of truth for required slugs.** The set of code-referenced PostKind slugs lives in `shared/post-kinds.ts` as `REQUIRED_POST_KIND_SLUGS`. The composer page derives its known-intent set from this constant; the assertion below reads the same constant. Adding a slug in two places (or forgetting to add it in one) is now impossible.
3. **Boot-time invariant + CI gate.** `server/lib/assert-reference-data.ts` exports `assertReferenceData()` which throws `MissingReferenceDataError` listing every required slug missing or soft-deleted. The CI `deploy-check` job runs `npm run check:reference-data` after `prisma migrate deploy` (no seeds applied) — non-zero exit fails the merge. The compose page also calls the assertion logic against its already-loaded `kindMap` so dev-time failures surface as a specific error, not a generic "post failed".

## Why this rule, not the alternatives

| Alternative                                             | Why rejected                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Run `db:seed` during build/deploy.**                  | `scripts/seed.ts` inserts demo users, demo posts, fake comments. Running it in production would corrupt the dataset. Reference data and demo content have different shelf lives and different audiences; conflating them is the bug we're fixing. |
| **Catch at the service layer with a friendlier error.** | Doesn't fix the missing row. User still can't post. CI still merges broken code.                                                                                                                                                                  |
| **Trust authors to remember.**                          | The BU-tick-or-cross author had a thorough brief, a test suite, code review, and a CI pipeline. The gap landed anyway. Process > discipline.                                                                                                      |
| **Static analysis (lint rule).**                        | Possible but fragile — slugs can be constructed dynamically, imported from constants, etc. A runtime gate against a real migrated database has zero false negatives.                                                                              |

## How it works

```
PR opened
  → CI job runs:
      npm ci
      npm run db:generate
      npx prisma migrate deploy           # applies all pending migrations
      npm run check:reference-data        # boot-time assertion against the migrated DB
        ↑ fails if any REQUIRED_POST_KIND_SLUGS row is missing
  → red CI = merge blocked
```

Branch 1 (`fix/tick-or-cross-postkind-data-migration`, this ADR's home) ships parts 1-2 + the assertion. Branch 2 (`chore/ci-reference-data-gate`) wires `check:reference-data` into `.github/workflows/ci.yml` — the merge-blocking step.

## Consequences

- **One-line cost per new PostKind.** Add the slug to `shared/post-kinds.ts`, write a one-line `INSERT INTO "PostKind" … ON CONFLICT DO NOTHING` migration. Forget either → CI red.
- **Migrations now contain data, not just schema.** Prisma supports this fine, but reviewers should expect to see `INSERT` statements alongside `CREATE TABLE` / `ALTER TABLE`. Idempotency (`ON CONFLICT DO NOTHING`) is mandatory.
- **`scripts/seed.ts` shrinks over time.** PostKind upserts in seed are now redundant (migrations seed them). Removing them is a clean follow-up; the upserts are idempotent so leaving them is harmless until then.
- **Pattern generalises.** The same approach should apply if SystemSetting, future taxonomy tables, or any other "code references this row by static identifier" tables emerge. `REQUIRED_POST_KIND_SLUGS` is the first instance — others get parallel constants and parallel assertion lines.
- **CLAUDE.md gains a "Don't" rule.** "Don't add code that depends on a slug/id without a corresponding migration insert."

## Related

- D062 — PostKind as managed table (the table this rule first applies to)
- D068 — Brief lifecycle status as front-matter (the previous CI gate added for similar reasons — process > discipline)
- D069 — `tick_or_cross` PostKind (the BU whose miss surfaced this gap)
- BU-tick-or-cross — the originating bug
- PR #129 — the merge that introduced the gap

# D071 — Prisma 5 → 7 upgrade: connection URL out of schema, runtime via @prisma/adapter-pg

**Date:** 2026-04-28
**Status:** Accepted
**Trigger:** Dependabot's bump of `prisma` from 5.22.0 to 7.8.0 (PR #97, closed) failed CI on `Prisma schema validation: The datasource property url is no longer supported in schema files`. Prisma 7 enforces a hard split between **migrate-time** configuration (CLI) and **runtime** configuration (the client). Without an upgrade plan, our schema is contract-locked-broken: we can't merge a Prisma bump without changing both files.

## Decision

1. **Move the connection URL out of `prisma/schema.prisma`.** The `datasource db { url = env("DATABASE_URL") }` line is removed. The block keeps only `provider = "postgresql"`. Schema files now describe the data model only — connection plumbing is environment concern.

2. **Migrate-time URL lives in `prisma.config.ts`.** A new top-level `prisma.config.ts` exports `defineConfig({ datasource: { url: process.env.DATABASE_URL! } })`. This is what the Prisma CLI (`migrate`, `db push`, `studio`, `generate`) reads. Loaded via `prisma/config`'s `defineConfig`; uses `dotenv/config` so local `.env` still works.

3. **Runtime URL lives in `server/db/client.ts` via `@prisma/adapter-pg`.** The PrismaClient constructor now receives `{ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) }`. Driver-adapter is the right path for our deployment (AWS RDS Postgres, no Accelerate), and is the Prisma-blessed direction post-7.

4. **Skipping Prisma 6 directly to 7 is supported.** Prisma's 5→7 path passes through 6's deprecations transparently for our usage (no Pulse, no Accelerate, no rejected-on-6 features). All 552 tests + typecheck + lint pass on the upgrade.

## Why this rule, not the alternatives

| Alternative                                                | Why rejected                                                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Stay on Prisma 5.**                                      | Stale runtime, security patches lagging, ecosystem moving. Dependabot will keep proposing the bump. Fixing it once is cheaper than declining indefinitely.               |
| **Migrate URL via `accelerateUrl` instead of an adapter.** | Accelerate is a paid Prisma cloud product (connection pooler + edge cache). We use AWS RDS directly; Accelerate would add cost and a vendor dependency for zero benefit. |
| **Keep `url` in schema with a Prisma 5 escape hatch.**     | Doesn't exist on Prisma 7 — the validation error is hard, not advisory.                                                                                                  |
| **Two-step: 5 → 6 → 7.**                                   | The intermediate step buys nothing for our codebase. We don't depend on any 6-deprecated APIs.                                                                           |

## What changed

- `package.json`: `prisma` and `@prisma/client` to `^7.8.0`. New deps: `@prisma/adapter-pg ^7.8.0`, `pg ^8.20.0`, `@types/pg ^8.20.0` (dev).
- `prisma/schema.prisma`: removed `url = env("DATABASE_URL")` from the datasource block.
- `prisma.config.ts`: new file at project root. Provides the URL to the Migrate CLI.
- `server/db/client.ts`: instantiates `PrismaPg` adapter and passes it to the `PrismaClient` constructor.

## Consequences

- **`.env` plumbing unchanged.** `DATABASE_URL` is still the single env var that holds the connection string. Both `prisma.config.ts` and the client read from it.
- **CI's Prisma steps unchanged.** `prisma generate`, `prisma migrate deploy`, `prisma migrate dev` all read `prisma.config.ts` automatically — no workflow edits needed.
- **One adapter dep added at runtime.** `@prisma/adapter-pg` + `pg` ship to production. ~80 KB unminified — acceptable.
- **No data migration.** The schema's data model is unchanged; this is a config-shape upgrade, not a data shape change.

## Related

- D070 — Reference data ships in migrations (the previous prisma-tooling decision)
- PR #97 — Dependabot's failed solo bump (closed; replaced by this PR)

# D072 — Post lifecycle, publish router, and per-kind action registry

**Date:** 2026-04-28
**Status:** Accepted
**Trigger:** BU-tick-or-cross (D069) shipped a single-purpose post-publish modal (`<SendToNetworkConfirm />`) with one CTA — "Open GPS Network channel" — bolted onto the only PostKind that needed it. Reviewing the live UX surfaced three needs at once: (a) authors need more options at publish-time than just "share to WhatsApp" — saving as draft, sending for review, discarding; (b) those options apply to **every** PostKind, not just `tick_or_cross`, so the modal needs to generalise; (c) different PostKinds want different kind-specific actions alongside the universal ones (cultural → "Schedule for sundown", link_share → "Share on socials", call_to_action → "Open Activist Mailer", etc.).

The choice was: keep bolting per-kind modals on, or build a single publish router that scales.

## Decision

### 1. Post lifecycle as orthogonal flags, not a 4-value enum

`Post.status` is a **2-value enum** — `draft | published`. Discard remains the existing `Post.deletedAt` soft-delete pattern. Review state is a **separate, orthogonal flag** — `Post.reviewRequestId` (nullable FK to `Request`).

This gives four meaningful cells:

| `status`    | `reviewRequestId` | Meaning                                               |
| ----------- | ----------------- | ----------------------------------------------------- |
| `draft`     | `null`            | Private draft, just the author                        |
| `draft`     | set               | Sent to reviewers (review-first), not in feed yet     |
| `published` | `null`            | Live in feed, no review                               |
| `published` | set               | Live in feed AND being reviewed (post-publish review) |

Why two states + flag instead of a 4-value enum (`draft | published | pending_review | archived`):

- Combining "draft + reviewing" and "published + reviewing" into one `pending_review` enum value loses the distinction.
- Adding "scheduled" later is one new enum value (`scheduled`), not a rewrite.
- Reviewer queue queries are simple: `WHERE reviewRequestId IS NOT NULL` — same query whether the post is also live or not.
- "Archived" is admin terminology that doesn't map cleanly here; soft-delete via `deletedAt` is the pattern already used elsewhere in the schema.

Adds: `Post.publishedAt DateTime?` for clean "saved at" vs "published at" timestamps.

### 2. Per-kind config columns on `PostKind`

Four new columns drive what the publish router renders for each kind:

| Column           | Type                                                                                                                    | Effect                                                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actionSlugs`    | `String[]`                                                                                                              | Which kind-specific actions render in the modal — slug references resolved in code via the action registry (item 4 below)                                                                     |
| `reviewMode`     | `enum ReviewMode { review_first, review_after_publish, either_with_default_review_first, either_with_default_publish }` | Drives the modal's preselected default and whether self-publish is even offered                                                                                                               |
| `canSelfPublish` | `Boolean`                                                                                                               | If `false`, the "Post to feed" base action is hidden — author must go through review                                                                                                          |
| `reviewPriority` | `RequestPriority` (existing enum: `urgent / high / normal / low`)                                                       | When a `kind_review` Request is created from a post of this kind, it inherits this priority — high-stakes kinds bubble up the reviewer queue without needing a separate request type per kind |

Initial seed values:

| PostKind         | `actionSlugs`               | `reviewMode`                       | `canSelfPublish` | `reviewPriority` |
| ---------------- | --------------------------- | ---------------------------------- | ---------------- | ---------------- |
| `happening_now`  | `[]`                        | `review_after_publish`             | `true`           | `urgent`         |
| `tick_or_cross`  | `['share_to_gps_whatsapp']` | `either_with_default_review_first` | `true`           | `high`           |
| `cultural`       | `['schedule_for_sundown']`  | `review_first`                     | `false`          | `high`           |
| `call_to_action` | `['open_activist_mailer']`  | `either_with_default_review_first` | `true`           | `normal`         |
| `link_share`     | `['share_to_socials']`      | `either_with_default_publish`      | `true`           | `normal`         |
| `event`          | `['add_to_calendar']`       | `either_with_default_publish`      | `true`           | `normal`         |
| `meeting`        | `['open_join_link']`        | `either_with_default_publish`      | `true`           | `normal`         |
| `outcome`        | `[]`                        | `either_with_default_publish`      | `true`           | `low`            |
| `thought`        | `[]`                        | `either_with_default_publish`      | `true`           | `low`            |

Phase 1 only **wires** `share_to_gps_whatsapp` (it's the existing `tick_or_cross` behaviour); the other slugs are reserved names — the modal treats unknown slugs as inert until a future BU registers a handler.

### 3. Single generic `RequestType: 'kind_review'`, not granular per-kind types

Adds one value to `RequestType`: `'kind_review'`. **Not** `'tick_or_cross_review' / 'cultural_review' / ...` — those would proliferate without buying anything. Reviewers filter by `post.kind` in the queue UI; queue ordering uses `Request.priority` (inherited from `PostKind.reviewPriority`) so high-stakes reviews bubble naturally.

Critically: `'kind_review'` is **distinct from** the existing `'vetting'` type. Vetting is for member admission to the network (a person is the subject); kind-review is for post review (a post artefact is the subject). They never share a queue. Reviewer scopes can grant access to one without the other.

### 4. Code-side action registry, schema-side toggle

The action registry lives at `shared/post-kind-actions.ts`:

```ts
export interface PostKindAction {
  slug: string;
  label: (post: { signal?: Signal }) => string;
  icon: LucideIcon;
  primary?: boolean;
  handler: (post: PostId, ctx: ActionContext) => Promise<void>;
}

export const POST_KIND_ACTION_REGISTRY: Record<string, PostKindAction> = {
  share_to_gps_whatsapp: {
    /* tick_or_cross's existing handoff */
  },
  // future: schedule_for_sundown, share_to_socials, etc.
};
```

Why this split:

- **Handlers are TypeScript** — they call server actions, dispatch URLs, render component children. They can't live in the database.
- **Slug list lives in `PostKind.actionSlugs`** — admin can toggle/reorder per kind without code change. The registry is the contract; the DB is the configuration.
- **Unknown slugs are inert.** If admin enables a slug whose handler hasn't shipped yet, the modal renders a disabled card with a "Coming soon" hint rather than crashing — graceful forward-compat.

**Not** a full join table (`PostKindAction(kindId, actionSlug, sortOrder, isPrimary)`). Reserved as a future migration if per-region overrides or fine-grained sort/primary ordering becomes a need; the array column is sufficient for everything Phase 1 demands.

### 5. Universal `<PostPublishModal>` — Pattern A (verb-first cards, grouped)

One modal component used by every PostKind. Renders cards in this order:

1. **Kind-specific primary action** if one exists (e.g. tick_or_cross's `Post & share to ✅ on GPS WhatsApp` — the 80% path)
2. **`Post to feed only`** — base action, hidden when `canSelfPublish: false`
3. **`Send to reviewers`** with inline checkbox `Also post to feed` (default unchecked when `reviewMode = either_with_default_review_first`, default checked when `review_after_publish`)
4. **`Save as draft`** — base action
5. **`Discard`** — small, separate, requires confirm sheet, recoverable for 10s via undo snackbar

Pattern A was picked because:

- Every action is one tap (no two-step "pick + confirm" friction)
- No hidden options — new authors see "Send to reviewers" exists and learn the workflow
- Visual hierarchy follows the 80/20 — big primary card, smaller secondaries, tiny destructive
- Inline `Also post to feed` checkbox handles the publish-AND-review combo without a 5th card

Rejected layouts:

- **Pattern B (radio + checkbox form):** forms read formal, two-clicks-to-publish, against Sharon-warmth.
- **Pattern C (primary + "More options ▾"):** new authors miss "Send to reviewers" exists. Discoverability tradeoff loses.

### 6. Three-tier review attribution

When a post is published via the review path (i.e. on the verdict, `Post.reviewedByUserId` is set), three coordinated UI surfaces render to attribute the review:

| Surface                      | Treatment                                                                                                                                                                        | Where                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Badge** (compact)          | Small ~18px **circle with the reviewer's avatar inside**, 1.5px ring `var(--colour-text-secondary) 50%` to distinguish from regular avatars; optional 6px ✓ overlay bottom-right | PostCard byline row (next to kind-chip / signal badge) |
| **Sub-byline** (detail)      | Same avatar circle ~22px + text "Reviewed by Sharon" (clickable to scroll to the auto-comment)                                                                                   | Post detail page byline                                |
| **Auto-comment** (narrative) | "Sharon helped review and shape this post" — pinned at top of comments thread, system-author styling. The reviewer's avatar IS the comment avatar — closing the loop             | Comments thread                                        |

Tap the badge anywhere → scrolls to the auto-comment. One conceptual link across all three surfaces.

The **avatar-not-icon** choice is deliberate. An abstract shield icon says "this was vetted"; the reviewer's face says "Sharon vouched for this." Warmer, more personal, matches Sharon-warmth; reinforces social trust by surfacing identity at a glance.

Rule: **the badge appears whenever `Post.reviewedByUserId IS NOT NULL`, regardless of PostKind.** State-driven, not kind-driven.

Implementation note: this is the first Phase-1 surface that needs avatar rendering. A small `<UserAvatar size={…} userId={…} />` component lands as a Phase-1 sub-deliverable, with initials fallback when `avatarUrl` is null. It will be reused everywhere avatars appear (comments, member lists, request claimants, etc.).

### 7. Reviewer permissions and audit story

When a reviewer claims a `kind_review` request:

- Reviewer can **edit every field** — title, body, link metadata, hero image, signal. Audit log captures every edit with `userId = reviewer`.
- Originator authorship is preserved — `Post.authorId` does not change. Bylines render the originator's name first.
- Reviewer is recorded in `Post.reviewedByUserId` and surfaced via the three-tier attribution above. The auto-comment on publish is non-deletable by the originator (UI-side rule); admin can delete.
- Reviewer verdict options: `publish`, `publish_with_kind_action` (publish + execute a kind-specific action — e.g. `share_to_gps_whatsapp`), `reject` (post stays `draft`, originator notified with reviewer's free-text reason — reviewer's edits are preserved), `keep_in_review` (rare — used when reviewer wants another reviewer's eyes; queue updates).
- If the originator withdraws while in review: soft-delete; reviewer queue updates and the `kind_review` request closes with `verdict: withdrawn`.
- Author visibility: own draft posts with open review render an "In review" pill in the drafts inbox (Phase 2). Notification on verdict via existing notification infrastructure.

### 8. Auto-save drafts

Three-stage gradient:

1. **Client-only first** (IndexedDB), debounced 500ms per keystroke. Zero server cost, instant feel, works offline.
2. **Server promote** when the user opens the publish modal, navigates away, or 60s of inactivity with content. Creates a `Post.status='draft'` row.
3. **Server-only autosave** thereafter — on blur + every 30s of edits, debounced.

Exposed admin tunables via `SystemSetting`:

| Key                                         | Default | Purpose                                                |
| ------------------------------------------- | ------- | ------------------------------------------------------ |
| `autosave_interval_seconds`                 | `30`    | Server-side autosave cadence after promote             |
| `autosave_promote_after_inactivity_seconds` | `60`    | When client-only state escalates to a server row       |
| `discard_undo_window_seconds`               | `10`    | How long the discard snackbar's "Undo" stays available |
| `review_published_creates_comment`          | `true`  | Auto-comment toggle (admin can disable per env)        |

Visible UI surface: a single calm "Saved · 2s" indicator in the form header, three states (`Editing…` / `Saved` / `Couldn't save · Retry`). Tap reveals tiny menu with "View all drafts" (Phase 2 link) and "Discard draft" (2-step with 10s undo). Honest copy throughout — never claim "Saved" until a save actually succeeded.

## Why this rule, not the alternatives

| Alternative                                                                           | Why rejected                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Keep bolting per-kind modals on**                                                   | Five kinds already want non-trivial publish-time actions (tick_or_cross, cultural, call_to_action, link_share, event). Five bespoke modals is five places to fix when the base UX shifts. The publish router is paid for after kind 3.                 |
| **Granular `RequestType` per kind**                                                   | Proliferates without buying anything reviewers' filters can't do. Priority field on `PostKind` handles the "some matter more" concern more cleanly than a typed-by-kind queue.                                                                         |
| **`Post.status` as a 4-value enum** (`draft / published / pending_review / archived`) | Combines "draft + reviewing" and "published + reviewing" into one value, losing a real distinction. And conflates discard/archive with status — soft-delete via `deletedAt` is the existing pattern.                                                   |
| **Action handlers stored in DB**                                                      | Handlers call server actions, dispatch URLs, render component children. They can't live as data. Slug list in DB + handler in code is the right split.                                                                                                 |
| **Static abstract icon** (shield, checkmark) for the review badge                     | Says "this was vetted" abstractly. Reviewer-avatar-circle says "Sharon vouched for this" — warmer, personal, matches design philosophy. The shield approach was an interim proposal; the avatar approach is the final design.                          |
| **Reuse `'vetting'` RequestType for post review**                                     | Vetting is a person seeking admission; kind-review is a post artefact. Different audiences, different scopes, different verdicts. Conflating them would muddy reviewer queue ergonomics and the existing `RequestType: 'vetting'` semantics.           |
| **Pre-publish modal that includes Discard**                                           | Adopted: the modal is pre-publish in the new design. The current D069 modal was post-publish (post saved before modal opened) which made "Cancel" mean "close, leave saved" — confusing. Pre-publish + Discard is honest and matches user expectation. |

## Consequences

- **One universal modal, every PostKind.** D069's `<SendToNetworkConfirm />` becomes a kind-specific action handler called from inside the universal modal. Same end behaviour for tick_or_cross authors; cleaner code path.
- **Drafts feature becomes real.** "Save as draft" stores rows that need a return-path. The drafts inbox (Phase 2 / `BU-drafts-inbox`) is now load-bearing.
- **Reviewer queue surface needed.** "Send to reviewers" creates `kind_review` requests that need a queue UI to act on. Phase 3 / `BU-reviewer-kind-review-queue`.
- **Avatar rendering arrives.** First place avatars surface on member-facing UI. The `<UserAvatar />` component will spread quickly to comments, member lists, etc.
- **Schema is contract-locked** — adds 4 columns to `PostKind`, 4 columns to `Post`, 1 enum value to `RequestType`, 1 nullable enum to `Comment`, 4 `SystemSetting` rows. All idempotent additive migrations per D070.
- **`scripts/seed.ts` PostKind upserts will need to set the new columns** with the table values above. Migration seeds the same values via idempotent INSERT/UPDATE so post-D070 environments don't drift.
- **`<SendToNetworkConfirm />` is deleted.** Its message-formatting + clipboard + confirm-back-from-WhatsApp logic moves into the `share_to_gps_whatsapp` handler.
- **Existing `Post.signal` and `Post.sharedToNetworkAt` columns stay** — they're tick_or_cross-specific data, orthogonal to the publish router.
- **Honest UX language throughout.** "Saved" only when actually saved; "Send to reviewers" not "Submit for moderation"; "Reviewed by Sharon" not "Approved by reviewer #3". Every member-facing string is plain English per CLAUDE.md.

## Phasing

The work splits into three independently shippable BUs. Phase 1 is the foundation; 2 and 3 deliver the surfaces 1 builds for.

| BU                                | Brief                                                        | Status  | What ships                                                                                                                                                                                                                                                                | Depends on        |
| --------------------------------- | ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **BU-publish-router**             | `docs/build/session-briefs/bu-publish-router.md`             | planned | Schema diff above + `<PostPublishModal>` + autosave + drafts-saved indicator + discard-with-undo + tick_or_cross routed through the new modal + `share_to_gps_whatsapp` registered as the first kind-specific action + `<UserAvatar />` + three-tier attribution surfaces | —                 |
| **BU-drafts-inbox**               | `docs/build/session-briefs/bu-drafts-inbox.md`               | planned | `/drafts` page (author's own drafts list with "In review" pills, "Continue editing", "Discard"); the saved-indicator's "View all drafts" link starts working                                                                                                              | BU-publish-router |
| **BU-reviewer-kind-review-queue** | `docs/build/session-briefs/bu-reviewer-kind-review-queue.md` | planned | Reviewer-side queue UI showing pending `kind_review` requests, priority-ordered; click-through opens the post in the existing compose form (reviewer-mode); verdict actions (Publish / Publish + kind-action / Reject with reason / Edit and keep in review)              | BU-publish-router |

Phase 1 is the lift. Phases 2 and 3 are smaller, build on the same primitives.

## Related

- D013 — Self-dispatch is the default (publish router preserves; "Send to reviewers" is opt-in)
- D017 — Boost/Remove as verdict on Post (kind-review verdicts are the long-form generalisation)
- D041 — Group identity badges on bylines (the same calm-pill aesthetic the review badge follows)
- D044 — Intent-first post creation / FAB cards model (composer's entry side; this BU is the exit side)
- D050 — Reactions (the existing pill aesthetic)
- D058 — Urgent flag on Post (orthogonal to status; preserved)
- D062 — PostKind as managed table (the table this ADR extends)
- D068 — Brief lifecycle status (the discipline this ADR's three briefs follow)
- D069 — `tick_or_cross` PostKind + post-publish handoff (the design this ADR generalises and supersedes)
- D070 — Reference data ships in migrations (the seed values for the new columns ride this rule)
- BU-tick-or-cross — the originating BU whose UX prompted the generalisation
- BU-vetting — the existing RequestType this BU explicitly does not conflate with

---

# D073 — Structured event-time fields on `Post` (`event_at`, `event_ends_at`, `location_text`)

**Date:** 2026-04-30
**Status:** Accepted
**ADR:** [`docs/adrs/0001-post-event-time-fields.md`](../adrs/0001-post-event-time-fields.md)
**Trigger:** bu-event-time brief — meeting / event / happening_now posts had no structured place for date, end-time, or venue. Buried in body text → unsortable, un-queryable, ugly. Bu-calendar-view (next BU) needs structured time data to render an agenda. This BU lays the schema groundwork and ships the composer / PostCard / edit-page surfaces that consume it.

## Decision

Add three nullable columns to `Post`:

- `eventAt` (`DateTime?`) — start of event, UTC
- `eventEndsAt` (`DateTime?`) — end of event, UTC. Server + client validation: ≥ `eventAt` when both set
- `locationText` (`String?`) — free-text venue, ≤ 500 chars

Plus a B-tree index on `eventAt` for the upcoming-events query path.

Source-of-truth helper `kindIsTimeBearing(slug)` lands in `shared/post-kinds.ts`. v1 mapping: `meeting`, `event`, `happening_now` → true; everything else → false. Composer / PostCard / bu-calendar-view all consume the same flag — flipping a kind on or off is a one-line change.

Timezone convention: store UTC, render `Europe/London` at the UI boundary via `date-fns-tz` (added as a dep). Never construct local times via raw `new Date()` arithmetic.

`event_at` is **optional for all kinds**. UI nudges (shows pickers for time-bearing kinds), server does not block submission when absent. Backwards-compatible: every existing post gets `eventAt = NULL` after the migration with no backfill required.

## Why this rule, not the alternatives

| Alternative                                             | Why rejected                                                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Sidecar `PostEvent` table.**                          | Premature. Single set of fields, no recurring/tickets in scope. Adds a join + nullable include to every list path.                     |
| **Server-enforced `event_at` for time-bearing kinds.**  | UI nudge is sufficient + flexible. A speaker who hasn't fixed a date yet can still post a draft event.                                 |
| **Per-PostKind column (`eventStart` only on `event`).** | Same data, three kinds — duplicating the column triples the schema for no analytical benefit.                                          |
| **Local-timezone storage.**                             | DST edge cases (1:30am clock-change weekends) silently corrupt timestamps. UTC + render-time conversion is the established pattern.    |
| **Partial index `WHERE event_at IS NOT NULL`.**         | Prisma `@@index` syntax can't round-trip partial indexes today. Plain B-tree is fine at MVP scale; promote later when the table grows. |

## Consequences

- **bu-calendar-view unblocked.** `findMany({ where: { eventAt: { gte: today00LDN } }, orderBy: { eventAt: 'asc' } })` is the agenda query.
- **Composer renders real date+time pickers** for `event` / `meeting` / `happening_now`, replacing the "date and time fields are coming" hint banner.
- **PostCard renders absolute time prominently** — "Sat 3 May · 6pm" above the relative `createdAt`.
- **Edit page is new** — `/post/[id]/edit` did not exist before. Lands as a full edit surface (title, body, visibility, link, hero, event fields). Permission matrix: own post (any role); coordinator within region; director all.
- **`date-fns-tz` is a new dep.** Used only in `shared/format-event-time.ts` plus the date-picker form components. No leak into services.
- **Phase-2 migration is forward-only and additive.** Three nullable columns + one index. Reversible if needed via a follow-up migration.
- **`calendar_enabled` feature flag registered** in `docs/product/feature-flag-register.md` for bu-calendar-view to consume — NOT gating this BU's surfaces.

## Related

- D013 — Self-dispatch (calendar is a read-only routing surface)
- D017 — Add-to-calendar action (parking-lot, not in scope)
- D062 — PostKind as managed table (extended with `kindIsTimeBearing`)
- D064 — Hero image (the precedent for "optional, member-picked, additive column")
- D070 — Reference data in migrations (no new PostKind rows here, only column adds)
- ADR-0001 — `docs/adrs/0001-post-event-time-fields.md` (the long form)
- BU-event-time — this BU's brief
- BU-calendar-view — the downstream consumer

---

# D074 — Per-kind feed comment-peek toggle on PostKind

**Status:** decided · 2026-04-30

## Context

Feed cards in `BU-feed-card-affordances` gain a "comment peek" row beneath
the body — author + 1-2 lines of the most-recent non-system comment, or
"Be the first to respond →" when no comments exist. The peek doubles as
the nav affordance to `/post/<id>#comments`.

Some kinds shouldn't have a peek. `cultural` posts (Shabbat, remembrance)
are quieter by design — surfacing chatter beneath them clashes with the
calm-marker tone (D041, design-philosophy.md). `tick_or_cross` is a
"network ask" whose discussion belongs on the detail page; surfacing one
comment in the feed risks fragmenting the response.

The toggle has to be data-driven, not hardcoded in the View. Admins (D043)
manage `PostKind` via the existing CRUD surface, and "Should this kind
show a peek?" is a content decision that belongs alongside the other
per-kind config (`reviewMode`, `canSelfPublish`, `reviewPriority`).

## Decision

Add a single column to `PostKind`:

```
feedCommentPeekEnabled BOOLEAN NOT NULL DEFAULT true
```

Default `true` because most kinds benefit from showing discussion. One
seeded kind gets `false`:

| Slug       | Peek? | Why                                                 |
| ---------- | ----- | --------------------------------------------------- |
| `cultural` | false | Quiet markers; no engagement metrics on the surface |

Every other seeded kind (`happening_now`, `link_share`, `call_to_action`,
`outcome`, `thought`, `event`, `meeting`, `undecided`, `tick_or_cross`)
gets `true`.

Note: `tick_or_cross` was originally seeded `false` on the assumption
that network-ask discussion belonged on the detail page; flipped to
`true` shortly after on the user's UX call, since the most-recent reply
is useful in the feed for these posts too. See migration
`20260430113000_enable_comment_peek_for_tick_or_cross`.

The migration is idempotent (`ADD COLUMN IF NOT EXISTS` + `UPDATE` per
slug) per D070. No backfill data risk — the column is non-null with a
default; existing rows pick up `true` automatically.

## Consequences

- **Feed query joins on `PostKind`** (or projects this column when posts
  are selected with their kind). Performance neutral — `PostKind` is
  small (~12 rows) and already loaded for the existing `kindSlug` /
  `kindDisplayName` projection.
- **`PostCard` reads `post.feedCommentPeekEnabled`** (passed through the
  existing `FeedPost` shape). When false, the peek row is suppressed
  entirely. When true, the peek row renders (with empty-state copy when
  there are no comments).
- **Admin CRUD picks the column up automatically** via the generic
  PostKind admin path; no admin UI change required, the boolean appears
  as a checkbox.
- **The `Read post →` link goes away** when the peek row ships. With the
  peek tappable (Link to detail#comments) and the title already a Link,
  a third nav affordance is redundant.

## Alternatives considered

- **Hardcode the kind list in `PostCard`.** Tighter coupling between View
  and content rules; admins couldn't change the list without a code
  change. Rejected.
- **Feature flag (`ff_feed_comment_peek`) with a kind-allowlist.** Two
  layers of indirection for a permanent decision; not what feature flags
  are for (D036). Rejected.
- **Render the peek for every kind, just hide for cultural / tick_or_cross
  via design-philosophy enforcement.** Same hardcode, different file.
  Rejected.

## Related

- D041 — Calm marker aesthetic (cultural posts are visually quieter)
- D050 — Reactions (similar "engagement on feed cards" question)
- D052 — Comments primitive
- D062 — PostKind as managed table (the table this ADR extends)
- D070 — Reference data ships in migrations (the seed defaults ride this rule)

---

# D075 — Activist Mailer flag on Post + AM feed filter

**Status:** decided · 2026-04-30

## Context

Activist Mailer URLs were detected at _render time_ in `LinkPreviewCard`
via host-match against `ACTIVIST_MAILER_ALLOWED_DOMAINS` (D060,
BU-am-link-collapse). That worked for the visual treatment ("Send
email →" button on the link card) but had three limits:

1. **No filter.** Filtering the feed by AM URLs would mean a SQL
   `LIKE` against `linkUrl` per allowed domain — slow and untyped.
2. **No author override.** A member who pastes their own org's mailer
   URL (not on the allow-list) couldn't get the AM treatment; a member
   pasting a generic-looking URL that _is_ an AM action couldn't
   manually flag it as such.
3. **Retroactive reclassification.** Changing `am-domain.ts`'s
   allow-list reclassified all historical posts — undesirable for
   provenance.

## Decision

Add a persisted boolean flag to `Post`:

```
isActivistMailer  Boolean  @default(false)
```

Plus a single composite index `(isActivistMailer, createdAt DESC)` for
the feed filter.

The form auto-sets the flag at submit time when `linkUrl` matches
`ACTIVIST_MAILER_ALLOWED_DOMAINS` (using the existing
`isActivistMailerDomain` helper). The author can manually toggle the
checkbox either way; once they touch it, the auto-detect is sticky on
their explicit choice — URL changes don't override it.

The `LinkPreviewCard`'s `isAmAction` prop now reads `post.isActivistMailer`
on the feed card path. The host-match fallback inside the card stays
for use sites that don't have a stored flag (e.g. the live preview
inside the compose form).

A new feed filter `activist_mailer` slots in the chip strip:

```
All · ⚡ Urgent · AM · ✅❌ · Now · Meetings · Events
```

The chip carries the Activist Mailer logo (saved at
`/public/brands/activist-mailer.webp`) ahead of the text label;
active palette is `gps-chip--primary` (green) to match the
"Send email →" CTA colour.

## Consequences

- New column on `Post`. Migration is idempotent (`ADD COLUMN IF NOT
EXISTS DEFAULT false`) and backfills via SQL regex matching the
  canonical `activistmailer.com` domain plus the dev / test
  `activist-mailer.example.com` domain plus a fallback
  `activistMailerUrl IS NOT NULL` rule for legacy seed posts that
  used the deprecated dedicated field. All idempotent per D070.
- Single index supports the filter; query is a one-liner equality
  check against the boolean column.
- Form submit sends `isActivistMailer=true` as a hidden form field
  when checked. The compose action reads it and passes it to the
  service; the schema accepts it as an optional boolean.
- Read path: feed query projects the column into `PostListItem`;
  `PostCard` reads it onto its `FeedPost` interface; `LinkPreviewCard`
  receives it as `isAmAction`.

## Alternatives considered

- **Detect at query time** with a SQL LIKE per allowed domain: slow,
  not indexable, retroactive reclassification on allow-list change.
  Rejected.
- **Store the URL match decision in a join table** (one row per AM
  domain × post): flexible but overkill for what's a single boolean
  classifier. Rejected.

## Related

- D060 — Link share preview card (the ancestor of "AM as link with a
  domain match"; D075 elevates the match to a flag)
- D062 — `PostKind` as managed table (similar approach: kind is data
  on the post, not derived at render)
- D070 — Reference data ships in migrations (the AM-domain backfill
  rides this rule)
- BU-am-link-collapse — removed the dedicated `activistMailerUrl`
  field in favour of host-match on `linkUrl`. D075 is the next step:
  persist the classification on the post.

# D076 — Post location coordinates + online flag (`latitude`, `longitude`, `isOnline`)

**Status:** decided · 2026-05-01

## Context

bu-calendar-near-me adds a third tab to `/calendar` that orders
event-bearing posts by distance from the caller's location. To do
that we need real coordinates on each in-person event plus a way to
mark online events so they're excluded from distance views. The
existing `locationText` (D073 / ADR-0001) is free-text and not
queryable for distance.

The composer does not yet geocode user-typed locations — Path B (the
geocoding pipeline) is parked as a follow-up BU. This decision
lands the schema columns the demo path uses today (Path A: hand-coded
coords on the eight event-bearing seed posts).

## Decision

Add three columns to `Post`:

```
latitude   Float?
longitude  Float?
isOnline   Boolean  @default(false)
```

Plus a composite index `(latitude, longitude)`.

Storage convention: WGS84 decimal degrees in Float columns. Distance
is computed app-side via Haversine in `shared/geo.ts`; no PostGIS
dependency at MVP scale.

The Near-me query filters on `isOnline: false AND latitude IS NOT NULL`
and orders by Haversine distance once the user supplies their own
coordinates (geolocation API or postcodes.io postcode lookup).

## Consequences

- Three additive columns on `Post`. Forward-only migration with no
  backfill required (defaults handle every existing row).
- Path A ships immediately: seed-data update covers the eight
  event-bearing posts.
- Path B (composer geocoding) inherits the column shape when it lands;
  no schema churn needed.
- `shared/geo.ts` exposes `haversineKm` + `geocodeUkPostcode` (the
  postcode lookup is a client-side fetch and is not exposed through
  any server-side boundary).

## Alternatives considered

- Sidecar `PostLocation` table — premature for two columns of the
  same shape that already neighbour `locationText`.
- Single PostGIS `point` column — limited Prisma support; Haversine
  in TS is six lines and works without a DB extension.

## Related

- ADR-0002 — full reasoning + field shape table.
- D041 — Region as optional tag only (lat/lng is member-level, not
  server-bounded; same spirit).
- D073 / ADR-0001 — Structured event-time fields (the precedent for
  this additive-column pattern).
- D070 — Reference data in migrations (no new reference rows here,
  only column adds).
- bu-calendar-near-me brief — the implementation contract.

# D077 — Post-share counter table (`PostShare`) for verified per-post share counts

**Status:** decided · 2026-05-01

## Context

The existing share-out flow logs a `post_shared_out` analytics event
to stdout via `POST /api/analytics/share-intent` (D067 / BU-whatsapp-
share). There is no persistence: counts can't be displayed, the
"you've shared this" personal indicator can't be computed, and admins
can't audit reach for any post.

The product brief **bu-post-share-counter** wants a verified counter
that ticks only when the member confirms "I sent it" — the existing
`PostPublishModal` "Did you send?" pattern, lifted into a reusable
`<ShareConfirmDialog />` and wired to every share button. Counts are
aggregates of _people_ who confirmed a send, broken down by
destination channel.

Eight design decisions were resolved during spec assembly (idempotency,
privacy, enum strictness, headline number, skip handling, logged-out
gating, abuse limits, display threshold). They are the decision
section of the brief and shape this ADR's schema.

## Decision

Add a sidecar `PostShare` table keyed by the composite
`(postId, userId, destination)`, plus a strict `ShareDestination`
enum that mirrors the existing `post_shared_out` analytics property.
Schema and field-shape table live in **ADR-0003**.

The headline number is verified-only
(`COUNT WHERE confirmedAt IS NOT NULL`); the intent total is
exposed inside the breakdown tooltip for transparency. `userId` is
stored raw — aggregate-only public exposure; the personal "you've
shared on X" surface is gated to `currentUser.id === viewer.id`.

The endpoint `POST /api/analytics/share-intent` is upgraded from a
stdout stub to a DB write via a new service
`server/services/post-share.ts`. Re-tapping within 30s is a noop
(soft service-layer rate limit); re-tapping after 30s upserts the
existing row. The unique constraint guarantees correctness either
way.

## Consequences

- One additive forward-only migration (new enum, new table, three
  indexes). No backfill — counts start empty on migration day.
- `listPosts` and `listUpcoming` projections gain
  `shareCounts: { total, perChannel }` via a single GROUP BY join —
  no N+1.
- `Post` and `User` schemas are unchanged. Cascade-on-delete from
  both parents.
- The build splits into four sequential, individually shippable
  phases (foundation, verified-send, counter UI, polish).
- Rollback path is clean: drop the table and enum; no parent schema
  is touched.

## Alternatives considered

- JSON column on `Post` — rejected (atomic increment problems, not
  queryable per-user, enum drift invisible).
- Reuse `Notification` — rejected (push-out semantics ≠
  read-aggregation semantics; cascade rules are backwards).
- Hashed `userId` — rejected (loses the personal indicator UX value;
  recovers raw `userId` semantics with extra steps once the server
  shares its hashing secret).

## Related

- ADR-0003 — full schema, field-shape table, options matrix.
- D016 — Self-dispatch via copy-and-deeplink (the share-out mechanic
  this counter measures).
- D047 — Honest tracking only (no inflated reach numbers). The
  verified-vs-intent split is this principle made literal.
- D067 — WhatsApp share analytics stub (the endpoint this ADR
  upgrades from stdout to DB write).
- D076 / ADR-0002 — Post location coords (sister additive-table
  precedent in the same release window).
- bu-post-share-counter brief — the implementation contract (4
  phases).
- bu-whatsapp-share — the BU that shipped the analytics stub this
  decision replaces.

# D078 — App-wide member search: 9 design decisions for `bu-search-surface`

**Status:** decided · 2026-05-01 (decisions 1–8) · 2026-05-02 (decision 9)

## Context

The product brief **bu-search-surface** wants a magnifier in the
sticky `AppNav` that opens a full-screen `/search` overlay,
returning grouped results (Posts · People · Regions ·
Partner orgs) for a free-text query, with an URL-addressable full-
results page for forwards. Research at
`docs/product/research/search-surfaces.md` defends the design.

Eight design decisions were resolved during brief assembly on
2026-05-01; a ninth (partner orgs deferral) was added on 2026-05-02
during ADR/D-promotion. They shape both the brief's build list and
ADR-0004 (the schema-touching subset). This entry captures them
canonically so commits and PRs can cite individual decisions as
`D078 §N`.

## Decision

The nine sub-decisions, in brief-table order:

| §   | Decision                                                                                                                                                                                                              | Notes                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Backend = native Postgres.** No third-party (Algolia, Meilisearch, etc.). Mechanism is `pg_trgm` + GIN — see ADR-0004.                                                                                              | Forecloses vendor sync pipelines.                                                                                                  |
| 2   | **Comment search excluded from v1.** Privacy review required before indexing non-vetted member text.                                                                                                                  | Park for a later BU.                                                                                                               |
| 3   | **All regions, no default narrowing.** Search is app-wide; no auto "in your regions" scope.                                                                                                                           | Matches feed default.                                                                                                              |
| 4   | **Per-entity ranking: Posts → People → Regions → Partner orgs.** Fixed group order in the response shape.                                                                                                             | Posts dominate query intent.                                                                                                       |
| 5   | **Permissioned visibility: reuse `listPosts` visibility filter.** Members-only posts must not surface to logged-out viewers. Server-enforced.                                                                         | Single shared visibility predicate between `listPosts` and `search.query`.                                                         |
| 6   | **Index strategy = `pg_trgm` + GIN from day one.** Indexes on `Post.title`, `Post.body`, `User.displayName`, `Region.displayName`; partner-orgs deferred (§9). Similarity threshold 0.3 default, tuneable from pilot. | Picks typo tolerance up-front. ADR-0004.                                                                                           |
| 7   | **Scope chip inherits filter only in v1.** No "in this thread" / per-post scope (would require comment search per §2).                                                                                                | Revisit when comment search ships.                                                                                                 |
| 8   | **Recently-viewed source = `localStorage` (last 5 posts).** Surfaces only inside the search overlay's zero-query empty state.                                                                                         | No `/history` route, no profile section in v1.                                                                                     |
| 9   | **Partner orgs entity deferred to §3.30 BU.** The Partner orgs result group renders empty/hidden until partner-orgs ships as an entity.                                                                               | Decision added 2026-05-02 — search v1 ships without partner-orgs as a result entity; group label and trigram index gated on §3.30. |

## Consequences

- **Schema:** ADR-0004 governs the `pg_trgm` extension + GIN index
  set. Migration is forward-only and additive.
- **Service interface:** `server/routers/search.ts` exposes
  `search.query({ q, scope?, filter?, type?, cursor? })` returning
  the 4-group shape (Posts · People · Regions · Partner orgs;
  Partner orgs returned empty until §9 lifts).
- **Visibility:** §5 forces a single shared predicate. Code review
  must reject any search query that bypasses `listPosts`'s
  visibility WHERE clause.
- **Pre-build prerequisites cleared:** §9 captures the only open
  cross-BU dependency. The brief is unblocked for a build session.
- **Cite-ability:** Future PRs and commits can refer to e.g.
  `D078 §5` (visibility) or `D078 §6` (`pg_trgm`) as a stable
  reference.

## Related

- ADR-0004 — `pg_trgm` extension + GIN indexes (the schema-touching
  subset of §6).
- bu-search-surface brief — the implementation contract.
- D018 — inbound sharing endpoint (URL-addressable shape that the
  full-results page aligns with).
- D061 — global tap pattern (constrains overlay back-button
  behaviour).
- §3.30 partner orgs (referenced in §9; not yet a numbered ADR/D).
- `docs/product/research/search-surfaces.md` — design rationale.
- SCN-31 — Sharon searches for Hendon (companion scenario).

# D079 — Typed `Request.title` + `Request.body` (closes ADR-0013)

**Status:** decided · 2026-05-05

## Context

Surface 1 of bu-coordination-board (PR #4d) reads each kanban
card's display title from `request.context.title` — an untyped
JSON-blob key — with a `'(Untitled)'` runtime fallback. The
choice was a punt; the handoff
(`bu-coordination-board-2026-05-04c.md`) flagged "title field
convention is unresolved" as the gating question for Surface 2.

Surface 2 (ticket detail) needs an editable, audit-logged title
and an editable, audit-logged description. Audit-logging a
JSON-blob mutation is awkward (nested-key diffs, silent typo
drift); typed columns make the edit a plain `UPDATE`.

The brief (bu-coordination-board v0.4) implicitly assumed
typed fields (it references `Request.body` directly in the
Surface 2 layout) but did not list them in the consolidated
schema-additions block.

## Decision

- Add `Request.title: String` (NOT NULL, default
  `'(Untitled)'`) and `Request.body: String?` to the schema.
- Forward-only migration back-fills both from
  `context->>'title'` and `context->>'body'` respectively, then
  applies the NOT NULL + default to `title`. Idempotent via
  `COALESCE`.
- `server/services/board.ts · listBoardCardsForGroup` swaps
  from `context.title` to `request.title` in the same PR; the
  runtime `'(Untitled)'` fallback is dropped (DB-level sentinel
  default covers it).
- `server/services/board.ts · getTicketDetail` (new in this PR)
  returns `title` and `body` typed.
- `context.title` / `context.body` are deprecated as
  authoritative keys but not stripped from existing rows. A
  later cleanup migration may strip them.

ADR-0013 carries the full reasoning and migration SQL.

## Consequences

- **Schema:** ADR-0013 governs the typed columns + back-fill.
  Migration is forward-only and additive. Sentinel default keeps
  the NOT NULL constraint safe for any rows that slipped past
  the back-fill.
- **Surface 2 unblocked.** PR #5a (read query + stub page) can
  ship using the typed shape; PRs #5b–5e (action pair, editable
  description, comment thread, share-with-team) all assume
  typed `title` / `body` going forward.
- **Surface 1 read updated in same PR.** Avoids a transient state
  where the typed columns exist but the kanban card still reads
  the JSON blob.
- **Composer not yet updated.** No code path in this PR creates
  kanban tickets; the migration's back-fill is enough. Later
  composer BUs write directly to the typed columns.

## Related

- ADR-0013 — the executing ADR.
- ADR-0005 / ADR-0012 — `RequestStatus` shape (independent).
- ADR-0010 / ADR-0011 — earlier `Request` reshape (nullable
  type, drop claim trio).
- D070 — idempotent migration discipline.
- bu-coordination-board v0.4 — Surface 2 needs the typed fields.
- Handoff `bu-coordination-board-2026-05-04c.md` — flagged the
  punt this D resolves.

# D080 — Hydration-safe deferred-render pattern (`<ClientOnly>` + `<RelativeTime>`)

**Status:** decided · 2026-05-07

## Context

Two SSR/CSR mismatches were surfaced testing the dev server from a
phone over mDNS (`http://mba.local:3001`). Both are deterministic —
they reproduce wherever the server-rendered first byte differs from
the first client-rendered byte, not just on phones:

1. **`<WhatsAppShareButton>` `href`.** The component called
   `getSiteOrigin()` synchronously at render time. Server-side
   `getSiteOrigin()` returns `process.env.NEXT_PUBLIC_SITE_ORIGIN`
   or the dev fallback (`http://localhost:3001`). Client-side it
   returns `window.location.origin`. When the env var is unset (or
   wrong for the host the user actually reached), the two strings
   diverge → React throws a hydration mismatch and the share
   button's full URL is the wrong host.

2. **Relative timestamps ("2m ago").** `formatDistanceToNow(...)`
   reads `Date.now()` every time it runs. The server runs it at
   request time; the client runs it again at hydration time.
   Across a bucket boundary (e.g. a post crosses the
   1-min → 2-min boundary between SSR and hydration), the two
   strings diverge → hydration warning. The timestamp also still
   says the wrong thing for a frame.

`suppressHydrationWarning` was applied to several call sites as a
short-term silencer. It hides the React warning but the underlying
mismatch is unchanged: members still see a flash of the wrong
value on first paint, and a misconfigured production env var would
still ship an incorrect first-paint URL.

## Decision

- Introduce `components/ClientOnly.tsx` — a tiny `useEffect`-gated
  wrapper. Renders a stable `fallback` on the server and on first
  client paint; renders `children` after mount. ~20 lines, no deps.
- Introduce `components/RelativeTime.tsx` — wraps `<ClientOnly>`.
  Renders `<time dateTime={iso}>{absoluteFallback}</time>` server-
  side; switches to `formatDistanceToNow(date, { addSuffix: true })`
  inside the same `<time>` after mount. The `dateTime` attribute
  carries the canonical ISO on every branch.
- Modify `<WhatsAppShareButton>` to two-phase the `href`: the
  initial render uses `originUrl=''` (yielding a relative
  `/post/<id>` deep link inside the `wa.me` text), then a `useEffect`
  populates `getSiteOrigin()` and re-renders with the fully-qualified
  URL. Chosen over an `aria-disabled` shell because (a) the share
  affordance is visible immediately, (b) the `wa.me/?text=...` URL
  builder accepts an empty origin gracefully (verified — see
  `shared/share/whatsapp-url.ts`), and (c) one fewer flicker frame.
- Replace inline `formatDistanceToNow` at the six known hydrating
  call sites (PostCard, CommentItem, RequestRow, RequestDetailPanel,
  post detail page, request detail page) with `<RelativeTime>`.
  Remove the `suppressHydrationWarning` props that were applied as
  silencers.
- New code rendering "X ago" or any value derived from `window.*` /
  `Date.now()` must use `<RelativeTime>` / `<ClientOnly>` rather
  than inline computation.

## Why not `suppressHydrationWarning`?

| Concern                                  | `suppressHydrationWarning` | Deferred render |
| ---------------------------------------- | -------------------------- | --------------- |
| Silences the React console warning       | Yes                        | Not needed      |
| Renders the correct value on first frame | No                         | Yes             |
| Matches server byte-for-byte initially   | No                         | Yes             |
| Survives a misconfigured env var         | No                         | Yes             |
| Preserves screen-reader semantics        | Mixed                      | Yes (`<time>`)  |

The fix is _structural_, not a silencer.

## Why not `dynamic({ ssr: false })`?

It works but it pays a heavier cost: an extra JS chunk per use,
loader/Suspense boundary, awkward inline use. `<ClientOnly>` is
~20 lines, no chunk, drops in inline. Reach for `dynamic` only when
the deferred subtree is heavy enough that pulling it out of the SSR
bundle is its own win.

## Consequences

- **Two new primitives in `components/`.** Both have READMEs.
  `<ClientOnly>` is the building block; `<RelativeTime>` is the
  first consumer. Future hydration fixes (e.g. the
  `<SendToNetworkConfirm>` modal in BU-tick-or-cross — clipboard +
  channel-open flow) reuse `<ClientOnly>`.
- **`NEXT_PUBLIC_SITE_ORIGIN` is now belt-and-braces.** A misconfig
  on Vercel no longer produces a hydration error; the fallback URL
  is a relative path on the first frame, the full URL is correct
  after mount. The env var is still recommended for correctness on
  the very first frame (the relative path works in `wa.me/?text=...`
  but the WhatsApp link preview parser prefers a fully-qualified
  URL). Defence in depth.
- **No `suppressHydrationWarning` left in the six migrated call
  sites.** Other call sites outside this BU's scope were left as-is
  to avoid scope creep.
- **iOS standalone is supported.** `useEffect` fires after hydration
  regardless of standalone vs browser context. Confirmed against
  the constraint captured in
  `project_ios_standalone_constraint`.
- **One `formatDistanceToNow` site in `<PostCard>` (top-comment
  byline) is intentionally outside this BU's scope.** It's also a
  hydrating site and should migrate; that's the open question the
  BU's PR records for follow-up.

## Related

- BU-hydration-fixes / brief
  `docs/build/session-briefs/bu-hydration-fixes.md`
- BU-whatsapp-share / D067 — the share machinery this hardens (no
  contract change to the analytics ping).
- D065 — header refresh button (also addresses the iOS-standalone
  context that surfaced this bug).
- Memory `project_ios_standalone_constraint` — phone-as-dev-target
  context for why this surfaced.
- BU-tick-or-cross — will reuse `<ClientOnly>` for the
  `<SendToNetworkConfirm>` modal's clipboard + channel-open flow.
