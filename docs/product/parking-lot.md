# GPS Action — Parking Lot

_Ideas, observations, and requirements that came up but haven't yet landed in the spec._

_Version: 0.2 · April 2026_

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

_Origin: implied by §3.16 Stage 2 activation but not spec'd as a distinct feature._

### PARKED · Member-initiated feedback channel

A dedicated in-app way for members to submit feedback, bug reports, feature requests. Routes to a pilot feedback queue.

_Origin: operational need flagged during ratchet discussion._

### PARKED · Quarterly "How are you finding it?" ping

System asks members a single lightweight question periodically ("How's GPS Action working for you this month?"). Surveys temperature without heavy instrumentation.

_Origin: pilot metrics discussion._

### PARKED · Offline-first behaviour

Post composition works without network; queues and sends when reconnected. Feed caches for offline reading. Currently unspecified — MVP may be "online only with clear error states."

_Origin: operational gap flagged in audit discussion._

---

## Engagement & motivation ideas

### PARKED · Contribution streaks / badges

Gentle gamification: "You've taken action 5 weeks running." Visible only to the member themselves, not leaderboarded. Motivation without competition.

_Origin: "how do we keep members engaged" line of thought._

### PARKED · Coordinator thank-you flow

When a coordinator flips a post to Verified or approves an Outcome, an optional "thank you" message goes to the author. Builds warmth.

_Origin: the Sharon-warmth discussions._

### PARKED · "Your impact this month" digest

End-of-month lightweight summary to each member: actions taken, posts engaged with, reach contributed to. Emotional reinforcement, not metrics for metrics' sake.

_Origin: activation and retention thinking._

---

## Admin & moderation ideas

### PARKED · Bulk moderation actions

Coordinators can select multiple flagged items and action them together. Useful for spam waves or repeat-offender cleanup.

_Origin: efficiency concern raised during admin tools discussion._

### PARKED · Escalation templates

Pre-written messages for common coordinator→member situations. "Your post was edited because..." "Your application is on hold because..." Saves rewriting.

_Origin: operational polish._

### PARKED · Coordinator handover flow

When a coordinator rotates off or takes a break, a handover process transfers their region's active queues, DMs-in-progress, pinned posts to the new coordinator.

_Origin: operational continuity._

### PARKED · Post "needs review" lifecycle stage

Between published and verified, a post can be in "needs coordinator review" — author flagged it themselves, or system detected something worth looking at before wide amplification.

_Origin: content quality concerns during edit-permissions discussion._

---

## Content / publishing ideas

### PARKED · Post templates / starting points

Common post shapes (BDS motion alert, op-ed response, etc.) as templates the composer can clone. Accelerates repetitive content.

_Origin: efficiency thinking for writers._

### PARKED · Draft saving (explicit)

Beyond the autosave that's assumed, explicit "save as draft" with a drafts inbox the author can come back to.

_Origin: implied but not spec'd clearly._

### PARKED · Scheduled publishing

Author composes now, schedules for later (morning, before a council meeting, etc.). Especially useful for cyclical content and Shabbat posts.

_Origin: time-sensitive content patterns._

### PARKED · Multi-language support

UK has substantial non-English-first-language communities. English-first for MVP, but the architecture should not lock this out.

_Origin: inclusivity/reach consideration._

### PARKED · Content warnings / sensitivity flags

Some posts (graphic incidents, traumatic content) should warn viewers. Author-applied, coordinator-adjustable. Expandable content behind a tap.

_Origin: accessibility and trauma-informed design._

---

## Identity & affiliation ideas

### ABSORBING · Partner Organisations & affiliations

_(Agreed direction — v0.6)_
User can be affiliated with other campaigning organisations. Posts can be co-branded. Admin-managed partner list. See §3.30.
Affects enrolment — form may ask about existing affiliations.

_Origin: Sky News screenshot, April 2026._

### PARKED · Profile visibility controls

Members choose what's visible on their profile to other members (full name vs first name + last initial, regions, affiliations). Privacy posture.

_Origin: privacy considerations for high-trust network._

### PARKED · Anonymous or pseudonymous posting modes

For VOA incident reports specifically — victim may not want their name attached to the incident in the feed. Admin-visible, member-anonymous.

_Origin: sensitivity of incident content._

### PARKED · Off-network identity verification

How do we handle a member who changes their legal name, marries, changes career? Profile change flow that doesn't break the vouch ledger.

_Origin: long-term data model consideration._

---

## Dispatch & amplification ideas

### ABSORBING · Post deduplication & co-surfacing

_(Agreed direction — v0.6, will become §3.31)_

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
**Build Unit:** BU-dedup (to be catalogued after ERD)
**Analytics:** three new events — `post_merge_suggested`, `post_merge_accepted`, `post_merge_declined`
**Copy keys:** seven new keys added to copy library (dedup.interstitial._, dedup.comment._, dedup.notification.specific)

_Origin: self-dispatch model implied risk + Paul's late-April clarification on how attribution should work. Design landed in chat on 23 April 2026._

### PARKED · Dispatcher-view version of routes

For users on a team who dispatch frequently, a "dispatch mode" that surfaces the queue as their primary view. Different from the default member experience.

_Origin: operational need for power-users._

### PARKED · Cross-platform amplification beyond WhatsApp

Similar flow for Telegram, Signal, X/Twitter. Routes registry extensible, but each platform has different mechanics.

_Origin: long-term reach thinking._

### PARKED · Partner-specific amplification pathways

A post attributed to Action on Antisemitism might route to their networks too (if they're GPS Action users or if we integrate).

_Origin: partner-organisation feature absorbed this week._

---

## Inbound sharing — share INTO GPS Action

### ABSORBING · Inbound sharing (PWA-first, native later)

_(Agreed direction — v0.6, will become §3.32)_

The paths content comes _into_ GPS Action from the outside world. Member sees something on X, Instagram, a news site — gets it into GPS Action as a draft post.

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
**Build Unit:** BU-inbound-share (to be catalogued after ERD)
**Engineering roadmap item:** B11 (native iOS for share extension)
**Analytics:** three new events — `share_intent_started`, `share_intent_completed`, `share_intent_abandoned`; plus `inbound_source` property added to `post_published`
**Copy keys:** ten new keys added to copy library (share.clipboard._, share.bookmarklet._, share.android._, share.endpoint._)

_Origin: D018 first noted the inbound-share endpoint as a concept; Paul's 23 April 2026 question about "use the phone share feature to post from social app TO OUR app" surfaced the platform constraint analysis and the Path A decision._

---

## Presence & multi-user awareness ideas

### PARKED · Live presence indicators (stacked avatars showing who's currently viewing)

Beyond the claim avatar (which shows who's _claimed_ a work item), live
presence shows who's _currently viewing_ a page — work-item detail page,
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
of the infrastructure cost. Coordinators see who's _working_ on what; they
don't necessarily need to see who's _looking_.

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

_Origin: discussed in chat 23 April 2026. Pattern B (unified work_items
queue) chosen for MVP; presence deferred until claim avatar proven
insufficient._

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

_Origin: D041, 23 April 2026. Deferred to preserve solidarity across
regions at pilot scale._

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

_Origin: D041 considered and deferred, 23 April 2026._

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

_Origin: D042 + M3a, 23 April 2026. MVP uses self-claim (M3a) for
minimal friction; verification added when analytics use-cases emerge._

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

_Origin: D042 + M2, 23 April 2026. Admin-only initiation keeps the
cohort trusted at MVP scale._

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

_Origin: D042 + M1, 23 April 2026. Single-admin grant with audit
accountability is proportionate to MVP admin team size._

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

_Origin: D042 + M6, 23 April 2026. The coordinator_group.reach_estimate
field "points the way" per M6._

---

## Deep linking, sharing, images, composer — deferred from MVP (per D043-D047)

### PARKED · Generated og:image cards (Tier 2)

Branded GPS Action share cards generated for every public post via
@vercel/og or equivalent. Replaces Tier 1 (which uses pulled-through
og:image from the linked URL).

**Trigger:** MVP day 1 ships with Tier 1; Tier 2 lands in Phase 1.5
once og:image generation infrastructure is built. No external trigger
needed — it's planned.

_Origin: D045 + D046, 23 April 2026._

### PARKED · Member-uploaded post hero images

Members upload their own image as a post's hero (rather than only
URL-derived or placeholder). Requires content moderation pipeline.

**Trigger:** Members request it AND content moderation API is
integrated, OR Phase 2 is reached.

_Origin: D046, 23 April 2026._

### PARKED · Curated image bank with member-pickable browse

Library of ~30 admin-curated images members can pick from when
composing. Phase 1.5 launch alongside groups.

**Trigger:** Phase 1.5 — paired with Groups feature for visual
identity work.

_Origin: D046, 23 April 2026._

### PARKED · Image bank submission queue

Members submit images to the bank; admin review approves with metadata.
New work-item type `image_bank_submission`.

**Trigger:** Phase 2 — once member uploads exist (depends on previous
parked item).

_Origin: D046, 23 April 2026._

### PARKED · Content moderation API integration

Auto-detection of graphic / inappropriate images on upload and on
og:image scrape. Third-party API (AWS Rekognition / Sightengine /
Google Vision).

**Trigger:** Member uploads enabled OR a sensitive-content incident
prompts proactive detection.

_Origin: D046, 23 April 2026._

### PARKED · "Show preview images" member setting

Toggle in member settings to disable preview images on the feed.
For members concerned about graphic content from linked articles.

**Trigger:** Member requests OR sensitive-content incident.

_Origin: D046, 23 April 2026._

### PARKED · Member self-reporting of platform stats

Member manually enters "my X tweet got 4,200 impressions" from their
X analytics. Adds real reach data to the Reach Scoreboard.

**Trigger:** Members ask for richer reach data; willingness to do
manual entry confirmed.

_Origin: D047, 23 April 2026._

### PARKED · Member-authorised API integrations for platform stats

OAuth-flow where Sharon authorises GPS Action to pull her X/Facebook
analytics. Real numbers without manual entry.

**Trigger:** Self-reporting (above) shows demand AND engineering
capacity available; significant privacy implications.

_Origin: D047, 23 April 2026._

### PARKED · UTM tagging on outbound URLs

When sharing to X/etc., the linked URL gets `?utm_source=gpsaction&...`
appended. BBC's analytics can see GPS Action drove traffic. We don't
get the data but help broader signal.

**Trigger:** A specific request from a partner (e.g., a news outlet
asks "where's our traffic coming from?") OR an analytics-led decision
to enable.

_Origin: D047, 23 April 2026._

### PARKED · Instagram Stories share (via generated story card)

Share to Instagram Stories by generating a 1080x1920 image card with
post text, GPS Action branding. Member opens Story, drops the image,
adds link sticker manually.

**Trigger:** Phase 1.5 — depends on og:image generation infrastructure
being built.

_Origin: share-out-mechanics.md, 23 April 2026._

### PARKED · LinkedIn / Telegram / WhatsApp Channels (Business API)

Additional outbound platforms beyond MVP's WhatsApp/X/Facebook/Email/
Copy-link.

**Trigger:** Members request a specific platform AND that platform has
a usable share intent.

_Origin: share-out-mechanics.md, 23 April 2026._

### PARKED · Native group chat / group-private feeds

Groups within GPS Action gaining their own feeds, members-only chat
threads, group-specific notifications.

**Trigger:** Pilot reveals strong demand for group-private spaces AND
the unified-feed approach (D041) is reconsidered.

_Origin: D043, 23 April 2026. Currently DEFERRED in favour of
unified-feed principle._

### PARKED · Hide-my-groups privacy setting

Member toggle to hide their group memberships from other members
(memberships still affect queue routing).

**Trigger:** A specific member raises a privacy concern OR a
sensitive group launches (e.g., support-related).

_Origin: D043, 23 April 2026._

### PARKED · Custom domains for posts

Vanity URLs like sharon.gpsaction.org/post/abc instead of generic
gpsaction.org/p/abc.

**Trigger:** Strong member demand OR a coordinator group with their
own brand wants attribution.

_Origin: D045, 23 April 2026._

### PARKED · QR codes for posts

Generate QR codes for post URLs for printed materials, signage,
in-person sharing.

**Trigger:** A member organises an in-person event needing QR codes
OR Phase 2 reached.

_Origin: D045, 23 April 2026._

### PARKED · Embed codes for posts

"Embed this post on your blog" — generates an iframe-able snippet.

**Trigger:** A coordinator with a blog asks for it OR partner
organisations request embeddable content.

_Origin: D045, 23 April 2026._

### PARKED · Composer enhancements (Phase 2+)

Edit-post flow, mention autocomplete, markdown/rich text, scheduled
posting, voice input, keyboard shortcuts. All Phase 2 polish on the
composer.

**Trigger:** Per-feature member demand or pilot feedback identifying
the specific friction.

_Origin: D044, 23 April 2026._

### PARKED · Multimedia composer

Multiple images per post, video uploads, polls, quizzes.

**Trigger:** Phase 2 / 3 — depends on storage costs and moderation
infrastructure.

_Origin: D044, 23 April 2026._

### PARKED · Post templates

Pre-shaped starter posts ("BDS motion alert template", "Op-ed response
template") that load into the composer.

**Trigger:** Several similar posts crafted manually; templates would
have saved time.

_Origin: D044 + earlier parking-lot entry, 23 April 2026._

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

- _Content Library_ (GPS's own produced assets — toolkits, graphics) — internally authored
- _Partner Organisations_ (formal partner records) — about relationships, not links
- _Contacts directory_ (phone/email for outreach) — for _contacting_ people, not reading
- _Routes_ (WhatsApp destinations) — for dispatch, not reference

**Naming question:** "Useful Links" is functional but bland. Sharon's word "repository" is heavy. Options: "Resources," "Useful Links," "Library," "Know This." Worth deciding when we absorb.

**Interaction with other features:**

- A post might reference a Resource (link preview + "learn more")
- Submissions might trigger a notification to the submitter when approved
- Admin review fits the existing content moderation queue pattern

_Origin: WhatsApp screenshot, April 2026 — Sharon saying "I'll add it to our repository of useful info" after Candice shared standwithus.com link._

---

## Analytics & learning ideas

### PARKED · Post-mortem on campaigns

After a campaign closes, a structured "what worked, what didn't" capture. Coordinator-facilitated, member-contributed.

_Origin: organisational learning._

### PARKED · Pattern analysis across campaigns

Which types of posts get highest engagement? Which regions are most active? Which action types convert best? Director-level dashboard.

_Origin: optimisation thinking._

### PARKED · Adversary tracking

The original SRS mentioned monitoring Adversary Organisations of Concern. Not yet in GPS Action spec — we scoped out intel gathering for pilot.

_Origin: original SRS §4.3._

---

## Technical / infrastructure deferrals

### DEFERRED (Phase 2) · WhatsApp Business API for Channel routes

Routes that are Channels (not groups) can automate. Needs Business verification, cost planning.

_Origin: §3.13 spec._

### DEFERRED (Phase 2) · Native mobile apps

PWA for MVP. Native iOS/Android for Phase 2 once pattern stabilises. See engineering-roadmap B11 for the specific trigger for iOS share-sheet integration.

_Origin: stack choice discussion._

### DEFERRED (Phase 2) · Voucher revocation

A member wants to revoke a past vouch ("I stood for them, but concerns have arisen"). Creates director review, doesn't auto-suspend.

_Origin: vouching discussion._

### DEFERRED (Phase 2) · Vouching velocity alerts

System notices a voucher is standing for many people in short windows. Not blocking, just flagged for director attention.

_Origin: vouching discussion._

### DEFERRED (Phase 2) · Full event sourcing architecture

Immutable event log as primary data model. Interesting for audit and replay; overkill for MVP.

_Origin: parallel-build architecture discussion._

### DEFERRED (post-demo) · returnTo redirect on dev login

Post-login redirect doesn't honour the `returnTo` query param yet. When an unauthenticated user hits `/compose`, they're redirected to `/dev/login?returnTo=/compose`, but after login they land at `/` → `/feed` instead of `/compose`. Minor friction — user clicks "New post" again. Fix by reading `returnTo` from the URL in the dev login action and redirecting there instead of `/`.

_Origin: BU-composer session, April 2026._

### PARKED · Demo mode on staging (whitelisted user picker)

When BU-auth lands and replaces the dev cookie stub with real magic-link auth, **quick demos on a staging URL become harder** — every viewer would need their own login. The dev stub at `/dev/login` is what makes "show this to a stakeholder in 2 minutes" possible today; it refuses in production by design (`NODE_ENV !== 'production'`), so it disappears the moment we deploy.

**The story to build into BU-auth's brief:** a `ff_demo_mode` feature flag on staging that re-enables a user picker for a whitelisted set of demo accounts. Off by default; toggled per-environment. Mirrors the dev stub's UX (tap a user, become them, no password) but with hard guardrails:

- Only flag-on environments (never production)
- Whitelisted account IDs only — not "any user"
- Audit log entry per impersonation
- Visible "DEMO MODE" banner to remove all ambiguity
- Auto-disable after a TTL if the flag's been on too long (catch forgotten flags)

**Why park, not build now:** BU-auth doesn't exist yet. The cost of forgetting this design when BU-auth's brief gets written is exactly the demo-friendliness regression we want to avoid. ~30 min of extra scope inside BU-auth's session, but only if the story is named here so the brief author sees it.

**Trigger:** when BU-auth's brief gets drafted, this story gets folded in as a scope item.

_Origin: BU-comments planning, 2026-04-26 — Paul flagged that "B kind of makes quick demos hard" when comparing the demo-polish path vs the pilot path._

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

_Reason: confirmed excluded by design. The @mention + comment model replaces this. Direct-messaging at scale opens moderation surface we can't handle well. Admin DMs (coordinator → member) remain, but member → member is out._

### DECLINED · Scrolling news ticker at top of screen

_Reason: accessibility issues (scrolling motion), attention erosion (always-on-urgency). Replaced with static Status Banner (§3.26)._

### DECLINED · Auto-posting to WhatsApp groups via unofficial APIs

_Reason: against WhatsApp ToS, ban risk. Self-dispatch default + Business API for Channels (Phase 2) is the path._

### DECLINED · Dispatcher rotation as complex scheduling system

_Reason: self-dispatch default made rotation unnecessary. Keep it simple — "who's on the team" is a list, not a schedule._

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

## PostType taxonomy + PostTone enum — revisit at composer design

**Status:** PARKED — revisit during composer design session (BU-composer)

**Summary:** Post has no `type` field in MVP. The demo only needs one
kind of post ("click this, send an email via Activist Mailer") so no
branching on type is needed. Beyond the demo, the composer design
session will decide the final taxonomy, informed by real scenarios
and the 10 orthogonal axes in ADR D048.

**What's parked:**

- `PostType` enum — the final value list
- `PostTone` enum — cultural_moment vs standard (part of Axis 2 in D048)
- `subjectTags String[]` field on Post (Axis 3 in D048)
- `expiresAt DateTime?` field on Post (Axis 10 in D048)

**Reference:**

- `docs/architecture/decision-log.md` D048 — the 10 axes framing and
  decision rationale
- `docs/product/post-creation-flow.md` — has an old 7-value draft list
  that's preserved as starting material for the composer design
  session (annotated as "superseded" pending that session)

**Trigger for revisit:**

- Composer design session begins, OR
- A feature needs to filter/branch on post type before composer lands
  (in which case surface the need and decide whether to pull this
  forward or handle the feature differently)

**Why parked rather than killed:**

Every post does have a "kind" — pretending otherwise is dishonest. But
the right taxonomy depends on the composer UX, which hasn't been
designed yet. Premature commitment would constrain composer design.
Later addition is cheap (additive Prisma migration).

**Not parked (already built):**

- `Post.groupTags` — group affiliation (Axis 5)
- `Post.visibility` — audience reach (Axis 6)
- `Post.activistMailerUrl` — one CTA mechanism (part of Axis 8)

# Parking lot — entries to add

_Append these entries to `docs/product/parking-lot.md`. If you have
a section structure (categorised entries), slot them under the most
appropriate headings. If parking-lot is a flat list, append to the
end with the date._

---

## Multi-mailer URL allowlist — extensible action endpoints

**Problem:** Today the AM URL allowlist accepts `activistmailer.com`
only (configurable via `ACTIVIST_MAILER_ALLOWED_DOMAINS` env var).
This is a simplification. In real use, GPS posts will link to many
campaign endpoints, not just one mailer.

**Examples of likely future allowed domains:**

- Action Network (`actionnetwork.org`)
- WriteToThem (`writetothem.com`)
- TheyWorkForYou (`theyworkforyou.com`)
- Parliament petitions (`petition.parliament.uk`)
- Change.org (`change.org`)
- 38 Degrees (`38degrees.org.uk`)
- Custom GPS-hosted campaign tooling (TBD)

**What to do later:**

- Decide whether the field name `activistMailerUrl` should be
  renamed to `actionUrl` or `campaignUrl` for genericity. Renames
  on the schema are non-trivial (migration + every consumer
  updated)
- Decide whether the allowlist should be runtime-configurable
  (admin UI to add/remove) or stay as env var
- Decide whether different domain types should render differently
  in PostCard ("Sign petition", "Email your MP", "Open campaign")
- Decide how to validate URLs from new domains — are some "trusted"
  in the sense that we can show their metadata? Out of scope until
  it matters

**Surfaced by:** Scenario 19 conversation (April 2026). Recording
the demo with placeholder `activistmailer.com` URLs is fine for
now.

**Related:** Scenario 1 (Sky News action), Scenario 8 (councillor
email action). Both would, in real use, hit different endpoint
families.

---

## Auto-fetch Open Graph metadata for link-share posts

**Problem:** Today's link-share post (BU-link-share) requires the
member to manually paste link metadata: title, description, image
URL, site name. This is friction and is below the 2026 expectation
(every other social platform auto-populates).

**What auto-fetch would do:**

- Member pastes URL
- Server-side fetches the URL with a strict timeout (~3s)
- Parses HTML for `<meta property="og:title">`,
  `<meta property="og:description">`, `<meta property="og:image">`,
  `<meta property="og:site_name">`
- Falls back to `<title>` and `<meta name="description">` if no OG
  tags
- Pre-populates the form fields; member can override
- Caches the fetched data per URL (probably in a `LinkPreview`
  table separate from `Post`, so multiple posts sharing the same
  URL share metadata)

**Why it's not in v1:**

- Server-side fetching introduces SSRF (server-side request
  forgery) risk if not carefully scoped — could be abused to probe
  internal network resources from the GPS server
- Timeout + retry handling adds complexity
- Caching strategy needs design (TTL? invalidation? per-URL or
  per-domain rate limit?)
- Image hosting question — do we proxy/cache the image, or
  hotlink? Hotlinking is fragile but cheap
- All of these are real engineering decisions that deserve their
  own brief, not a rushed addition

**What to do later:**

- Write BU-link-share-autofetch brief
- Decide on `LinkPreview` separate model vs continuing with flat
  fields on Post. Separate model lets multiple Posts share the
  same metadata
- Plan SSRF mitigations (domain allowlist? IP filtering?
  url-canonicalisation library?)
- Plan image handling — proxy through a CDN, hotlink, or cache
  on object store
- Consider the "preview before posting" UX — if auto-fetch lands,
  the composer can show the card preview live as the URL is
  pasted

**Surfaced by:** Scenario 19 conversation (April 2026), captured
in scenario's "Friction found" section.

**Related:** Scenario 19, the FAB composer (BU-composer-fab, D044) which
might be the right place to integrate auto-fetch since it's a
richer composer surface anyway.

---

## (Optional addition if relevant — only include if

` docs/product/parking-lot.md` doesn't already have these)

## Reaction taxonomy — fixed set vs configurable

**Problem:** BU-reactions ships with 8 fixed emoji (🕯️🙏❤️💪🎯💕👍😢)
based on existing scenarios. This decision deserves revisiting after
real use.

**Open questions:**

- Should admins be able to add or remove reactions?
- Should some reactions be context-specific (e.g. 🕯️ only on
  cultural posts, 🎯 only on action posts)?
- How do reactions interact with localisation if the product
  expands beyond UK?
- Cultural reactions — are 🕯️ and 🙏 always appropriate, or are
  there moments they'd feel performative?

**What to do later:**

- After 1 month of real reaction data: which are used, which
  aren't?
- Decide whether to allow custom additions or stick with the fixed
  set
- Possibly evolve to context-aware reactions (post type
  determines available reactions)

**Surfaced by:** BU-reactions design discussion (April 2026).

**Decision (April 2026):** Ship 8 fixed for BU-reactions. Park the
expansion story below; do not block the build on it.

---

## Expand the reaction set — story

**Status:** PARKED — pending real-usage data from BU-reactions.

**Trigger:** After 1 month of reactions data in dev/pilot, OR a
real member request that names a missing emoji.

**What to do then:**

1. Pull the `reaction_added` analytics event counts per emoji.
2. Identify dead emoji (used <2% of total reactions) and missing
   ones (members reaching for an emoji not in the set).
3. Decide: trim, expand to 12, expand to 14+3 seasonal (per
   `analytics-events.md:136`), or keep 8.
4. If expanding: a small ADR records the change; the `ReactionEmoji`
   enum gets new values; no UI rework if the tray flexes.
5. If trimming: deprecation path needed (existing rows must remain
   readable; just hide from the picker).

**Why this is parked, not built:** premature taxonomy decisions are
a known waste pattern. The 8 we ship are scenario-grounded; data
will tell us whether they're right.

**Owner:** Paul, on first-of-month review of the analytics events
log.

---

## Multi-CTA model — primary action + multiple secondary actions per post

**Status:** PARKED — confirmed as the future direction; deferred
until the second-CTA need is real.

**The shape:** every post has one primary CTA (today: the AM URL)
plus optional secondary CTAs available inside the post detail.
Secondary CTAs are things like a petition link, a donate button,
a calendar invite, a share-to-WhatsApp prompt, an email-your-MP
form — different actions on the same post, surfaced in the detail
view so the feed card stays clean.

**Today's MVP** (per D060): two URL slots — `activistMailerUrl`
(primary) + `linkUrl` (secondary, currently treated as a preview
card rather than a CTA). The `<LinkPreviewCard>` primitive renders
both. This is the "two-slot pattern."

**The future schema evolution:** replace the two slots with a typed
`Action[]` array on Post. Each action carries:

- `url` — the target
- `label` — button copy ("Sign petition", "Donate £10", "Email your MP")
- `kind` — typed enum (`am`, `petition`, `donation`, `calendar`,
  `share`, `external_link`, ...) — drives icon/styling
- `order` — position in the action stack
- `isPrimary` — exactly one per post; renders prominently in feed

The detail view shows all actions as a stack (primary on top, others
below). The feed card shows only the primary.

**When this gets built:**

- Trigger: a real post has 3+ actions to surface (likely first
  petition+share dual-CTA scenarios, or the urgent-action templates
  from D044 if they grow)
- Effort: schema migration with an ADR, refactor `PostCard` and
  detail-view rendering, update composer to manage an action list,
  retrofit existing AM URL posts (synthesise an `Action` row from
  the legacy `activistMailerUrl` field; deprecate the field)
- ADR required (Post schema is contract-locked)
- Likely 1 BU spanning 2-3 sessions

**Why parked, not built now:** MVP scenarios all fit the two-slot
pattern. SCN-19 (link share) is a `linkUrl` with no AM CTA. SCN-1
(Sky News bias post) is an AM URL action with no separate share
target. No current scenario needs three CTAs. Building the array
model speculatively would be premature abstraction. Promote when a
real third-action need surfaces.

**Owner:** Paul, surfaced during BU-link-share design session
(2026-04-26).

---

## Username system for collision-safe @mentions

**Status:** PARKED — surfaced during BU-requests-vetting design.
Triggers when member count or first reported wrong-mention forces it.

**The shape:** add `User.username String? @unique` plus an onboarding
step where members pick a handle. @mention parser switches from fuzzy
`displayName` match to strict `@username` match. Eliminates the
"two Sharons" collision risk.

**Today's MVP** (per BU-requests-vetting): fuzzy match against
displayName. With 5–8 seed users (all unique names) collisions can't
happen. As member count grows, two members named "Sharon" will
collide and one will get mentions intended for the other.

**Trigger to build:**

- Member count crosses ~50, OR
- First reported wrong-mention incident, OR
- A reviewer requests scoped @mention autocomplete that needs a
  stable handle to disambiguate

**Effort:** ~half a session — schema migration (single nullable
column + unique index), onboarding step, autocomplete update,
mention parser swap. Light.

**Owner:** Paul, surfaced during BU-requests-vetting design
(2026-04-26).

---

## Post-comment audience model

**Status:** PARKED — surfaced during BU-requests-vetting design.

**The shape:** extend the D056 `Comment.audience` toggle (currently
Request-only) to apply to Post comments too. A coordinator could
add internal annotations to a published Post that members can't
see — useful for cross-team coordination notes on a public action.

**Today's MVP** (per BU-requests-vetting): Request-only audience.
Post comments remain public-by-design — everyone who can see the
post sees every comment.

**Trigger to build:**

- A real use case where a coordinator wants to annotate a published
  Post for the reviewer team without member visibility (e.g.
  "we've contacted the school directly — don't share this widely").
- OR a member-vs-coordinator information-asymmetry need surfaces.

**Effort:** ~half a session — schema-wise the field already exists,
just needs the toggle UI on Post comment composer + filter logic
on the Post detail comment list. Light.

**Owner:** Paul, surfaced during BU-requests-vetting design
(2026-04-26).

---

## Contextual flag / edit-request composer launchers

**Status:** PARKED — surfaced during BU-requests-vetting design.

**The shape:** disable the global FAB picker tiles 9 (Flag a problem
post) and 10 (Suggest an edit). Instead, surface them via a "..."
menu on each post-detail page, where the target `postId` is
implicit and pre-filled.

**Today's MVP** (per BU-requests-vetting): tiles 9/10 are reachable
from the FAB picker globally. The composer asks for the target post
URL or ID as free-text input. Members may guess wrong or paste the
wrong URL.

**Trigger to build:**

- Usage data shows members consistently guessing post IDs or
  pasting wrong URLs.
- Bad flag/edit Requests start clogging the reviewer queue because
  reviewers can't determine which post the request refers to.

**Effort:** ~half a session — disable tiles in IntentFab, add "..."
menu to post-detail page with two new menu items, route both to
existing composers with `postId` query param.

**Owner:** Paul, surfaced during BU-requests-vetting design
(2026-04-26).
