# GPS Action — Parking Lot

*Ideas, observations, and requirements that came up but haven't yet landed in the spec.*

*Version: 0.2 · April 2026*

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

### ABSORBING · Post deduplication & co-surfacing
*(Agreed direction — v0.6, will become §3.31)*

When two members independently try to post the same URL within a configurable window (default 24 hours), the second attempt is merged into the first as a comment, framed warmly ("Abby saw this too and wants to share"). The canonical post stays singular — Sharon's post is still Sharon's post. Abby's voice is preserved as a comment on that post with her original draft accessible through a collapsed disclosure.

**Key design choices:**
- URL match after normalisation (shorteners resolved, tracking params stripped)
- Soft-suggest with auto-merge as default (Variant A — 1-click to proceed)
- No region differentiation — dedup is URL+time only; region is a viewing filter
- Admin-configurable time window, default 24h
- Specific notification to original author ("X saw this too and added their thoughts") — signals independent discovery, not generic comment noise
- Any interaction with the interstitial marks the canonical post as **read** for the interacting user
- Dispatch indicator visible on the interstitial — prevents double-dispatch

**What this solves:**
- Feed clutter (no duplicate posts)
- Unread-anxiety (the second sharer doesn't see the canonical as unread)
- Attribution (Abby's voice preserved, not silenced)
- Double-dispatch (Abby sees Sharon already sent to WhatsApp groups)

**Full spec:** `docs/product/dedup-and-cosurfacing.md`
**Build Unit:** BU-009 (to be catalogued after ERD)
**Analytics:** three new events — `post_merge_suggested`, `post_merge_accepted`, `post_merge_declined`
**Copy keys:** seven new keys added to copy library (dedup.interstitial.*, dedup.comment.*, dedup.notification.specific)

*Origin: self-dispatch model implied risk + Paul's late-April clarification on how attribution should work. Design landed in chat on 23 April 2026.*

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

## Inbound sharing — share INTO GPS Action

### ABSORBING · Inbound sharing (PWA-first, native later)
*(Agreed direction — v0.6, will become §3.32)*

The paths content comes *into* GPS Action from the outside world. Member sees something on X, Instagram, a news site — gets it into GPS Action as a draft post.

**Path A locked in:** PWA-first for MVP. Three inbound paths ship from day one:

1. **Android Web Share Target API** — installed Android PWAs show up in the native share sheet, same quality as native apps
2. **Clipboard detection on iOS + desktop** — composer detects a URL on the clipboard and offers one-tap acceptance. Works around Apple's refusal to allow PWAs as share targets
3. **`/share?url=` endpoint + desktop bookmarklet** — works on any browser, useful for power users and as the foundation all other paths post to

**Native iOS/Android share extensions are Tier B (B11)** on the engineering roadmap — triggered only if pilot data shows weak sharing rates or ≥25% of members request native share sheet.

**What this unlocks:**
- The WhatsApp-replacement loop ("I saw it on X → post it to GPS Action") becomes real
- Members on Android get native-quality share sheet integration immediately
- iOS members get a 3-tap path (copy → open app → accept clipboard) — not ideal but reliable
- The `/share` endpoint means Phase 2 native apps plug into existing backend with no rebuild

**Full spec:** `docs/product/inbound-sharing.md`
**Build Unit:** BU-010 (to be catalogued after ERD)
**Engineering roadmap item:** B11 (native iOS for share extension)
**Analytics:** three new events — `share_intent_started`, `share_intent_completed`, `share_intent_abandoned`; plus `inbound_source` property added to `post_published`
**Copy keys:** ten new keys added to copy library (share.clipboard.*, share.bookmarklet.*, share.android.*, share.endpoint.*)

*Origin: D018 first noted the inbound-share endpoint as a concept; Paul's 23 April 2026 question about "use the phone share feature to post from social app TO OUR app" surfaced the platform constraint analysis and the Path A decision.*

---

## Presence & multi-user awareness ideas

### PARKED · Live presence indicators (stacked avatars showing who's currently viewing)

Beyond the claim avatar (which shows who's *claimed* a work item), live
presence shows who's *currently viewing* a page — work-item detail page,
admin entity page, queue list. Stacked avatars at the top of the page
("Sharon, Grant viewing now"), updated via background heartbeat polling
every 15 seconds.

**What this would add beyond the claim avatar:**
- Awareness of coordinators looking at the same item without claiming
- "Wait — Sharon's already looking at this" hint on the queue list
- Genuine sense of a shared workspace

**What it requires:**
- A `viewing_sessions` table (user_id, entity_type, entity_id, last_seen_at)
- A heartbeat endpoint per page that shows presence
- Background polling (every 15 seconds) on every relevant page
- Stacked-avatar UI component
- Cleanup sweep for stale sessions

**Why deferred:** the claim avatar (in scope for MVP, see
claim-and-lease.md) gives 80% of the social-awareness value at a fraction
of the infrastructure cost. Coordinators see who's *working* on what; they
don't necessarily need to see who's *looking*.

**Trigger:** A coordinator complains, more than once, that they did
duplicated work because they didn't know someone else was already on the
same item (despite the claim avatar being visible). Backstop: re-evaluate
if coordinator team grows past 10 people.

**When triggered:**
- Build `viewing_sessions` table + heartbeat endpoint
- Add stacked-avatar component
- Wire into work-item detail pages, queue list, admin entity pages
- Honest copy: "viewing now" not "currently active"
- Privacy posture: members never see admin presence

*Origin: discussed in chat 23 April 2026. Pattern B (unified work_items
queue) chosen for MVP; presence deferred until claim avatar proven
insufficient.*

---

## Region & location — deferred from MVP (per D041/D042)

### PARKED · Member region filtering

Members opt into one or more preferred regions; their default feed hides
posts tagged outside those regions (untagged/national posts always show).
Currently MVP shows everyone everything regardless of region.

**Trigger:** members complain about feed volume, OR coordinators request
that their community see more focused local content, OR pilot grows past
~200 members and the feed becomes noisy.

**When triggered:**
- Add `user_region_preferences` join table (or extend `UserRegion`)
- Add "preferred regions" to profile settings
- Update feed query to apply `WHERE region_tag IN (user_preferred_regions) OR region_tag IS NULL`
- Keep national/untagged posts always visible

*Origin: D041, 23 April 2026. Deferred to preserve solidarity across
regions at pilot scale.*

### PARKED · Location services (phone location for proximity features)

Phone location used to compute "near me" feeds, event proximity, etc.
Not collected in MVP (no postcode, no lat/lng, no permission requests).

**Trigger:** members request "what's near me" feature, OR events become a
first-class feature and proximity matters for attendance decisions.

**When triggered:**
- Add `home_postcode`, `home_lat`, `home_lng`, `default_radius_miles` to
  User
- Add onboarding step for location permission (honest opt-in pattern)
- Add PostGIS extension to Postgres for distance queries
- Add `location_lat/lng` to Event entity (or extend Post)
- Add "near me" filter option to feed
- Privacy considerations documented in security-baseline.md

*Origin: D041 considered and deferred, 23 April 2026.*

### PARKED · Coordinator profile verification

Admins verify that claimed external groups are real before the
coordinator's profile counts in analytics or displays a verified badge.
Currently self-claim with no verification.

**Trigger:** amplification-reach analytics feature is being built AND
data reliability matters for decision-making, OR a member is found to
have falsely claimed groups.

**When triggered:**
- Add `verified_at`, `verified_by_user_id` to `coordinator_group` (or
  profile)
- Add admin verification queue (new work-item type or existing admin UI)
- Verified-only filter on reach analytics queries
- Badge display in UI for verified groups

*Origin: D042 + M3a, 23 April 2026. MVP uses self-claim (M3a) for
minimal friction; verification added when analytics use-cases emerge.*

### PARKED · Self-nomination for queue_manager role

Members apply to become queue managers via a form; the application
enters a vetting-style queue for admin decision. Currently
admin-initiation only.

**Trigger:** volunteer demand exceeds admin ability to identify and
invite queue managers, OR pilot feedback shows members want to
self-offer.

**When triggered:**
- Add new work-item type: `queue_manager_application`
- Add "volunteer to help moderate" form in profile settings
- Admin approval flow identical to other work-item types
- Grant on approval creates a `role_grant` with provenance

*Origin: D042 + M2, 23 April 2026. Admin-only initiation keeps the
cohort trusted at MVP scale.*

### PARKED · Two-admin approval for role grants

High-sensitivity role grants (especially admin role) require a second
admin's approval before taking effect. Currently single-admin grant.

**Trigger:** admin team grows past ~5 people, OR a contested grant
causes internal discussion, OR compliance/governance requirements
emerge.

**When triggered:**
- Add pending-approval state to `role_grants` table
- Second-admin approval UI
- Notification flow for pending approvals
- Timeout behaviour (approval expires if not seconded within N days?)

*Origin: D042 + M1, 23 April 2026. Single-admin grant with audit
accountability is proportionate to MVP admin team size.*

### PARKED · Amplification reach analytics

Dashboard showing total reach across coordinators for given posts. "This
post was shared by 12 coordinators covering ~8,000 people in external
channels." Enables Jeremy to see the movement's multiplier effect.

**Trigger:** coordinator cohort reaches ~20 members AND reach estimates
are seeded, OR Jeremy asks for this view, OR a post needs
"amplification value" scoring for prioritisation.

**When triggered:**
- Sum reach estimates across active coordinators
- Show per-post "amplification potential" if shared by all coordinators
- Show actual amplification activity (requires share tracking —
  dependency on external share integrations)
- May need coordinator verification (deferred above) for data
  reliability

*Origin: D042 + M6, 23 April 2026. The coordinator_group.reach_estimate
field "points the way" per M6.*

---

## Deep linking, sharing, images, composer — deferred from MVP (per D043-D047)

### PARKED · Generated og:image cards (Tier 2)

Branded GPS Action share cards generated for every public post via
@vercel/og or equivalent. Replaces Tier 1 (which uses pulled-through
og:image from the linked URL).

**Trigger:** MVP day 1 ships with Tier 1; Tier 2 lands in Phase 1.5
once og:image generation infrastructure is built. No external trigger
needed — it's planned.

*Origin: D045 + D046, 23 April 2026.*

### PARKED · Member-uploaded post hero images

Members upload their own image as a post's hero (rather than only
URL-derived or placeholder). Requires content moderation pipeline.

**Trigger:** Members request it AND content moderation API is
integrated, OR Phase 2 is reached.

*Origin: D046, 23 April 2026.*

### PARKED · Curated image bank with member-pickable browse

Library of ~30 admin-curated images members can pick from when
composing. Phase 1.5 launch alongside groups.

**Trigger:** Phase 1.5 — paired with Groups feature for visual
identity work.

*Origin: D046, 23 April 2026.*

### PARKED · Image bank submission queue

Members submit images to the bank; admin review approves with metadata.
New work-item type `image_bank_submission`.

**Trigger:** Phase 2 — once member uploads exist (depends on previous
parked item).

*Origin: D046, 23 April 2026.*

### PARKED · Content moderation API integration

Auto-detection of graphic / inappropriate images on upload and on
og:image scrape. Third-party API (AWS Rekognition / Sightengine /
Google Vision).

**Trigger:** Member uploads enabled OR a sensitive-content incident
prompts proactive detection.

*Origin: D046, 23 April 2026.*

### PARKED · "Show preview images" member setting

Toggle in member settings to disable preview images on the feed.
For members concerned about graphic content from linked articles.

**Trigger:** Member requests OR sensitive-content incident.

*Origin: D046, 23 April 2026.*

### PARKED · Member self-reporting of platform stats

Member manually enters "my X tweet got 4,200 impressions" from their
X analytics. Adds real reach data to the Reach Scoreboard.

**Trigger:** Members ask for richer reach data; willingness to do
manual entry confirmed.

*Origin: D047, 23 April 2026.*

### PARKED · Member-authorised API integrations for platform stats

OAuth-flow where Sharon authorises GPS Action to pull her X/Facebook
analytics. Real numbers without manual entry.

**Trigger:** Self-reporting (above) shows demand AND engineering
capacity available; significant privacy implications.

*Origin: D047, 23 April 2026.*

### PARKED · UTM tagging on outbound URLs

When sharing to X/etc., the linked URL gets `?utm_source=gpsaction&...`
appended. BBC's analytics can see GPS Action drove traffic. We don't
get the data but help broader signal.

**Trigger:** A specific request from a partner (e.g., a news outlet
asks "where's our traffic coming from?") OR an analytics-led decision
to enable.

*Origin: D047, 23 April 2026.*

### PARKED · Instagram Stories share (via generated story card)

Share to Instagram Stories by generating a 1080x1920 image card with
post text, GPS Action branding. Member opens Story, drops the image,
adds link sticker manually.

**Trigger:** Phase 1.5 — depends on og:image generation infrastructure
being built.

*Origin: share-out-mechanics.md, 23 April 2026.*

### PARKED · LinkedIn / Telegram / WhatsApp Channels (Business API)

Additional outbound platforms beyond MVP's WhatsApp/X/Facebook/Email/
Copy-link.

**Trigger:** Members request a specific platform AND that platform has
a usable share intent.

*Origin: share-out-mechanics.md, 23 April 2026.*

### PARKED · Native group chat / group-private feeds

Groups within GPS Action gaining their own feeds, members-only chat
threads, group-specific notifications.

**Trigger:** Pilot reveals strong demand for group-private spaces AND
the unified-feed approach (D041) is reconsidered.

*Origin: D043, 23 April 2026. Currently DEFERRED in favour of
unified-feed principle.*

### PARKED · Hide-my-groups privacy setting

Member toggle to hide their group memberships from other members
(memberships still affect queue routing).

**Trigger:** A specific member raises a privacy concern OR a
sensitive group launches (e.g., support-related).

*Origin: D043, 23 April 2026.*

### PARKED · Custom domains for posts

Vanity URLs like sharon.gpsaction.org/post/abc instead of generic
gpsaction.org/p/abc.

**Trigger:** Strong member demand OR a coordinator group with their
own brand wants attribution.

*Origin: D045, 23 April 2026.*

### PARKED · QR codes for posts

Generate QR codes for post URLs for printed materials, signage,
in-person sharing.

**Trigger:** A member organises an in-person event needing QR codes
OR Phase 2 reached.

*Origin: D045, 23 April 2026.*

### PARKED · Embed codes for posts

"Embed this post on your blog" — generates an iframe-able snippet.

**Trigger:** A coordinator with a blog asks for it OR partner
organisations request embeddable content.

*Origin: D045, 23 April 2026.*

### PARKED · Composer enhancements (Phase 2+)

Edit-post flow, mention autocomplete, markdown/rich text, scheduled
posting, voice input, keyboard shortcuts. All Phase 2 polish on the
composer.

**Trigger:** Per-feature member demand or pilot feedback identifying
the specific friction.

*Origin: D044, 23 April 2026.*

### PARKED · Multimedia composer

Multiple images per post, video uploads, polls, quizzes.

**Trigger:** Phase 2 / 3 — depends on storage costs and moderation
infrastructure.

*Origin: D044, 23 April 2026.*

### PARKED · Post templates

Pre-shaped starter posts ("BDS motion alert template", "Op-ed response
template") that load into the composer.

**Trigger:** Several similar posts crafted manually; templates would
have saved time.

*Origin: D044 + earlier parking-lot entry, 23 April 2026.*

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
PWA for MVP. Native iOS/Android for Phase 2 once pattern stabilises. See engineering-roadmap B11 for the specific trigger for iOS share-sheet integration.

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
Trade-off: native gives push + share sheet; web is faster to iterate. Resolved for MVP: PWA-first (D003, inbound-sharing Path A). Native iOS has specific trigger on engineering roadmap B11.

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
