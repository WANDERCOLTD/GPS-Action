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

