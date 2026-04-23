# GPS Action — Parking Lot

*Ideas, observations, and requirements that came up but haven't yet landed in the spec.*

*Version: 0.1 · April 2026*

---

## How this document works

Every time an idea comes up mid-stream, it lands here rather than interrupting the build. Entries get one of these statuses:

- **PARKED** — interesting, not evaluated yet. Default state for new ideas.
- **ABSORBING** — being actively folded into the current version of the spec.
- **DEFERRED** — evaluated, will be built in a later phase.
- **DECLINED** — evaluated, not going to build. Reason recorded.
- **ABSORBED** — built into the spec. Kept here for history.

Review cadence: at every version boundary (v0.6, v0.7...), walk the PARKED list, re-evaluate. Some rise, some fall, some survive another round of deferral.

**The discipline:** no idea vanishes. Every idea is either in the spec or in this document. This prevents "we talked about that months ago and lost it."

---

## Mid-pilot experience ideas

### PARKED · In-app onboarding tour for new members
A first-use tour showing the member around the Feed, Network area, composer, etc. Lightweight, skippable, tracks completion. Different tour for different roles (coordinator onboarding is longer).

*Origin: implied by §3.16 Stage 2 activation but not spec'd as a distinct feature.*

### PARKED · Member-initiated feedback channel
A dedicated in-app way for members to submit feedback, bug reports, feature requests. Routes to a pilot feedback queue.

*Origin: operational need flagged during ratchet discussion.*

### PARKED · Quarterly "How are you finding it?" ping
System asks members a single lightweight question periodically ("How's GPS Action working for you this month?"). Surveys temperature without heavy instrumentation.

*Origin: pilot metrics discussion.*

### PARKED · Offline-first behaviour
Post composition works without network; queues and sends when reconnected. Feed caches for offline reading. Currently unspecified — MVP may be "online only with clear error states."

*Origin: operational gap flagged in audit discussion.*

---

## Engagement & motivation ideas

### PARKED · Contribution streaks / badges
Gentle gamification: "You've taken action 5 weeks running." Visible only to the member themselves, not leaderboarded. Motivation without competition.

*Origin: "how do we keep members engaged" line of thought.*

### PARKED · Coordinator thank-you flow
When a coordinator flips a post to Verified or approves an Outcome, an optional "thank you" message goes to the author. Builds warmth.

*Origin: the Sharon-warmth discussions.*

### PARKED · "Your impact this month" digest
End-of-month lightweight summary to each member: actions taken, posts engaged with, reach contributed to. Emotional reinforcement, not metrics for metrics' sake.

*Origin: activation and retention thinking.*

---

## Admin & moderation ideas

### PARKED · Bulk moderation actions
Coordinators can select multiple flagged items and action them together. Useful for spam waves or repeat-offender cleanup.

*Origin: efficiency concern raised during admin tools discussion.*

### PARKED · Escalation templates
Pre-written messages for common coordinator→member situations. "Your post was edited because..." "Your application is on hold because..." Saves rewriting.

*Origin: operational polish.*

### PARKED · Coordinator handover flow
When a coordinator rotates off or takes a break, a handover process transfers their region's active queues, DMs-in-progress, pinned posts to the new coordinator.

*Origin: operational continuity.*

### PARKED · Post "needs review" lifecycle stage
Between published and verified, a post can be in "needs coordinator review" — author flagged it themselves, or system detected something worth looking at before wide amplification.

*Origin: content quality concerns during edit-permissions discussion.*

---

## Content / publishing ideas

### PARKED · Post templates / starting points
Common post shapes (BDS motion alert, op-ed response, etc.) as templates the composer can clone. Accelerates repetitive content.

*Origin: efficiency thinking for writers.*

### PARKED · Draft saving (explicit)
Beyond the autosave that's assumed, explicit "save as draft" with a drafts inbox the author can come back to.

*Origin: implied but not spec'd clearly.*

### PARKED · Scheduled publishing
Author composes now, schedules for later (morning, before a council meeting, etc.). Especially useful for cyclical content and Shabbat posts.

*Origin: time-sensitive content patterns.*

### PARKED · Multi-language support
UK has substantial non-English-first-language communities. English-first for MVP, but the architecture should not lock this out.

*Origin: inclusivity/reach consideration.*

### PARKED · Content warnings / sensitivity flags
Some posts (graphic incidents, traumatic content) should warn viewers. Author-applied, coordinator-adjustable. Expandable content behind a tap.

*Origin: accessibility and trauma-informed design.*

---

## Identity & affiliation ideas

### ABSORBING · Partner Organisations & affiliations
*(Agreed direction — v0.6)*
User can be affiliated with other campaigning organisations. Posts can be co-branded. Admin-managed partner list. See §3.30.
Affects enrolment — form may ask about existing affiliations.

*Origin: Sky News screenshot, April 2026.*

### PARKED · Profile visibility controls
Members choose what's visible on their profile to other members (full name vs first name + last initial, regions, affiliations). Privacy posture.

*Origin: privacy considerations for high-trust network.*

### PARKED · Anonymous or pseudonymous posting modes
For VOA incident reports specifically — victim may not want their name attached to the incident in the feed. Admin-visible, member-anonymous.

*Origin: sensitivity of incident content.*

### PARKED · Off-network identity verification
How do we handle a member who changes their legal name, marries, changes career? Profile change flow that doesn't break the vouch ledger.

*Origin: long-term data model consideration.*

---

## Dispatch & amplification ideas

### PARKED · Smart deduplication
System detects when the same content (same URL, similar title) is being posted twice within a window. Prompts: "Similar content was posted 2 hours ago by Sharon — boost that one instead?"

*Origin: self-dispatch model implied risk.*

### PARKED · Dispatcher-view version of routes
For users on a team who dispatch frequently, a "dispatch mode" that surfaces the queue as their primary view. Different from the default member experience.

*Origin: operational need for power-users.*

### PARKED · Cross-platform amplification beyond WhatsApp
Similar flow for Telegram, Signal, X/Twitter. Routes registry extensible, but each platform has different mechanics.

*Origin: long-term reach thinking.*

### PARKED · Partner-specific amplification pathways
A post attributed to Action on Antisemitism might route to their networks too (if they're GPS Action users or if we integrate).

*Origin: partner-organisation feature absorbed this week.*

---

## Resources & reference material

### PARKED · Useful Links repository (member-contributed, admin-curated)
A living collection of external links members find useful — campaign sites, research reports, tools, guides, organisations worth knowing about. Currently happens informally in WhatsApp ("I'll add it to our repository of useful info"). Formalise as a feature.

**Proposed shape:**
- Members submit a link with context (why it's useful, where it applies)
- Lands in a submission queue for admin review
- Admin approves with tags (topic, region, type) and it appears in the Resources area
- Members can search / filter / browse
- Each entry: URL, title, description, submitter, date added, tags, thumbnail
- Extensions of the existing Network → Resources section (§3.24)

**Distinct from:**
- *Content Library* (GPS's own produced assets — toolkits, graphics) — internally authored
- *Partner Organisations* (formal partner records) — about relationships, not links
- *Contacts directory* (phone/email for outreach) — for *contacting* people, not reading
- *Routes* (WhatsApp destinations) — for dispatch, not reference

**Naming question:** "Useful Links" is functional but bland. Sharon's word "repository" is heavy. Options: "Resources," "Useful Links," "Library," "Know This." Worth deciding when we absorb.

**Interaction with other features:**
- A post might reference a Resource (link preview + "learn more")
- Submissions might trigger a notification to the submitter when approved
- Admin review fits the existing content moderation queue pattern

*Origin: WhatsApp screenshot, April 2026 — Sharon saying "I'll add it to our repository of useful info" after Candice shared standwithus.com link.*

---

## Analytics & learning ideas

### PARKED · Post-mortem on campaigns
After a campaign closes, a structured "what worked, what didn't" capture. Coordinator-facilitated, member-contributed.

*Origin: organisational learning.*

### PARKED · Pattern analysis across campaigns
Which types of posts get highest engagement? Which regions are most active? Which action types convert best? Director-level dashboard.

*Origin: optimisation thinking.*

### PARKED · Adversary tracking
The original SRS mentioned monitoring Adversary Organisations of Concern. Not yet in GPS Action spec — we scoped out intel gathering for pilot.

*Origin: original SRS §4.3.*

---

## Technical / infrastructure deferrals

### DEFERRED (Phase 2) · WhatsApp Business API for Channel routes
Routes that are Channels (not groups) can automate. Needs Business verification, cost planning.

*Origin: §3.13 spec.*

### DEFERRED (Phase 2) · Native mobile apps
PWA for MVP. Native iOS/Android for Phase 2 once pattern stabilises.

*Origin: stack choice discussion.*

### DEFERRED (Phase 2) · Voucher revocation
A member wants to revoke a past vouch ("I stood for them, but concerns have arisen"). Creates director review, doesn't auto-suspend.

*Origin: vouching discussion.*

### DEFERRED (Phase 2) · Vouching velocity alerts
System notices a voucher is standing for many people in short windows. Not blocking, just flagged for director attention.

*Origin: vouching discussion.*

### DEFERRED (Phase 2) · Full event sourcing architecture
Immutable event log as primary data model. Interesting for audit and replay; overkill for MVP.

*Origin: parallel-build architecture discussion.*

---

## Integrations deferred

### DEFERRED · ActivistMailer integration (beyond export)
Direct API integration for mass campaign sends. Phase 2.

### DEFERRED · Change.org / 38 Degrees petition integration
Currently spec allows external-platform petitions but without API integration.

### DEFERRED · Email intake (forward an email, it becomes a post)
Useful for members on low-signal phones. Phase 2 or 3.

### DEFERRED · Slack / Discord integration for coordinator comms
Some coordinators might prefer Slack-style ops. Parallel to WhatsApp, not replacing.

---

## Declined (with reasons)

### DECLINED · Member-to-member direct messages
*Reason: confirmed excluded by design. The @mention + comment model replaces this. Direct-messaging at scale opens moderation surface we can't handle well. Admin DMs (coordinator → member) remain, but member → member is out.*

### DECLINED · Scrolling news ticker at top of screen
*Reason: accessibility issues (scrolling motion), attention erosion (always-on-urgency). Replaced with static Status Banner (§3.26).*

### DECLINED · Auto-posting to WhatsApp groups via unofficial APIs
*Reason: against WhatsApp ToS, ban risk. Self-dispatch default + Business API for Channels (Phase 2) is the path.*

### DECLINED · Dispatcher rotation as complex scheduling system
*Reason: self-dispatch default made rotation unnecessary. Keep it simple — "who's on the team" is a list, not a schedule.*

---

## Ambiguity parking — things to decide later

### OPEN · Exact action types list
Proposed 12, awaiting Jeremy's sign-off. Fix when confirmed.

### OPEN · Founding members list
Needs to be defined by Jeremy before launch. Bootstrap requirement.

### OPEN · Initial Routes registry population
Who maps every current WhatsApp destination into Routes before pilot day 1? Operational task.

### OPEN · Default cap/expiry values in composer
Pre-fill sensible defaults, or leave blank? Editorial judgment.

### OPEN · Report action sub-type split
Single type with sub-field (incident / info / external content) or separate types? Editorial call.

### OPEN · Group chat parallel to feed
WhatsApp fills this for pilot. Build native chat in Phase 2? Worth revisiting after pilot feedback.

### OPEN · Native apps vs web for MVP
Trade-off: native gives push + share sheet; web is faster to iterate. Needs call before build.

### OPEN · Cloud hosting choice
AWS eu-west-2 my lean. Others possible.

### OPEN · Monolith vs microservices
Modular monolith my lean. Needs confirmation.

### OPEN · AI provider choice
Affects cost, latency, data processing agreements. Needs evaluation.

---

## How to add to this

When an idea hits you:

1. **Right now:** jot it under the right section with status PARKED and a one-line origin note
2. **At the next version boundary:** review all PARKED items, upgrade some to ABSORBING
3. **Never:** delete an idea, even if declining — record the reason so it's not re-argued

The parking lot grows. That's fine. It's a record of thinking, not a backlog to clear.
