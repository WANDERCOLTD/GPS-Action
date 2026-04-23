# GPS Action — Decision Log

*Every significant decision made in designing GPS Action. Captures what was decided, why, and when. Helps future-us remember why things are the way they are.*

*Version: 0.1 · April 2026*

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

| Concern | Tool | Why |
|---|---|---|
| Errors + performance traces | **Sentry** | Next.js integration in minutes; free tier covers MVP; the best tool for "what broke in this user's session" |
| Product analytics + funnels + cohorts | **PostHog** | Event model in `docs/product/analytics-events.md`; self-hostable later if costs rise; strong free tier |
| Structured logs + uptime monitoring + alerts | **Better Stack (Logtail + Uptime)** | Cheap; searchable; alerting via multiple channels |

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
spec_sections: ["3.15", "3.15.2", "3.22"]
build_units: [BU-012]
related_scenarios: [SCN-05, SCN-12]
---
```

**2. Build Units are the canonical linked-list node.** Each `docs/build/units/BU-NNN.md`
file begins with:

```yaml
---
id: BU-012
name: Flagging pipeline
status: proposed | ready | in_progress | done | blocked
scenarios: [SCN-04, SCN-05, SCN-12]
spec_sections: ["3.15", "3.15.2", "3.22"]
adrs: [D019]
erd_entities: [Flag, Post, User]
trpc_procedures: [flagPost, listFlags, resolveFlag]
ui_components: [FlagButton, FlagReasonModal, FlagQueueScreen]
events: [post_flagged, flag_resolved]
feature_flags: [ff_flagging_v2]
depends_on: [BU-001, BU-003]
blocks: []
estimated_sessions: 3
---
```

**3. Every code file declares its Build Unit.** Top of file:

```typescript
/**
 * @build-unit BU-012
 * @scenarios SCN-04, SCN-05
 * @spec §3.15
 */
```

Enforced by ESLint custom rule (`require-build-unit-header`). New files without
the header fail CI.

**4. ADRs reference the features they constrain.** Already partial — formalise:

```markdown
**Affects:** §3.15.2, BU-012
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
