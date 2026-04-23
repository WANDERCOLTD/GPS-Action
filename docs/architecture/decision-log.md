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
