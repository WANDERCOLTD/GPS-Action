# GPS Action — Change Absorption Guide

*Which parts of the system are built to stay stable, which are built to change, and what to do when change lands where you weren't expecting it.*

*Version: 0.1 · April 2026*

---

## The guiding idea

Software has two failure modes at opposite extremes.

**Over-rigid:** everything is hard to change. A new requirement means weeks of refactoring. Eventually the team stops proposing changes because they're too expensive; the product ossifies.

**Over-flexible:** everything is configurable. Simple changes require updating 15 abstractions. New developers take months to orient. The system becomes a meta-system that no one understands.

Good software lives in between. It's **stable where stability matters and soft where change is predictable**. This document names which bits are which for GPS Action.

---

## Three categories

Every part of the system falls into one of three categories:

### Category A · Hard (change is expensive; design right, first time)

These shape everything else. Changing them cascades widely and can corrupt historical data. Invest up-front effort to get them right. Accept that they'll be slow to change.

### Category B · Soft (change is predictable; build for it)

These will definitely change. Design extensibility into them from the start so routine change doesn't require code rewrites.

### Category C · Disposable (change will happen often; don't over-engineer)

These will be iterated on heavily. Build them simply, accept they'll be rebuilt. Don't abstract prematurely.

---

## Category A · Hard (stable foundations)

### The database schema

**Why hard:** every piece of code depends on it. Schema changes require migrations. Bad migrations corrupt data.

**How to keep it stable:**
- Start with the ERD right. Spend the time upfront.
- Every schema change requires an ADR and migration.
- Never store calculated values — compute on read.
- Prefer nullable fields over "magic" defaults.
- Name fields precisely — renames are expensive.

**What this means:** take your time on the ERD. Involve the team. Review it carefully. Accept that ERD changes in Week 5 of build are costly.

### Core entity relationships

**Why hard:** User ↔ Post ↔ Comment ↔ Reaction — if these relationships shift fundamentally, every query breaks.

**How to keep it stable:**
- Get the cardinality right first time (one-to-many, many-to-many)
- Think about foreign key constraints carefully
- Model soft-delete from the start, not retrofitted
- Model audit linkage from the start

### Authentication model

**Why hard:** who's a user, how they log in, what tokens look like. Changing this logs everyone out and breaks all sessions.

**How to keep it stable:**
- Decide on JWT vs session-cookies once. Stick with it.
- Token shape agreed and versioned.
- 2FA approach decided up front.
- Recovery flows designed before any user exists.

### Permission model

**Why hard:** every API endpoint, every UI component depends on "can this user do this?" Changing the permission model is a system-wide refactor.

**How to keep it stable:**
- Permission matrix as data, not code
- `checkPermission(user, action, scope)` as a single function
- Roles and permission flags defined comprehensively before any feature work
- Admin UI for managing permissions, not just role assignment

### Audit architecture

**Why hard:** every write touches audit. If audit is designed poorly, it's slow, incomplete, or corrupts data.

**How to keep it stable:**
- Audit as a shared service from day one
- Entries append-only, never edited
- Trace IDs flow through every request
- Structured format defined, versioned

### Security baseline

**Why hard:** encryption choices, password hashing parameters, TLS versions — changing these retrospectively is disruptive.

**How to keep it stable:**
- See Security Baseline document
- Make the hard calls upfront
- KMS + envelope encryption pattern established early

### API contract structure

**Why hard:** every client depends on API shapes. Breaking contracts breaks clients.

**How to keep it stable:**
- API contracts versioned
- Deprecated endpoints supported for transition periods
- Type generation from schema means contracts stay in sync
- Never silently change response shapes

---

## Category B · Soft (built for change)

### Action types catalogue

**Why soft:** new action types will emerge. "Attend a training," "donate to specific fund," "submit research."

**How to design for change:**
- Store as data (database table or config file), not as enum
- Each action type defines: label, icon, behaviour, target entity type
- New action types added via admin UI or config change, no code deploy
- UI renderer looks up behaviour from the catalogue

**What not to do:**
- Don't build a visual workflow editor "for flexibility"
- Don't support every possible action type before any exist
- Keep the catalogue tight; add types as real needs emerge

### Post types catalogue

**Why soft:** started with 5 (Action, Seeking, Outcome, Community, Coordination); might add (Announcement, Event, Story) over time.

**How to design for change:**
- Post types as configuration
- Each type defines: composer fields, card rendering, default routes, default visibility
- New types added without touching core post-handling logic

### Routes registry

**Already designed this way.** Admin table. Each route is a record. See §3.13 of Feature Spec.

### Partner organisations catalogue

**Already designed this way.** Admin-managed. Each partner is a record with logo, colour, verification status.

### Reactions palette

**Why soft:** 14 emoji now, might be 16 in a year. Seasonal rotations.

**How to design for change:**
- Reactions as configuration, not hardcoded
- Seasonal rotation via date-triggered config
- Admin UI to manage (later phase)

### Notification types

**Why soft:** new kinds of notifications ("member vouched for you," "your post was verified") emerge as features land.

**How to design for change:**
- Notification types as config: template, channel (in-app/email/push), default on/off per user
- Router handles dispatch; features just publish events
- Users can configure which types they receive

### Topic tags

**Why soft:** the topic taxonomy evolves with the world. "TikTok extremism" wasn't a topic 5 years ago.

**How to design for change:**
- Tags as data
- Admin curates (merges, renames, deprecates)
- Tag aliases (when renaming, old tag redirects to new)

### Copy & UI text

**Why soft:** every button label, every error message, every help text — all of these evolve.

**How to design for change:**
- Externalise into i18n files even if English-only
- Change copy without touching code
- Lays groundwork for future translations

### Feature flags

**Why soft:** the whole point.

**How to design for change:**
- Flag service that's queried via `flags.isEnabled(user, 'feature_name')`
- Per-user / per-group / per-percentage rollouts
- Admin UI to flip flags
- Expiry dates on flags; sweep quarterly

---

## Category C · Disposable (iterate freely)

### Individual UI screens

**Why disposable:** member pushback, pilot learnings, designer iteration — screens get rebuilt multiple times.

**How to keep it disposable:**
- Build from the design system, not custom CSS
- Keep component complexity low per screen
- Expect to redesign — don't invest heavy architecture in one screen

### Admin tools (initial versions)

**Why disposable:** admin needs will evolve quickly as you learn how you actually moderate.

**How to keep it disposable:**
- Build functional, not beautiful, early
- Tables, forms, buttons. Not elaborate dashboards.
- Iterate based on actual usage patterns
- Polish only the tools coordinators use daily

### Empty states, loading states, error states

**Why disposable:** polish evolves with content and tone.

**How to keep it disposable:**
- Use the design system
- Keep copy simple
- Expect to rewrite after pilot feedback

### Onboarding flows

**Why disposable:** the welcome tour, the first-use nudges — these improve iteratively.

**How to keep it disposable:**
- Build minimal onboarding for MVP
- Don't gate features behind elaborate tutorials
- Improve based on drop-off data from pilot

### Analytics dashboards

**Why disposable:** you don't know what you'll want to measure until you're measuring.

**How to keep it disposable:**
- Emit structured events from day one (hard)
- Build the dashboards lazy and iteratively (soft)
- First dashboard is ugly. Final one is beautiful. Don't conflate.

---

## When change lands: decision tree

You have a new idea. What do you do?

### Step 1 · Which category does this affect?

- **Category A (Hard)** → ADR required. Review carefully. May take weeks. Change blocks everything that depends on it.
- **Category B (Soft)** → Expected. Update the catalogue/config. No code deploy needed for data changes; normal session for code changes.
- **Category C (Disposable)** → Easy. Schedule a small session. Iterate.

### Step 2 · Is this in scope for current phase?

- **Yes and small** → land in current version
- **Yes and large** → probably defer to next phase; parking lot
- **No** → parking lot

### Step 3 · If land, how?

- Session brief for the change
- If Category A: the brief includes migration, affected sessions re-briefed, downstream impact
- If Category B: the brief touches the catalogue + renderer update + tests
- If Category C: brief covers the affected screens

### Step 4 · If defer, what?

- Parking lot entry with status PARKED
- Next phase review considers

### Step 5 · If decline, why?

- Parking lot entry with status DECLINED and reason
- Ensures it doesn't re-emerge as a surprise later

---

## Anti-patterns to watch for

### Over-abstracting Category A

"Let's build a rule engine for permissions so we never have to change code again." No. Permission matrix as data, yes. But don't build a DSL that only one person understands.

### Under-abstracting Category B

"We'll just hardcode the 12 action types for now." If you know change is coming (you do), building them as data is not premature. It's correct.

### Treating Category C as permanent

"This login screen is working; let's not touch it." Login screens iterate. Accept it.

### Letting Category A drift into Category C

The schema should not be treated as disposable. Even "small" schema changes cascade. Respect Category A boundaries.

### Optimising for flexibility you won't need

"What if we need to support blockchains later?" You probably won't. YAGNI. Build for actual requirements, not imagined ones.

---

## Specific things to build soft from day one

Priority list for change-absorption design:

1. **Action types catalogue** — data-driven, not hardcoded
2. **Post types catalogue** — data-driven
3. **Routes registry** — admin-managed (already planned)
4. **Permission matrix** — as data (already planned)
5. **Feature flags** — comprehensive from day one
6. **Notification router** — event-driven
7. **Copy / UI text** — externalised
8. **Partner organisations** — admin-managed (already planned)

These eight are force-multipliers. They let you absorb change that would otherwise cost days.

---

## Specific things to keep simple

Don't over-engineer these for MVP:

- **Search** — Postgres full-text is fine for pilot. Add Elasticsearch later if needed.
- **Real-time** — polling every 30s is fine for most screens. WebSockets can come later.
- **Caching** — Postgres will serve you for thousands of members. Add Redis when measured need arises.
- **Microservices** — a modular monolith scales well into thousands of users. Split services only when deployment boundaries genuinely conflict.
- **Complex analytics** — emit events, query ad-hoc, build dashboards later.

Premature scaling is premature optimisation. Build for Year 1, not Year 5.

---

## The honesty check

Every architectural decision comes with a question: "how confident am I this won't change?"

- **Very confident** → Category A, design for stability
- **Moderate** → Category B, design for change
- **Low** → Category C, build simply and expect to rebuild

When uncertain, lean towards B. Building soft costs slightly more now but saves hugely when change arrives.

When very uncertain about what the right shape is, build C. A crappy version you'll rebuild teaches you more than an elegant version you designed in the dark.

---

## Reviewing this guide

Every 3 months, reread this document. Ask:

- Are things in the right categories?
- What moved from C to B as it matured?
- What proved Category A actually needed change (and what did that cost)?
- What got abstracted into B that never needed it?

Adjust the guide based on experience. It's not meant to be prescriptive forever — it's a working framework.
