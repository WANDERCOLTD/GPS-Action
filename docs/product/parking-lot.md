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

Outbound to non-WhatsApp socials. Two questions: (a) which platforms allow real server-side automation on a member's behalf, and (b) what's the lowest-click pattern when automation isn't available. The companion entry below covers WhatsApp specifically (where the constraints are tighter); this entry covers everything else.

**The hard constraint:** Meta removed `publish_actions` in 2018. Personal Facebook timelines and personal Instagram accounts cannot be posted to programmatically by third parties — full stop. The only Meta surfaces still automatable are Facebook **Pages** the member admins, and Instagram **Business/Creator** accounts (image-first, no native link-in-post). For everyone else on FB/IG, "share" is a prefilled web-intent the member confirms — not automation.

**The option space, per platform:**

| Platform                       | Automatable on behalf?                 | Mechanism                                       | Clicks per share (post-OAuth) | Cost / gotcha                                                                |
| ------------------------------ | -------------------------------------- | ----------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| **Bluesky**                    | ✅ Yes (easiest)                       | AT Protocol app password / OAuth                | 0                             | Free, no review, automation-friendly — **first OAuth target if we ship one** |
| **Mastodon**                   | ✅ Yes                                 | Per-instance OAuth                              | 0                             | Free; one auth flow per instance the member belongs to                       |
| **X (Twitter)**                | ✅ Yes                                 | OAuth 2.0 PKCE, `tweet.write` scope             | 0                             | API Basic ~$200/mo, 3,000 posts/mo/app cap                                   |
| **LinkedIn**                   | ✅ Yes                                 | OAuth, `w_member_social` scope                  | 0                             | Marketing Developer Platform review for production                           |
| **Threads**                    | ✅ Yes                                 | Meta Threads API (2024+), OAuth                 | 0                             | Newer API, fewer guarantees, same Meta review surface                        |
| **Facebook Page**              | ✅ Yes (member must admin a Page)      | Graph API `pages_manage_posts`                  | 0                             | App review; relevant to partner-org pages, not personal members              |
| **Instagram Business/Creator** | ✅ Limited                             | Graph API, image-first                          | 0                             | Image required; no native link-in-post; 25 posts/day cap                     |
| **Telegram**                   | ✅ Channels only (member must admin)   | Bot API                                         | 0                             | Cannot touch personal feed; Channels not groups                              |
| **Facebook (personal)**        | ❌ No (`publish_actions` removed 2018) | `facebook.com/sharer/sharer.php?u=…` web intent | 2 (open → post)               | Prefill only                                                                 |
| **Instagram (personal)**       | ❌ No                                  | None — no web intent either                     | n/a                           | Out of reach; ship image to camera roll, member drops in Story manually      |
| **WhatsApp**                   | ❌ No (groups closed)                  | OS share sheet OR `wa.me/?text=…`               | 2                             | Free; full WhatsApp option space catalogued in the entry below               |

**Lowest-click pattern when automation is off the table:** the OS share sheet. `navigator.share({ url, text })` is one tap to open, one tap to send, works in iOS Safari + Android Chrome, handles every installed app uniformly, and avoids per-platform code paths. Desktop / non-supporting browsers fall back to per-platform web-intent buttons (X, FB sharer, LinkedIn share URL, `wa.me`). This is the right MVP answer regardless of whether we ever ship OAuth automation.

**Aggregator option:** services like Ayrshare, Buffer, Postiz wrap X / FB / IG / LI / Bluesky / Threads behind a single server-side API. Useful if we ship multi-platform fan-out for a small number of org accounts (e.g. GPS Action's own X / Bluesky / LinkedIn). **Do not** treat them as a shortcut for the per-member problem — they require the same OAuth grants per platform and inherit every platform's restrictions (no WhatsApp groups, no personal FB/IG).

**Recommended ship order if member-on-behalf automation is ever built:**

1. **Bluesky first.** Free, no review, friendliest API. Validates the "Connect a social account" UX with low operational cost.
2. **X second.** Pay the $200/mo if pilot data justifies the reach.
3. **LinkedIn third.** Worth the review process for partner orgs and credibility-anchored shares (comms professionals, legal, journalism).
4. Mastodon, Threads, FB Pages on demand.
5. Personal FB / personal IG: never. Web intents only.

**Honest copy is non-negotiable** (per CLAUDE.md voice rules): "Posted to Bluesky ✓" only when the server-side API actually returned 200. For web-intent shares the copy is "Opening X composer…" — never "Posted to X". Mixing the two in a single share rail erodes trust.

**Open questions before this can promote out of PARKED:**

1. Do we want member-on-behalf automation at all, or is the principled answer "GPS Action posts stay on GPS Action; share is member-driven via the OS share sheet"? The latter aligns with the no-anxiety-amplification principle and skips OAuth overhead entirely.
2. Org-account automation (GPS Action's own Bluesky / X) is a separate, smaller question — server-side fan-out of Verified posts to org channels. Worth scoping independently of the per-member question.
3. UTM tagging interaction (see entry in post-MVP outbound section) — if we automate, do we tag? Affects analytics shape.

**Trigger to revisit:** (a) ≥20% of members request "auto-post to my X / LinkedIn / Bluesky", (b) a partner org wants their feed driven from GPS Action posts they author, or (c) we need verifiable cross-platform reach data for funder reporting and aggregators are the path of least resistance.

**Related entries:**

- `PARKED · Automated WhatsApp cross-posting (beyond wa.me share intent)` (below) — same question viewed at WhatsApp specifically, where the constraint is even tighter (groups closed entirely).
- `PARKED · LinkedIn / Telegram / WhatsApp Channels (Business API)` (in post-MVP outbound section) — the legacy one-liner this entry largely subsumes.
- `PARKED · UTM tagging on outbound URLs` (in post-MVP outbound section) — interacts with automation choice.
- `PARKED · Instagram Stories share` — the Instagram answer for personal accounts (image card, manual drop).

_Origin: long-term reach thinking; expanded 2026-04-27 by Paul's question about a single low-click share table covering all socials with automation options. Sister entry to the WhatsApp-specific analysis below._

### PARKED · Partner-specific amplification pathways

A post attributed to Action on Antisemitism might route to their networks too (if they're GPS Action users or if we integrate).

_Origin: partner-organisation feature absorbed this week._

### PARKED · Automated WhatsApp cross-posting (beyond wa.me share intent)

The current outbound-to-WhatsApp pattern is `wa.me/?text=…` — a one-tap share intent that opens the user's WhatsApp client with prefilled text and lets them pick a group. It's honest, ToS-clean, and zero-cost, but every send still costs the member one tap and one decision. This entry catalogues the server-side paths for going further, what each can and can't do, and the constraints that shape the choice.

**The hard constraint:** WhatsApp's official APIs **cannot post into groups**. Groups remain a closed surface — only the WhatsApp client can write to them. Any "automated post into the activist groups" feature has to either (a) be a one-tap share intent the member triggers, or (b) violate ToS. There is no third option in 2026.

**The option space:**

| Path                                                            | Server-driven?      | Surface                                                                                                               | Free tier                                                     | Fit for GPS Action                                                                                                             |
| --------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Meta Cloud API** (official Business Platform)                 | Yes                 | 1:1 conversations only — user must opt in via tap-to-chat or template, then 24h session window for free-form messages | 1,000 conversations/month free, then per-conversation pricing | Good fit for transactional 1:1s ("your post was approved", "urgent action in your region") — _not_ a group-dispatch substitute |
| **WhatsApp Channels (via Cloud API)**                           | Yes                 | One-way broadcast channel, members subscribe, no replies                                                              | Free for the org running the channel                          | Suits org-level announcements (`GPS Action National Channel`); does not replace coordination groups, which need 2-way          |
| **Twilio / MessageBird / Vonage wrappers**                      | Yes                 | Same upstream as Cloud API — same constraints                                                                         | Trial credits only; per-message pricing after                 | Easier DX for templated 1:1s, but no extra capability vs Cloud API direct                                                      |
| **Unofficial libs** (Baileys, whatsapp-web.js)                  | Yes                 | Can write to groups by impersonating a real client                                                                    | Free (self-host)                                              | **DECLINED** — see existing entry below. Ban risk + ToS breach + trust erosion if a coordinator's number gets nuked            |
| **Click-to-chat share intent** (`wa.me/…`, `whatsapp://send?…`) | No — needs user tap | Any chat the user can reach (groups included)                                                                         | Free                                                          | **Current MVP pattern.** One tap is the price of group reach being closed                                                      |

**What automated cross-posting could realistically deliver:**

1. **Org-level announcement channel.** GPS Action runs an official WhatsApp Channel; a "publish to org channel" toggle on Verified posts auto-broadcasts the title + link via Cloud API. Server-side, no human in the loop after the verdict. Reach is read-only subscribers, not coordination groups — so this _supplements_ wa.me, doesn't replace it.
2. **Opt-in 1:1 nudges.** Members opt in to "WhatsApp me when an Urgent post lands in my region." Cloud API sends a templated message ("Urgent in NW London — open in app: <link>"). Honest copy required: it's a notification, not the act of dispatching.
3. **Coordinator dispatch assist.** Coordinator hits "send to all my groups" — server still doesn't post into groups, but it can prefill _per-group_ wa.me intents in a stacked rail (one tap each), or pre-stage the message text + image in clipboard so the coordinator pastes once per group. Cuts dispatch from N taps × M groups to roughly M+1 taps.
4. **Template library + analytics.** Cloud API requires pre-approved message templates for cold sends. Building a small library (urgent, weekly digest, vetting outcome, etc.) lets us measure delivery + read rates that wa.me doesn't expose.

**What it cannot deliver (and why we should stop pretending it can):**

- Posting into existing activist WhatsApp groups without a human tap. Closed surface. The only way is unofficial libs, which we've declined.
- Replacing the coordination loops that currently happen in groups. Cloud API is point-to-point or broadcast-out — neither models group dynamics. Native group chat inside GPS Action (the entry at line ~543) is a separate question.
- A single "share to all socials including WhatsApp groups" button. Aggregators like Ayrshare and Buffer cover X / FB / IG / LI / Bluesky / Threads at server level, but **none of them post to WhatsApp groups either** — same upstream constraint.

**Open questions before this can promote out of PARKED:**

1. Do we want Channels at all? It's a different shape from groups — broadcast, not coordination — and may dilute the "GPS Action replaces the WhatsApp loop" message rather than reinforce it.
2. What's the opt-in flow for 1:1 nudges? Cloud API requires explicit opt-in per the platform's policy; capturing that during onboarding adds friction for a feature most members may never use.
3. Cost ceiling. Cloud API is free up to 1,000 conversations/month; beyond that it's pay-per-conversation in tiers (~£0.03–£0.07 per marketing-template conversation in the UK, mid-2026 pricing). Pilot scale fits free tier; scale-up needs a budget call.
4. Verification overhead. Cloud API needs a verified Meta Business account, a dedicated phone number not used elsewhere on WhatsApp, and template approval lead time (24–72h per template). Real ops cost, not just code.
5. Do we trust members to opt-in honestly? If "WhatsApp me on urgent" gets toggled by default and silently floods, we erode the Sharon-warmth posture and the "permission to close the app" principle. Notification design matters as much as the API choice.

**Trigger to revisit:** pilot data shows either (a) coordinators dispatching to >5 groups per Verified post (multi-tap fatigue measurable), (b) ≥30% of members request "tell me on WhatsApp when urgent", or (c) a partner org wants a Channel-style broadcast surface.

**Related entries:**

- `DECLINED · Auto-posting to WhatsApp groups via unofficial APIs` (below) — the bright line.
- `DEFERRED (Phase 2) · WhatsApp Business API for Channel routes` (below) — the narrow Channels case, subsumed here.
- `PARKED · LinkedIn / Telegram / WhatsApp Channels (Business API)` (below, in the post-MVP outbound section) — same Channels question viewed from the share-out-mechanics side.
- `PARKED · Cross-platform amplification beyond WhatsApp` (above) — the multi-platform aggregator question (Ayrshare / Buffer / Postiz).
- `D013` self-dispatch default and `D017` boost-as-post-plus-verdict — the dispatch posture this fits inside.

_Origin: Paul's 2026-04-27 question — "what options do we have to create automated posts to WhatsApp if selected by the user? How could we achieve automated posting from the server to avoid the user having to click Post?" Answer: for groups, we can't (and shouldn't try); for Channels and 1:1, we can, with caveats above._

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

### PARKED · Inbound posts from WhatsApp via Business API

A second inbound path that's WhatsApp-native: a member messages a GPS Action WhatsApp number and the message body becomes a draft post in their account. Distinct from the PWA share-sheet path above, which routes content _through the OS_; this routes _through WhatsApp itself_, which is where many members already live. Pairs with the outbound `wa.me` pattern as the symmetric inbound side.

**The mechanics:** Meta Cloud API (or a BSP wrapper — Twilio, 360dialog, MessageBird) gives us a webhook on inbound messages. Body, attachments, sender phone number arrive server-side; we identify the member by phone (or prompt a one-time link if unknown), build a draft post, and reply with a deep link to confirm and publish. The 24-hour session window is plenty for the confirmation roundtrip.

**The option space:**

| Path                                  | Member action                                                     | Friction                      | Infra                                                     | Verdict                                           |
| ------------------------------------- | ----------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| **WABA + webhook (direct send)**      | Message the GPS Action number with text/link/image                | Lowest                        | Cloud API + verified Business + dedicated number + parser | ★ Best long-term WhatsApp-native path             |
| **`wa.me/<number>?text=…` deeplink**  | One-tap link from a poster, prefilled, opens chat with our number | One tap to open + one to send | Same WABA infra; deeplink is just the discovery layer     | Pair with WABA — the entry point, not the engine  |
| **Forward-to-bot**                    | Forward any existing WhatsApp message to our number               | One forward                   | Same WABA infra; parser handles forwarded-from headers    | Adds the "I just saw this in another group" loop  |
| **Email-to-post fallback** (`post@…`) | Forward WA chat → email → parser                                  | Many taps                     | SES inbound + parser                                      | Cheap fallback; not WA-native; useful for desktop |

**What this unlocks beyond the PWA path:**

- Members never have to leave WhatsApp to start a post. The mental model "I tell GPS Action by messaging them, just like any other group" is what the platform ultimately replaces — getting there via WhatsApp itself is the most familiar on-ramp.
- The forward-to-bot loop is uniquely WhatsApp-shaped: members already forward content between groups constantly. "Forward to GPS Action" slots into existing behaviour with zero new gestures.
- Image and voice-note inbound work natively (WABA handles media). The PWA share path on iOS struggles with images.
- Discovery: print a card with `wa.me/<number>` and a QR code at events; first message from a new number triggers an onboarding flow.

**What this cannot deliver:**

- Reading messages from existing activist groups. Same closed-surface constraint as the outbound case — Cloud API receives only messages addressed to our number.
- Posting on the member's behalf without their explicit message. Inbound is always member-initiated, by definition.
- Support without verification cost. Same WABA verified-business + dedicated-number burden as the outbound entry.

**Open questions before this can promote out of PARKED:**

1. Identity binding. How does a member's WhatsApp phone number get associated with their GPS Action account? Self-serve in profile settings (member adds their number, we verify with a code) is the obvious path, but it adds an onboarding step. Should it be optional or pushed during signup?
2. Draft-confirmation UX. Reply with a deep link ("Tap to review and publish: /compose/draft/<id>") and require an in-app confirm? Or auto-publish after a 60-second "edit window" if the member doesn't reply STOP? The latter is one fewer tap but riskier for trust.
3. Vetting interaction. Inbound from WhatsApp goes through the same vetting pipeline as `/compose` posts, presumably — but does the Sharon-warmth posture mean we should auto-flag for review anything that arrives via WABA, or treat it as identical to PWA-routed content?
4. Cost ceiling shared with outbound (Cloud API limits apply across both directions).
5. Verification overhead shared with outbound (same verified-business setup, same template-approval lead time for any cold replies).

**Trigger to revisit:** (a) pilot data shows the PWA share-sheet path is converting <40% of share intents on iOS (where it's weakest), (b) ≥25% of members request "I want to send things to GPS Action from inside WhatsApp", or (c) the WABA outbound entry promotes — at which point the verified-business infrastructure is already in place and inbound is incremental.

**Related entries:**

- `ABSORBING · Inbound sharing (PWA-first, native later)` (above) — the OS share-sheet path; this entry is the WhatsApp-native sibling.
- `PARKED · Automated WhatsApp cross-posting (beyond wa.me share intent)` (in Dispatch & amplification section) — outbound counterpart; shares the same WABA infra, so promoting either pulls the other closer.
- `D018` self-dispatch + inbound-share endpoint — the foundational concept.

_Origin: Paul's 2026-04-27 question — "what options do we have to create our posts directly from within WhatsApp?" — surfaced this as a distinct path from the PWA share-target work that's already absorbing._

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

_See also: `PARKED · Automated WhatsApp cross-posting (beyond wa.me share intent)` in the Dispatch & amplification section — covers the WhatsApp Channels case in depth._

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

_Subsumed by: `PARKED · Automated WhatsApp cross-posting (beyond wa.me share intent)` in the Dispatch & amplification section, which catalogues the full option space (Cloud API, Channels, 1:1 nudges, aggregator wrappers) and the open questions before this can promote._

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

**Real-world evidence (April 2026):** WhatsApp pattern review surfaced
an "ASDA called out" post in the wild structured as exactly this
shape — three numbered actions ("Watch & Share / Boycott / Speak
Up"), each with a different verb-kind. This is the second-CTA-
threshold-met trigger landing in real activist comms even before
GPS Action ships. Promote-to-build when a comparable post lands on
GPS Action and the two-slot pattern visibly fails it.

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

**Status:** PARKED — superseded in part by the disambiguation work
of 2026-04-26 (see "Tile 9 disambiguation" note below). Tile 10 only
remains in scope for this entry.

**Disambiguation (2026-04-26):** This entry originally covered both
tile 9 ("Flag a problem post") and tile 10 ("Suggest an edit"). On
review, those were two different things mashed together:

- **Tile 9 was never moderation flagging.** It's a _content post
  intent_ — "I saw this horrible thing in the world and want action."
  Renamed to **"Call out a problem"** and moved to its own parking-lot
  entry below ("Call out a problem — content post intent").
- **Moderation flagging** of an existing GPS Action post or comment
  is a separate primitive — a small typed affordance on every post
  and every comment, distinct from reactions. Moved to its own entry
  below ("Member flagging primitive — internal moderation flag").
- **Tile 10 ("Suggest an edit")** stays in scope for this entry. The
  contextual-launcher idea (move out of the global FAB picker into
  a "..." menu on the target post) still applies to it.

**Tile 10 — the shape:** disable the global FAB picker tile 10.
Instead, surface it via a "..." menu on each post-detail page,
where the target `postId` is implicit and pre-filled.

**Today's MVP** (per BU-requests-vetting): tile 10 is reachable from
the FAB picker globally. The composer asks for the target post URL
or ID as free-text input. Members may guess wrong or paste the
wrong URL.

**Trigger to build:**

- Usage data shows members consistently guessing post IDs or
  pasting wrong URLs.
- Bad edit-Requests start clogging the reviewer queue because
  reviewers can't determine which post the request refers to.

**Effort:** ~quarter of a session — disable tile in IntentFab, add
"..." menu item on post-detail page, route to existing composer
with `postId` query param.

**Owner:** Paul, surfaced during BU-requests-vetting design
(2026-04-26); disambiguated 2026-04-26.

---

## "Send for review" surfaces in composer (D063 wiring)

**Status:** PARKED — D063 (Send-for-Review pattern) was scaffolded
during BU-requests-vetting Phase 1; the schema landed but the
composer-side button + reviewer Publish/Archive UI were explicitly
deferred.

**Decision:** when this work picks up, "Send for review" lives as a
**second submit button next to Post**, not as a separate FAB tile.
Every kind can be sent for review, so a tile would duplicate.

Composer renders two submits side-by-side:

- **Post** — primary, publishes immediately as today
- **Send for review** — secondary, creates a Request with the
  draft post in `context.draftPost` (per D063), routes to reviewer
  queue, no publish

Reviewer side: existing /requests workspace gains Publish + Archive
verdict actions for `kind: 'post_review'` Requests.

**Owner:** Paul, surfaced during BU-fab-intent-picker UX session
(2026-04-26 — undecided chip-grid).

---

## Image management & gallery — member-facing

**Status:** PARKED — outstanding action for Paul/IRL. Bundles the
member-facing surface that several already-parked engineering items
will eventually feed into.

**Origin:** 2026-04-27, raised after BU-post-hero-demo shipped its
demo path (D064). The seeded SVG bucket gets us through demo, but
the real-world need is broader: members should be able to manage
their own images across posts, not just pick from a fixed bucket.

**The shape (member-facing):**

- **Upload** — pick an image from device, drag and drop on web,
  camera roll on mobile. Sane size limits, EXIF stripped.
- **Gallery** — a member's own image library: re-use a photo across
  multiple posts without re-uploading; see what's been used where.
- **Post composer** — pick from gallery or upload new, in the same
  flow. Carousel (multiple images per post) becomes natural here.
- **Moderation** — coordinator/admin can hide an image (cascade to
  every post that uses it) without nuking the post body.
- **Provenance** — caption / credit / "where I got this" capture at
  upload time, surfaced on the post.

**How this maps to existing parked engineering items:**

- "Direct image upload on Post" — the upload primitive. Phase 2
  BU-image scope. Replaces the seeded-SVG demo path from D064.
- "Multimedia composer" — multiple images per post, carousel,
  video. Same family.
- "Image handling phased — D046" — the phasing plan that BU-image
  delivers against.

**Why park as a single user-facing entry instead of relying on the
engineering items alone:** the engineering items are scoped to what
the _system_ needs (upload, storage, moderation). The user-facing
"gallery" experience pulls them together with reuse, library, and
provenance — which the engineering items don't articulate as a
unified surface. This entry is the IRL/product-side outstanding
action; the engineering items remain the build-side pointers.

**Trigger to promote:**

- Phase 2 starts (post-demo) AND a real member needs the gallery
  experience for a recurring use case (e.g. a coordinator who
  re-uses the same banner photo across multiple regional posts).
- OR the seeded-SVG bucket from D064 starts visibly limiting demo
  storytelling (members ask "can I use my own photo?").

**Out of scope here (separate parking entries cover them):**

- Reactions on images, image-only posts, image albums as a Post
  variant — different shapes, separate decisions.
- Video — under "Multimedia composer".
- Group/coordinator avatar uploads — under image-handling.md.

**Owner:** Paul. Outstanding action for IRL, not a Claude Code
session task.

---

## Reactions reveal-on-hover — refinement to BU-reactions before build

**Status:** PARKED — design refinement to fold into the BU-reactions
brief before that BU starts. Not a separate BU.

**Origin:** WhatsApp pattern review, 2026-04-26 (Asda action video,
Archway Our-Fight field-report photo). Reaction: "see how reactions
are nicely tucked away, and the on-float face reveals the reaction
bar."

**Today's plan** (per `docs/build/session-briefs/bu-reactions.md`):
a `<ReactionPill>` is **always-visible** on every post card showing
aggregate counts; tap opens the tray.

**The refinement:** prefer the WhatsApp pattern — picker hidden by
default, revealed on hover (desktop) or long-press (touch). The
aggregate count remains visible but as a small subordinate signal
under the body (e.g. `👍🙏 2` micro-row), not a tappable pill that
takes layout weight even when nobody has reacted. Two reasons:

1. Cleaner feed by default — matches design-philosophy.md principles
   1 (one-click) and 3 (no anxiety amplification). The picker is
   one gesture away, not present-but-passive.
2. Empty-state handling becomes free: if zero reactions, nothing
   renders. No "0" affordance to look at.

**Open questions to resolve in the brief:**

- Touch parity — long-press on the card body? A small reaction
  affordance bottom-right that expands on tap? WhatsApp uses
  long-press; we may want a more discoverable mobile gesture.
- The aggregate micro-row: always present once reactions exist, or
  only above some threshold (e.g. ≥1)?
- Does the always-visible aggregate eat one tap to open the picker
  (i.e. tap the row → tray), or is reveal a separate gesture from
  count display?

**When to action:** before BU-reactions starts (Phase 2 demo-leverage,
not yet begun). The brief should be amended with this pattern, OR
an ADR records the divergence if we keep the always-visible pill.

**Owner:** Paul, surfaced during WhatsApp pattern review (2026-04-26).

---

## Direct image upload on Post — priority bump from image-handling phased plan

**Status:** PARKED — priority signal, not a redesign of the phased
plan in `image-handling.md`.

**Origin:** WhatsApp pattern review, 2026-04-26. Reaction: posts in
real activist channels are "much more colourful than our postcards"
— photos and videos are the hero, not the exception. The Archway
field-report photo and the Asda action video would each be
materially weaker without the media.

**Today's plan** (per D046 / `docs/product/image-handling.md` Phase
MVP day 1): no member-uploaded post hero. Members paste a URL →
server fetches og:image → that becomes the hero.

**The signal:** og:image-only is too thin for the post patterns we
want to support (field reports, on-the-ground action calls). Direct
upload should land sooner than the current phased plan implies.

**Demo path — fakeable upload:** the upload pipeline can be **stubbed
for demo**. A small fixed bucket of seeded images, drag-and-drop /
file picker returns one of them rather than performing a real S3
upload. Real upload + storage + moderation + EXIF strip + size limits
remain the proper Phase 2 BU-image scope. This unblocks visual
richness in the demo without committing to that infrastructure.

**Effort sketch:**

- Demo-only: `<HeroImagePicker>` returns a URL from a fixed seeded
  set. Post schema gains `heroImageUrl` (nullable). Either rolled
  into the next composer-touching BU or a small standalone
  "BU-post-hero-demo".
- Real Phase 2: the full BU-image scope (S3, moderation, thumbnails,
  EXIF, size limits). The demo's `heroImageUrl` field survives;
  only its source-of-truth changes.

**Open questions:**

- Is one hero per post enough for demo, or do we need a small
  carousel from day one? (Carousel was Phase 2/3 per "Multimedia
  composer" entry.)
- For seeded demo images — generic stock or scenario-specific
  visuals (Archway-style banner, Asda-style storefront)?

**Owner:** Paul, surfaced during WhatsApp pattern review (2026-04-26).

---

## Bullet-list rendering in post body — narrow markdown subset (display-only)

**Status:** PARKED — display-only refinement. Distinct from the
broader "markdown/rich text" composer idea parked under "Composer
enhancements (Phase 2+)".

**Origin:** WhatsApp pattern review, 2026-04-26. The Archway field-
report used `✅ ✅ ✅` ticks for "what went well", and the Asda post
used `1. 2. 3.` numbered actions. Rendering both as run-on plain
text with newlines loses scannability — the list-ness of the
content is part of the message.

**The shape:** detect a narrow set of list patterns in the existing
plain-text `body` field at render time and present them as styled
lists. No composer changes — members already type lists in plain
text; the renderer interprets them.

**Scope (deliberately narrow):**

- Bullet list: lines starting with `-`, `*`, or `•`
- Numbered list: lines starting with `1.`, `2.`, ...
- Emoji-prefix list: lines starting `✅`, `☐`, or any emoji followed
  by a space (the Archway pattern) — render as a tighter spacing
  with hanging indent
- NOT in scope: bold, italic, links inside body, headings,
  blockquotes, code — those belong to the broader markdown/rich-
  text question parked under Composer enhancements

**Why split this from the parked composer rich-text entry:** that
entry is a _composer_ feature (rich editor, full markdown). This is
a _renderer_ feature — interpret plain text people already type.
Different effort (small), different risk (low — display-only), and
ships independently.

**Trigger:** bake into the next post-rendering touch (e.g. when
adding hero image rendering, or when BU-reactions changes the card
layout). Cheap inline. ADR not required (display-only, no schema
change).

**Owner:** Paul, surfaced during WhatsApp pattern review (2026-04-26).

---

## Member flagging primitive — internal moderation flag

**Status:** PARKED — design agreed, not yet briefed. Likely a thin
sibling BU (`BU-flag`) before BU-requests-vetting Phase 2 builds on
it. Not part of demo scope.

**Origin:** WhatsApp pattern review + Q1 disambiguation,
2026-04-26. Distinguished from the renamed tile 9 ("Call out a
problem", which is a content post intent — see entry below).
Moderation flagging is a separate primitive entirely.

**The shape:** a small typed affordance available on every post and
every comment, distinct from reactions. Members tap it to send the
target into the reviewers' queue. The post or comment itself stays
visible — flagging never hides content; it only enters the review
queue.

**State machine:**

```
unflagged → flagged → flagged + reviewed-tick
                  ↳ (re-flag possible after tick, clears tick)
```

The reviewed-tick is a visible audit trail: "this was flagged AND a
reviewer has dealt with it". Re-flagging after a tick re-enters the
queue and clears the tick (per F5 below) — otherwise one early
review immunises content forever.

**Reviewer actions on a flagged item (demo scope):**

- Mark reviewed → tick. Single button.
- Add a comment to the post or to the flag itself.
- (Branched moderation actions — dismiss vs uphold-and-hide — defer
  until real moderation needs surface in pilot.)

**Design questions and demo-feasible defaults (F1–F7):**

| #   | Question                                         | Demo default                                                                                                                                          |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Who sees the flag's existence?                   | Reviewers + the post's author. Other readers do not — avoids social pile-on.                                                                          |
| F2  | Is there a flag count or single state?           | Single boolean state. Multiple flaggers de-dupe to one queue entry with a `flaggedBy[]` array on the reviewer side; the post UI just shows "flagged". |
| F3  | Does flagging take a reason?                     | Optional reason in a follow-up textarea — skippable. One-tap stays cheap, reason stays useful when given.                                             |
| F4  | What does "deal with" mean?                      | Single "mark reviewed" → tick. Branching (dismiss vs uphold-and-act) when real moderation needs surface.                                              |
| F5  | After tick, can the post be flagged again?       | Yes — re-enters queue, tick clears.                                                                                                                   |
| F6  | Where does the flag affordance live on the card? | `…` menu, not the reaction row. Reactions are positive; flagging is sober. Distinct gesture, different surface.                                       |
| F7  | Comment flagging — same affordance, smaller?     | Yes — `…` on comment hover/long-press. Same state machine.                                                                                            |

**BU path (decision pending):**

- **Path A — fold into BU-requests-vetting Phase 2:** one larger
  slice covering flag affordance + queue UI + reviewer actions +
  the `autoRouteToReview` plumbing for the renamed tile 9 + the
  "Seeking actions" tile. Faster to demo end-to-end.
- **Path B — thin standalone `BU-flag` first:** ships only the
  flag primitive (affordance + state machine + minimal queue).
  BU-requests-vetting Phase 2 then layers reviewer queue UI and
  the auto-route plumbing on top. Cleaner foundation; smaller
  sessions.

Lean: B. Flagging is a primitive that other BUs depend on (incl.
the renamed tile 9 and comments), so building it standalone gives
a clean base. A is faster but bundles concerns.

**Schema sketch:**

- `Flag` model on Post — `targetType: 'post' | 'comment'`,
  `targetId`, `flaggedBy: User`, `reason?: string`, `reviewedAt?:
DateTime`, `reviewedBy?: User`, `createdAt`.
- The `reviewed-tick` UI state is `flag.reviewedAt !== null` AND
  no later un-reviewed flag exists on the same target.

**Effort:** ~1 session for Path B (schema migration + service +
router + flag affordance + minimal queue list). Reviewer queue UI
polish layers on later.

**Owner:** Paul, surfaced during WhatsApp pattern review and Q1
disambiguation (2026-04-26).

---

## `autoRouteToReview` per-intent config + "Seeking Actions" intent

**Status:** PARKED — agreed shape, awaiting commitment to brief.
Demo-feasible in 1-2 sessions on top of `BU-flag` (or alongside it
if Path A is taken — see member-flagging entry above).

**Origin:** WhatsApp pattern review, 2026-04-26 (Asda video → "this
is how to act" reply dynamic). Discussion converged on: don't model
counter-posts as a new entity; instead, give certain post intents
a config flag that auto-routes them into the reviewer queue at
publish time, while the post itself is published live to the feed.

**The primitive — `autoRouteToReview: boolean` on the intent
definition:**

- A property on the intent registry (the FAB picker's intent
  definitions, per D062), not a per-post field.
- When `true`, publishing a post of that intent automatically
  creates a queue entry on the reviewer side. The post itself is
  live in the feed normally.
- Distinguished from the member-flagging primitive: the queue entry
  here is _intent-driven_ (author chose this intent, system routed
  it), not _flag-driven_ (a reader flagged it).

**The "Seeking Actions" intent (new tile in the FAB picker):**

- Member's framing: "I have something worth surfacing but I'm not
  sure what the right action is — what do you suggest?"
- Composer is the standard one + a pre-filled framing line in the
  body, prompting the member to acknowledge they're seeking input.
- `autoRouteToReview: true`.
- On the post card, a small "Actions under review" or "👀 reviewer-
  pending" pill until a reviewer marks it reviewed.
- Reader-side affordance: a "💡 Suggest an action" button that
  opens a regular comment composer pre-filled with `[suggested
action] ` prefix. Untyped for demo (per Q6 — author manually
  folds prose into the body or future `Action[]` rows). Typed
  `commentKind: 'action_proposal'` lands when multi-CTA does (see
  the multi-CTA entry above).

**Reviewer queue distinguishes origin:**

- Tab or filter: "Auto-routed (intent)" vs "Internally flagged"
  (per F-questions in the member-flagging entry above).
- Reviewer's action set differs by origin: auto-routed posts get
  "mark reviewed / archive (queue) / add comment". Internally
  flagged posts add the flag-state machine.

**Schema sketch:**

- No Post field changes — the intent definitions in code carry the
  flag (e.g. `INTENTS.SEEKING_ACTIONS.autoRouteToReview = true`).
- A `ReviewQueueEntry` model (or reuse of `Flag` if Path A is
  taken) — `originType: 'intent_auto' | 'member_flag'`,
  `targetId`, `intentKind?`, `flagId?`, `reviewedAt?`,
  `reviewedBy?`.

**Effort:** ~half to one session on top of `BU-flag` (or bundled
into BU-requests-vetting Phase 2 under Path A).

**Why parked, not built now:** depends on `BU-flag` (or Path A's
combined slice) for the queue infrastructure. Promote to brief
once BU-flag's path is decided.

**Owner:** Paul, surfaced during WhatsApp pattern review and Q-
discussion (2026-04-26).

---

## Call out a problem — content post intent (renamed tile 9)

**Status:** PARKED — most-developed of the WhatsApp-review
parking entries, brief-ready. The "highlight horrible content"
post type is the focus of the 2026-04-26 review and the closest
real-world post pattern we want to support natively.

**Origin:** WhatsApp pattern review, 2026-04-26 — specifically the
"🚨 ACTION IN MANCHESTER: ASDA CALLED OUT! 🚨" video post, which is
the canonical shape: hero media (video or photo) of a problem
happening in the world, an explainer body, an emoji-prefixed urgent
title, structured action steps, and hashtags.

**Renaming + reframing:**

- Old tile-9 name: "Flag a problem post" — ambiguous. Sounded like
  flagging an existing GPS Action post, which is the moderation
  primitive (see "Member flagging primitive" entry above).
- New name: **"Call out a problem"** (working title; alternatives
  include "Share & call to action", "Raise the alarm", or simply
  "Call out"). Decision deferred to copy-library review.
- This intent creates a **new post in the feed** about something
  problematic happening in the world — it does not flag any
  existing GPS Action content.

**Composer field shape (the differentiated bits vs the standard
post composer):**

| Field                                               | Rationale (from the WhatsApp examples)                                                                                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero media (image or video, with og:image fallback) | The Asda video and the Archway photo carry the post — text alone is materially weaker. Demo path: faked upload from a seeded set per the "Direct image upload" entry.                                                                        |
| Title with optional emoji prefix                    | The 🚨 pattern signals urgency without needing a separate "urgency" field. Compose-time UI suggests a small emoji palette but doesn't enforce.                                                                                               |
| Body (explainer of the wrong)                       | Plain text with bullet-list rendering (per the "Bullet-list rendering" entry above) so `- ✅ -` lines render as scannable lists.                                                                                                             |
| Actions[] (multi-CTA)                               | The Asda post had three: Watch & Share / Boycott / Speak Up. Real evidence for the multi-CTA trigger (see the multi-CTA entry). For demo: stay on the two-slot pattern (`activistMailerUrl` + `linkUrl`) until the multi-CTA refactor lands. |
| Optional location tag                               | "ACTION IN MANCHESTER: ASDA CALLED OUT" — location is part of the urgency. Likely reuses whatever region/proximity primitive lands per `region-and-proximity-decision.md`.                                                                   |
| Hashtags (parsed from body)                         | `#FreePalestine #BDS #BoycottIsraeliApartheid` in the Asda post. Phase 2 nav primitive — display-only at first, no hashtag-feed slicing yet.                                                                                                 |

**On-card rendering:**

- Hero media at the top — image or video thumbnail. Cards in this
  intent are visually heavier than standard post cards (cf. user's
  "much more colourful than our postcards").
- Optional urgent-marker visual treatment — a coloured top-rule or
  edge in the same family as the bordeaux cultural-marker
  (`#6B3045`) but in an action register. Static only — no flashing,
  no countdown timers (per design-philosophy.md principle 3, no
  anxiety amplification). A specific colour token is a separate
  decision; treat as TBD.
- "Reviewer-pending" pill while in the queue (see
  `autoRouteToReview` entry above) — small, subordinate.

**Auto-routing behaviour:**

- This intent's definition carries `autoRouteToReview: true`.
- Publishes live to the feed AND lands in the reviewer queue.
- Reviewer's job: confirm "this is real / this is fair framing /
  this isn't libel" and mark reviewed. Not gatekeeping — the post
  is already public.

**Demo scope (the focus):**

The demo-feasible cut needs only:

1. The renamed tile in the FAB picker ("Call out a problem"). Tile
   exists in D062's picker today under the old name — rename plus
   composer wiring.
2. Composer fields above (hero media via demo-stub upload, title
   with optional emoji palette, body with bullet rendering on the
   render side, two-slot actions, optional location text).
3. Card rendering with hero media + bullet-list body + urgent-
   marker top rule.
4. `autoRouteToReview` plumbing — on publish, post enters reviewer
   queue. Reviewer-pending pill on the card.

Out of demo scope (parked elsewhere):

- Multi-CTA `Action[]` — still two-slot for demo.
- Member flagging primitive — separate, parked.
- Hashtag nav — display-only, no slicing.
- Real S3 upload pipeline — demo uses seeded image set.
- Reactions reveal-on-hover — separate parking entry.

**BU shape:**

- Likely **`BU-callout`** (or rolled into a wider "media-rich post"
  BU). Depends on:
  - `BU-flag` (or Path A combined slice) for the reviewer queue
    infrastructure.
  - Direct-image-upload demo path landing first or alongside.
  - The bullet-list renderer can ship inline.

- Sequencing options:
  - **B1:** `BU-flag` → image upload (demo path) → `BU-callout`
    layered on top.
  - **B2:** combined media-rich-post BU that bundles image upload
    - bullet renderer + the renamed tile + autoRouteToReview
      wiring. Wider session.

Lean: B1, mirroring the BU-flag path-B preference — small slices,
clean deps.

**Schema sketch:**

- Post gains `heroImageUrl` (nullable) — survives the demo-stub
  upload swap to real S3 later.
- Post gains `intentKind` — already presumed present per D062 if
  the picker is wired through to the post (verify before brief).
- No new `Action` table yet — two-slot stays.

**Schema changes require an ADR** per project rules.

**Effort:** B1 sequence is roughly 3 sessions (`BU-flag` ~1,
image-upload-demo ~0.5, `BU-callout` ~1.5). B2 is roughly 2
sessions but each is denser.

**Owner:** Paul. Promote to a session brief once BU-flag path is
decided.

---

## Geocoding pipeline for post locations (Path B — follow-up to bu-calendar-near-me)

**Surfaced:** 2026-05-01 during bu-calendar-near-me (Path A).

bu-calendar-near-me ships with hand-coded coords on seeded events.
New posts created via the composer with a `location_text` value get
no coords today, so they don't appear in `/calendar?view=near` until
this BU lands.

**Scope when picked up:**

- Composer location field: free-text + an explicit `is_online` toggle.
  When `is_online=false` and the user submits, geocode the location_text:
  - UK postcode → postcodes.io
  - Other (street + city) → Nominatim/OSM (rate-limited; respect 1 req/s)
- Write `latitude`, `longitude` back to the Post on save.
- Backfill flow for existing user-authored posts (admin tool? scheduled job?).
- Privacy: members may not want coords; consider a "show on Near me" opt-in toggle in composer.
- Failure mode: if geocoding fails, post saves without coords; user is shown a soft warning.
- Edit page: same flow when location_text changes.

**Status:** PARKED — pre-build decisions still open (Nominatim ToS / opt-in default / coordinate precision rounding for privacy).
