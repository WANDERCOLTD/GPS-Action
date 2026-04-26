# GPS Action — Scenarios Library

_Lived-in walkthroughs for the things members, coordinators, and directors actually do. Each scenario is concrete enough to build against and honest enough to surface friction._

_Version: 0.1 · April 2026_

---

## How to use this document

Each scenario is a short prose story from one person's point of view, walking through a specific task end-to-end. The rule for writing one:

- **Name the person.** Sharon, Grant, Maya — not "the user."
- **Name the context.** Tuesday evening, in bed, on a phone.
- **Walk the steps.** What they see, what they tap, what appears.
- **Include the friction.** What's confusing, what takes a beat to find, what fails.
- **End where the task ends.** Success or give-up, both are valid endings.

When a scenario surfaces a feature that doesn't exist, either:

- Add it to the spec (if critical),
- Or park it (see Parking Lot document),
- Or explicitly flag the scenario as "this doesn't work yet" — useful for testing.

Scenarios feed session briefs. Every Claude Code session building a feature gets the relevant scenarios as reference material. It builds against the lived flow, not abstract requirements.

---

## Index

**Member scenarios**

1. Sharon sees a Sky News bias post and boosts it
2. Emma has a concern about leafleting at her child's school
3. David reacts to a Shabbat Shalom post
4. Rachel attends a local gathering — RSVP and follow-up
5. Michael loses his phone, needs to log in on a new device
6. Claire publishes an outcome post about a successful letter placement

**Writer scenarios** 7. Sharon (as writers lead) creates a Writers event 8. Grant drafts an urgent council-motion action post 9. Claire responds to a newspaper op-ed

**Coordinator scenarios** 10. Maya triages her flagged-content queue 11. Jeremy edits a miscategorised regional post 12. Sharon vets a new enrolment application

**Director scenarios** 13. Jeremy pins a network-wide urgent post 14. Jeremy reviews an escalated vetting case 15. Jeremy investigates a voucher's lineage

**Admin / operational scenarios** 16. Coordinator dispatches a Boost/Remove post to WhatsApp 17. System auto-comments on a closing campaign

---

## Member scenarios

### Scenario 1 — Sharon sees a Sky News bias post and boosts it

<!-- @no-code-yet -->

_Sharon, member, writers group lead. Sunday afternoon, on the sofa with tea._

Sharon is scrolling her GPS Action feed when she sees a post from Maya — a Sky News coverage complaint. The card shows a graphic with the Sky News logo and "ACTION ON ANTISEMITISM" in a corner. She taps the card to open the detail.

The post body explains: Sky News coverage of Gaza without mentioning Hamas or October 7th. Sky is regulated by Ofcom, obliged to maintain neutrality. The author (Maya, verified) has linked to an ActivistMailer page — click, sign, send.

Sharon wants to take the action AND boost it to her own networks. Two distinct things.

**Taking the action:** Sharon taps the primary button "Click — Sign — Send." This is a Phone? Email? No — it's an external link to ActivistMailer. The button says "Open ActivistMailer →" with a small external-link icon. She taps. ActivistMailer opens in a browser tab. She signs the pre-filled complaint, submits. Done in 30 seconds.

She returns to GPS Action. The post now shows "You've taken this action ✓" — her contribution registered. The cap-progress bar has incremented: "127 of 200 sent · 63%".

**Boosting to her WhatsApp networks:** Below the primary action, she sees a "Share to WhatsApp" button. She taps. A small sheet slides up: "Share this to WhatsApp — WhatsApp will open with the message pre-filled." She taps Continue. WhatsApp opens. The message is prepared:

```
From GPS Action — important Sky News complaint:
[link to public view of the post]
```

WhatsApp's recipient picker appears. She picks her local synagogue's group, pastes the message (already in clipboard), sends. Returns to GPS Action.

A quiet toast: "Shared · thanks!" The engage strip now shows "💬 2 groups · by you, Grant" (Grant dispatched earlier). Her participation is visible without being trumpeted.

**What the scenario surfaces:**

- The co-branding logo (Action on Antisemitism) appears _on_ Maya's post. Sharon sees it but doesn't need to do anything with it.
- "Click — Sign — Send" copy won't fit in the design system's button component — need to allow multi-phrase button labels
- Personal dispatch is separate from coordinated dispatch. Both coexist.
- Share-to-WhatsApp toast is reassuring, non-competitive tone ("thanks!" not "+1 dispatch counted")

**Friction found:**

- Will the ActivistMailer window return her to GPS Action? Browser behaviour. Maybe we need a "back to GPS Action" CTA on ActivistMailer's thank-you page (integration concern).
- Sharon didn't actually confirm whether her WhatsApp send happened. The toast trusts her. Is this enough for analytics? Flag: optional follow-up ping.

---

### Scenario 2 — Emma has a concern about leafleting at her child's school

<!-- @no-code-yet -->

_Emma, new member. Tuesday, walking home from school pickup. On her phone._

Emma has spotted people handing out anti-Israel leaflets at the school gate. She took a photo. She's panicking slightly — what does she do? She opens GPS Action.

She's newly verified; she's a bit nervous about posting. She taps the + button. Options: Quick Snap, Quick Add, Start a Post.

She taps Quick Snap. A simple flow: add photo (her school-gate photo), add 1-2 lines of context. She types: "Leaflets at my child's primary school this afternoon. Cheddar Road, Bristol. I'm worried."

**Post type selection:** The composer infers "Seeking action — information / suggestions" because she framed it as a question. She accepts. Confirms visibility (Bristol region auto-selected from her postcode).

She taps Publish. The post appears in the Bristol regional feed and national Volunteers Supergroup. Quietly.

**What happens next:** within minutes, Emma sees notifications:

- Sarah (Bristol member, verified): "Emma — first contact head teacher, calm tone, factual. I had this last year; I can share the template I used. 💕"
- David (Bristol coordinator): "Reviewing — I'll DM you in a minute with what the local team thinks"
- System: "📌 Pinned to Bristol region by David"

Emma opens the David DM. He's reassuring. He asks her to send him the photo direct. He walks her through: head teacher first, copy CST (she hadn't thought of that), document the leaflet, don't post the photo publicly (child safety).

Within 45 minutes she has a plan, a template letter, and someone holding her hand. The post on the feed serves its purpose — surfacing the issue, gathering suggestions, routing to the coordinator — but the actual coordination happens in DM.

**What the scenario surfaces:**

- Quick Snap → infers Seeking post type from framing. Good.
- Coordinator needs to DM the author quickly when posts involve child safety. The flag-queue workflow should prioritise "involves minors" posts.
- Emma's post contains a photo of the leaflet that maybe shouldn't be public. The system should prompt: "Photo contains possible child visibility — review before public?" Needs content-safety hint in composer.
- The top suggestion bubble (Sarah's advice) is visible on the post card — useful UI.

**Friction found:**

- Can Emma redact or hide her original photo after posting, once David advises? Edit permission for her own content within window, yes. After window, needs coordinator help.
- How does Emma know to trust Sarah's advice? Verified tick helps. But a new member may not know what "verified" means. Needs light onboarding: "Members with ✓ have been with us for over 6 months in good standing."

---

### Scenario 3 — David reacts to a Shabbat Shalom post

_David, member, 4 months in. Friday 18:40. At home, candles already lit._

David checks GPS Action on his phone for the last scroll before turning it off. A post at the top: "Shabbat Shalom" — the official GPS account post with a gentle gradient, a candle illustration, warm copy.

He taps the reaction pill, picks 🕯️ and 🙏. The reaction appears. The system doesn't congratulate him or count his streak — it just accepts the reaction quietly.

He scrolls down. The filter at the top says "Discussion" — he sees Sharon's warm reply, David T's "Shabbat shalom all 💕", a Rabbi from Hendon's blessing. No system events.

He closes the app. Two minutes of connection, no friction.

**What the scenario surfaces:**

- Community/Shabbat posts need the "no system events" experience by default
- Reactions are quiet and multi-select — he picked two without effort
- The warmth of the content matters more than the functionality

**Friction found:**

- None, really. This scenario is about verifying nothing gets in the way.

---

### Scenario 4 — Rachel attends a local gathering — RSVP and follow-up

<!-- @no-code-yet -->

_Rachel, member in Leicester. Thursday evening, on her laptop at the kitchen table._

Rachel sees a post in her feed: "Leicester solidarity gathering — Saturday 2pm" by the Leicester coordinator. It's an Event type post. Card shows a venue photo, date, address, a map thumbnail, and an "I'll come →" button.

She taps "I'll come." A small modal: "You're coming! We'll save you a space. Anyone coming with you?" with optional "+1" or "+2" counter. She's bringing her teenage daughter; selects +1. Taps Confirm.

The button on the card now reads "You're coming · +1 · Change". She can tap to update if plans change.

**Saturday after the event:** Rachel opens the app. The original post has been updated — the coordinator posted an Outcome comment: "32 of us came. Great to see so many new faces. Photos posted separately in the Leicester group chat (not here — privacy for attendees' kids)."

The post's system-comment area shows: "✓ Event concluded · 34 RSVP / 32 attended." Rachel reacts 💕 to the thank-you comment. Done.

**What the scenario surfaces:**

- RSVP is bound to the post, not a separate booking system
- Post-event update keeps the thread alive; outcome is a coordinator action
- Photos of children's events need privacy — may need to stay off GPS Action entirely, even members-only
- System comment "Event concluded" is appropriate; default filter (Discussion) would hide it unless she switched to All

**Friction found:**

- The system tracked 34 RSVP but only 32 attended. Who recorded actual attendance? Coordinator manually? Or just an estimate? Needs a clear data model.
- What if Rachel booked but can't come? Cancel RSVP reduces the count. System handles, but does it notify the coordinator? Probably for small events, yes.

---

### Scenario 5 — Michael loses his phone, needs to log in on a new device

<!-- @no-code-yet -->

_Michael, member 18 months in, moderately tech-savvy. Saturday morning, panicked — phone lost at a wedding yesterday._

Michael buys a new phone, restores from backup. GPS Action app is there, opens, asks him to log in. He enters his email and password. GPS Action says: "We've sent a verification code to your phone." But his phone is gone.

Options visible: "I've lost access to my phone." He taps.

A new screen: "To verify your identity, we'll DM you in the app asking your coordinator to help. Can you remember your coordinator's name?" He types "Grant." Confirm.

A message appears: "Grant has been notified. He'll verify your identity and help you regain access." Michael also receives an email to his registered address confirming the recovery request was made.

**Grant's side:** Grant opens GPS Action, sees a notification in his admin inbox: "Michael Levy (verified member 18 months) has requested account recovery — lost phone. Verify and restore 2FA?" Grant calls Michael directly (they know each other's voices). Verifies. In the admin UI, Grant taps "Issue 2FA reset — send recovery link." Michael receives an email with a one-time link to set up 2FA on his new phone.

15 minutes later Michael is back in.

**What the scenario surfaces:**

- Account recovery must exist, not an afterthought
- Coordinator is the trust anchor for recovery — no central password-reset flow that could be social-engineered
- Email as confirmation channel is necessary even though it's secondary
- Voice/phone verification between member and coordinator is the out-of-band check

**Friction found:**

- What if Michael doesn't know who his coordinator is? Needs a fallback: "request recovery, wait for any director to respond."
- What if the lost phone is compromised (stolen, not just lost)? The recovery flow needs to invalidate the old device's sessions. This is critical.
- Timing: 15 minutes is the happy path. What if Grant's out of reach? Need an escalation timer — after X hours, other coordinators or directors get notified.

---

### Scenario 6 — Claire publishes an outcome post about a successful letter placement

<!-- @no-code-yet -->

_Claire, writer, Nottinghamshire. Monday 09:15 — she just got the email._

Claire wrote to the Nottingham Post about an inaccurate op-ed. The paper published her letter. She wants to share the win.

She opens GPS Action. Taps +. Picks "Start a Post" from the FAB menu.

Post type: she picks "Outcome." Title: "Nottingham Post published my letter." Body (Georgia font, comfortable): a paragraph about the original op-ed, her letter, the publication, a link to the published letter.

She picks tags: Nottinghamshire, Media. Attribution: GPS Action (default). She doesn't co-brand.

She taps Publish. The dispatch modal appears: system matched routes — "NEWS – WRITTEN & POSTED" (always for Outcome Writers posts) and "Volunteers Supergroup" (optional, wider reach). Both pre-ticked.

She self-dispatches to both. WhatsApp opens to NEWS – WRITTEN & POSTED, paste, send. Returns. WhatsApp opens to Volunteers Supergroup, paste, send. Returns.

Confirmation prompt: "Did you send? ✓ Yes to both." She confirms.

The post appears in the feed with a "💬 2 groups · by Claire" indicator. Soon: reactions flow in. 🎯, 💪, ❤️. Sharon comments: "Brilliant work 💕". System comment appears (in Activity filter): "✓ Verified by Sharon · 09:22".

**What the scenario surfaces:**

- Outcome posts have simple, well-defined routes
- Writer pride moments deserve lightweight celebration, not heavy gamification
- Self-verification by the writers' lead shortly after publish

**Friction found:**

- The two WhatsApp round-trips take a minute. Is that acceptable? Yes — the sharing is the point, one paste each is fine.
- She didn't attach the original letter as a PDF. Should the composer prompt "Add the letter as evidence"? Useful for record-keeping. Worth adding as optional.

---

### Scenario 18 — Eddie writes his first post (the demo flow)

_Eddie, member, two weeks in. Tuesday lunchtime, sat at his kitchen table with a cup of tea. He has just spotted a useful Activist Mailer campaign about a council motion in Camden and wants to share it with the network._

Eddie opens GPS Action on his laptop. He's already logged in (the dev login from `/dev/login` selected him last session). The feed loads with about 18 seed posts in chronological order — Sharon's writing, a couple of older outcome posts, a Shabbat Shalom from Friday. He scrolls briefly. Nothing he'd add to. He has his own thing to post.

Top of the feed there's a "New post" link. He clicks it. The page changes to `/compose`. A form appears with three fields and a publish button. The fields are clearly labelled — title, body, "Activist Mailer URL (optional)." The composer is plain — no FAB cards, no intent picker, no template gallery. Per the brief, this is the stepping-stone composer; the full FAB experience comes later (BU-composer-fab).

**Eddie types his title:** "Camden council BDS motion — campaign live." He tabs to the body and writes a paragraph: what the motion proposes, when it's being debated, why it matters. Three or four sentences. He tabs to the AM URL field and pastes the campaign link he had on his clipboard. The field accepts it. There's no preview pane — the composer trusts him to know what he's pasted.

He clicks Publish. There's a brief loading state on the button, then the page redirects back to `/feed`. His post is at the top. The card shows his name, the time ("just now"), the title, the body, and an "Open in Activist Mailer" button that PostCard rendered because the `activistMailerUrl` is present.

He clicks the AM button. A new tab opens to the campaign page. He verifies it's correct. He closes the tab and returns to GPS Action.

His post is still there. No reactions yet — it's been less than a minute. He'll check back later.

Total elapsed time: under three minutes from "I should share this" to "it's shared." That's the point.

**What the scenario surfaces:**

- The composer is intentionally simple. Three fields, one button. Anything more is BU-composer-fab territory.
- The "New post" link from the feed is the entry point. There's no FAB on the demo flow yet — the FAB lives in the future composer.
- AM URL handling is already done in `components/PostCard.tsx` from BU-feed; BU-composer just needs to put a value in the field and trust PostCard to render the button.
- The post lands at the top because the feed orders by `createdAt DESC`. No live update or websocket — just a server redirect after the mutation, and the next render shows it.
- The dev login flow is in play. In production this would be real auth; for the demo, `/dev/login` is sufficient.

**Friction found:**

- No draft auto-save. If Eddie closes the tab mid-compose, his work is gone. Acceptable for the demo (it's a 3-field form and posts are short) but a real concern for the post-demo composer. Drafts go in BU-composer-fab's scope per the existing parking-lot notes.
- No URL validation feedback in the composer beyond Zod's pass/fail on submit. Eddie won't know his AM URL is malformed until he tries to publish. Per `bu-composer.md` the AM URL field has inline validation feedback; verify in the click-through.
- No preview. Eddie doesn't see what the card will look like before he publishes. For the demo, fine. For the FAB composer (BU-composer-fab), live preview is in scope per D044.
- No success toast or confirmation copy after publishing — the redirect to feed-with-his-post-at-top is the implicit confirmation. Honest and minimal; possibly too quiet. Worth testing with real members.
- The "New post" link is just a link, not a button. On mobile, a thumb-reachable FAB will be the eventual entry point. The demo uses a link because it's simpler and the FAB belongs to BU-composer-fab.

**What this scenario does NOT cover:**

- Visibility selection (the demo's posts are all `members_only` per the bu-composer brief defaults; per-post visibility override is D045 and lands later).
- Region tagging, group tagging, intent selection — all deferred to BU-composer-fab per D041, D043, D044, D048.
- Cancel-and-discard flow. The demo's composer has no Cancel button visible in the brief — Eddie either publishes or navigates away. Worth adding `compose-newpost-cancel` testid for the eventual cancel button when it lands.

## Writer scenarios

### Scenario 7 — Sharon creates a Writers event

<!-- @no-code-yet -->

_Sharon, writers lead. Thursday morning, planning Monday's Writers session._

She needs to announce next Monday's event to the Writers team. Opens GPS Action, taps +, picks "Start a Post."

Post type: Coordination (internal, team-focused). Sub-type: Event. Title: "Monday Writers — council-response practice." Date: next Monday 19:00. Duration: 90 min. Host venue: Zoom link.

Composer prompts her: "This is a Coordination post — restricted visibility. Who sees it?" She picks "Writers team" from a dropdown. The post won't show in general member feeds.

Action type: "Join a meeting." She pastes the Zoom link. The composer autopopulates a "Join meeting" button that will open the Zoom URL at the scheduled time.

She publishes. Dispatch modal: matched routes are NEWS – WRITERS ADVICE (team group). Not the member-facing Writers group. She dispatches to it.

On the card: the Join meeting button is disabled until Monday 18:45 (15 min before). Closer to time, it activates and members can tap to join.

**What the scenario surfaces:**

- Coordination posts have audience selection. Not all posts go to all members.
- Join-a-meeting action type: Zoom/Meet/Teams link; button has time-based activation
- Routing matrix differentiates Writers internal (Advice) from Writers member-facing (Written & Posted)

**Friction found:**

- How does a member who joined the Writers team later see the Monday event? If they weren't in the feed when it was posted, do they get a "pinned" version? Worth: upcoming events pinned until they happen.

---

### Scenario 8 — Grant drafts an urgent council-motion action post

<!-- @no-code-yet -->

_Grant, coordinator East Midlands, also a writer. Thursday 14:00 — just saw the motion in tomorrow's Derbyshire CC agenda._

Grant opens GPS Action, taps + → Start a Post → Urgent action → Councillor-email action.

He uses a template: "Derbyshire CC — [MOTION TYPE] motion, [DATE]." Fills in: BDS, tomorrow 19:00. Body: explains the motion, stakes, specific councillors' positions.

Action type: Councillor Email. The composer prompts him to pick target councillors. A picklist of Derbyshire CC councillors (from the Contacts directory). He picks the 15 members of the relevant committee. Pre-writes the email subject and body. The email template uses merge fields: {{councillor_first_name}}, {{council_name}}.

Expiry: 18:00 tomorrow (before the vote). Cap: 50 (he wants at least 50 members to email each councillor).

Region: East Midlands + Derbyshire-specific. Tags: Councils, BDS, Urgent.

He publishes. Dispatch modal appears. Matched routes: Action Network!, East Midlands region group (if it existed — flagged), LA Team, BDS topic, Derbyshire-specific if route exists.

He adjusts: unticks BDS (too broad), keeps Action Network + LA Team. Self-dispatches to both.

On the feed, the post shows as Urgent with a countdown timer ("18 hours remaining"). Cap-fill bar starts empty.

**What the scenario surfaces:**

- Template-driven composition for recurring action types
- Councillor picklist pulls from Contacts directory
- Merge fields for per-recipient personalisation (per SRS §14)
- Urgent posts with countdown timers get different visual treatment
- Cap-fill bar is a progress indicator

**Friction found:**

- What if the Contacts directory doesn't have all Derbyshire CC councillors? Grant has to add them. Contacts directory needs a quick-add from composer.
- The 15 target councillors need individual merge. Behind the scenes: 15 separate emails queued? Or one dispatch that fans out? System design detail.

---

### Scenario 9 — Claire responds to a newspaper op-ed

<!-- @no-code-yet -->

_Claire, writer. Sees the op-ed in the morning Guardian._

Opens GPS Action, but notices Maya has already posted about this op-ed with a call for responses. Claire doesn't need to create a new post; she engages with Maya's.

She taps the post. Maya's post says: "Guardian op-ed by X — biased framing on Gaza. Responses wanted. Here's a template draft — customise and send to response@guardian.co.uk."

Primary action: "Write a response." Tap opens a form inside GPS Action (not a browser). A textarea pre-filled with the template. Claire customises — two paragraphs, her own angle. Before sending, she can preview.

She taps Send. GPS Action opens her email client with the response pre-filled (To: response@guardian.co.uk, subject, body). She taps Send in her email client. Returns to GPS Action.

"✓ Response sent — thanks!" Post cap-fill increments.

**What the scenario surfaces:**

- Email action type opens pre-filled email, not a web form
- Writers can customise before send
- Confirmation is honest — we trusted her send, no verification
- Template-based composer reduces writing fatigue

**Friction found:**

- Gmail/Outlook/default email apps handle pre-fills differently. Need testing across mail clients.
- Her draft doesn't save if she bounces. Should composer state be preserved if she leaves and returns?

---

## Coordinator scenarios

### Scenario 10 — Maya triages her flagged-content queue

<!-- @no-code-yet -->

_Maya, Tower Hamlets coordinator. Monday morning, coffee and laptop._

Maya opens GPS Action on desktop. Left sidebar shows admin items. She taps "Flag queue — 6 pending."

Each item shows: post preview, who flagged it, why, time since flag.

Item 1: a member flagged a post as "harmful rhetoric." The post is an outside share — a tweet quoted as evidence. Maya reads it. The context is: member shared it as "look what's being said" for amplification awareness. Not harmful from the author; it's showing adversary content. Maya taps "Dismiss flag · add context note." Writes: "Post is documenting adversary content, not amplifying it. Note to flagger added."

Item 2: a post mentions a specific child's school by name and has a photo where children are partially visible. Maya flips into action. She taps "Escalate — child safety." Director Jeremy is notified. Maya DMs the author to explain: we need to blur or remove the image, can you do it now or should I? Author responds in 3 minutes. Image removed. Post edited, "edited by Maya — removed photo for child safety" label visible. Author notified of change. Audit entry created. All in 15 minutes.

Item 3: a post from a brand new member with links to what looks like a separate campaign's branding. Maya checks — the member hasn't declared an affiliation. Does the branding represent them, or is it unauthorised? She DMs them. "Are you affiliated with [partner org]? We have a way to co-brand posts properly; let me walk you through." Ends up a welcome conversation, not a problem.

She clears three items in 20 minutes. Three others need follow-up today.

**What the scenario surfaces:**

- Flag queue is a real daily tool, not a rare edge
- "Dismiss with note" is as important as "remove" — explains to flagger
- Child-safety escalation is a specific workflow
- Admin DM integrates with flag resolution
- Brand impersonation is a real concern — co-branding feature needs verification

**Friction found:**

- Maya works on desktop. The sidebar admin layout matters. Mobile admin is secondary but must exist for on-the-go moments.
- She doesn't want to lose her place if she navigates away mid-triage. Queue state must persist.

---

### Scenario 11 — Jeremy edits a miscategorised regional post

<!-- @no-code-yet -->

_Jeremy, director. Late evening, checking the network on his iPad._

He sees a post tagged "Bristol" but the content is about Brent (London). Clear mistake — the member typed Bristol when they meant Brent. The post is getting dispatched to the Bristol region feed.

Jeremy opens the post. Taps the kebab menu (⋯). Options: Edit metadata, Edit content, Pin, Feature, Remove, Audit history.

He taps Edit metadata. A form shows the current fields with edit-indicators. He changes Region from "Bristol" to "Brent." Below: "Why are you making this change? (required for audit)" — he types "Author typed wrong region — corrected."

He saves. The post updates; it now routes to the correct Brent feed. The author receives a notification: "Jeremy corrected your post's region: Bristol → Brent. Audit note: Author typed wrong region — corrected. Let me know if this was wrong."

Thread auto-comment (filtered out by Discussion default): "🔧 Region corrected Bristol → Brent by Jeremy · 22:14".

Author later sees, understands, says thank you. No ill feeling.

**What the scenario surfaces:**

- Metadata edits are common and need to be low-friction
- Required justification for edits keeps the audit trail useful
- Author notification is real-time, not surprised-weeks-later
- Auto-comment is filtered out of default view but visible to those who care

**Friction found:**

- What if the author objects? There's a formal "object" flow. But for most cases, gentle notification + audit is enough.
- Speed matters: Jeremy expects this to take 15 seconds, not 2 minutes.

---

### Scenario 12 — Sharon vets a new enrolment application

<!-- @no-code-yet -->

_Sharon, vetter (she's a writer with the vetter permission flag). Wednesday evening._

Opens the Vetting queue. "New: 2, In progress: 1, Awaiting voucher: 3."

She picks a new case. Details: Anna (surname), Bristol, postcode, named Grant as voucher, social media link, age confirmed, consent checked.

Sharon checks the social media link — Anna looks like a real person, community-connected, not fake. She taps "Resolve voucher." Picklist opens. She searches "Grant" — sees three Grants, picks "Grant Spencer (East Midlands coordinator, 3 years, vouched 12, all in good standing)." Confirms.

System sends Grant an in-app DM prompt: "Anna has applied naming you as voucher. Will you stand for her?" with Yes/No/Discuss buttons.

30 minutes later, Grant responds Yes. Case status updates to "Awaiting vetter decision." Sharon sees, taps Approve. Required summary: "Anna verified — Grant stood for her, social media consistent, Bristol local with community ties. No concerns."

Anna gets an approval email with a signup link. The vouch ledger gets a new entry: (voucher: Grant, applicant: Anna-new-user-id, vetter: Sharon).

**What the scenario surfaces:**

- Picklist context (tenure, past vouches, own voucher) is crucial for vetters
- Voucher confirmation flow is asynchronous — Sharon doesn't block waiting
- Required summary at approval produces auditable decisions
- The vouch ledger entry is created at approval, not at application

**Friction found:**

- What if Sharon leaves the case mid-way and the voucher responds No? Who re-picks it up? Needs status indication: "case awaiting decision."
- What if the voucher doesn't respond in 7 days? Escalation to director.

---

## Director scenarios

### Scenario 13 — Jeremy pins a network-wide urgent post

<!-- @no-code-yet -->

_Jeremy, director. Thursday evening — major news just broke._

A significant event has happened (some example: a BBC piece). Multiple members have posted reactions. Jeremy wants to consolidate — lift one good post to the top.

He finds the best post (Grant's analysis + action ask). Opens the kebab menu. Taps Pin → National.

Options: Pin to all regions, or specific. He picks All. Duration: default 48h (shorter than the 7-day member/coordinator default because it's about a news event). Auto-expires Saturday evening.

The post now shows "📌 Pinned network-wide" at the top of everyone's feed, above chronological. Members landing on the app immediately see it.

System auto-comment on the post: "📌 Pinned network-wide by Jeremy — 48h." Members who had reacted see a notification that the post was pinned (a subtle signal of endorsement).

**What the scenario surfaces:**

- Director pins supersede coordinator pins
- Pin has a scope (National vs regional)
- Duration is configurable with sensible defaults
- Auto-expiry prevents stale pins
- Members get notified when their reacted post is pinned (optional notification)

**Friction found:**

- What if the post author is a coordinator who'd already pinned it regionally? Does national override or stack? National supersedes, the regional pin becomes redundant but is preserved in history.
- Discovery: members need to know their feed has new pinned content without jarring.

---

### Scenario 14 — Jeremy reviews an escalated vetting case

<!-- @no-code-yet -->

_Jeremy, director. Tuesday morning._

An applicant was escalated to director by a vetter because the named voucher said No. The applicant has re-nominated: "Actually I mean Miriam, not Sharon."

Jeremy opens the case. Reads the vetter's discussion thread — Sharon made notes, original voucher refused, applicant responded.

Jeremy decides to look deeper. He taps into the applicant's social media link. Public profile, looks fine. Back to case. Taps "Lineage check" on Miriam (the re-nominated voucher). System shows: Miriam was vouched by Rebecca, who was vouched by David (founding member). Clean lineage. Miriam has vouched for 4 others, all in good standing.

Jeremy confirms the re-nomination, sends a prompt to Miriam. Miriam responds Yes in 20 minutes.

Jeremy approves with summary: "Re-nominated voucher confirmed. Clean lineage. Applicant's social presence verified as consistent with values."

**What the scenario surfaces:**

- Director has the "lineage check" tool; coordinators don't
- Re-nomination flow is supported
- Decision summary is required even at director level
- The vouch graph is a useful investigative tool, not ornamental

**Friction found:**

- "Lineage check" needs good UX. A list? A tree? A path from founder?
- What if Miriam says No too? Third attempt? At some point, decline gracefully — no hard limit but explicit director discretion.

---

### Scenario 15 — Jeremy investigates a voucher's lineage

<!-- @no-code-yet -->

_Jeremy, director. Friday — just got a flag from Sarah that David M (member) may have posted something problematic._

Jeremy needs to understand David's trust context before deciding.

Opens David's profile. Admin view shows:

- Member since: Feb 2026 (3 months)
- Vouched by: Miriam Klein (Nov 2024 · 4 vouches, all in good standing · vouched by Rebecca)
- Has vouched for: 0 (he's new)
- Activity: 23 posts, 12 actions taken, 2 flag incidents before this one (one dismissed with note)

"2 flag incidents before this" catches his eye. He taps into them. First: a dismissed complaint from a different member — Sharon's note explains it was unwarranted. Second: a warning issued about tone. Context: escalated exchange in a comment thread.

Jeremy decides: not immediately actionable but watch. He makes a private admin note (visible to coordinators+) on David's profile: "Track — tone concerns. Two priors. Watch this week's activity."

He DMs Maya (the flagger) to explain his approach. Maya appreciates it.

**What the scenario surfaces:**

- Admin profile view is structured, not just raw logs
- Flag incident history is preserved with outcomes
- Private admin notes on profile are coordinator-visible but hidden from member
- Director's time is protected — he makes a note, doesn't take immediate action, follows up

**Friction found:**

- Admin notes on profiles need privacy rules. Members shouldn't see these. Ever. But if subpoenaed? Lawful basis for retention?
- "Track — watch this week" is a follow-up task. Does Jeremy get a weekly digest on this? Or does he need to remember? Tasks/follow-ups system might be needed.

---

## Admin / operational scenarios

### Scenario 16 — Coordinator dispatches a Boost/Remove post to WhatsApp

<!-- @no-code-yet -->

_Grant, coordinator. Wednesday 09:00._

A member has just published a Boost post — a positive X post from a Jewish MP that deserves amplification. Grant saw it in the dispatch queue (the member skipped self-dispatch).

He opens the dispatch queue. Sees the post. Matched route: "Network Tick or Cross" channel. Tap Send. Message pre-formatted: "✅ [link to the tweet]." Clipboard populated. WhatsApp opens to the channel.

He pastes. Sends. Returns to GPS Action. Confirmation prompt: "Sent? ✓ Yes." Queue item disappears. Dispatch record logged: "Grant dispatched to Network Tick or Cross · 09:04."

The post in the feed now shows dispatch indicator: "💬 1 group · by Grant."

Original author (member) gets a notification: "Grant dispatched your post to the Boost/Remove channel. The team will action it on X shortly."

Total elapsed time: 25 seconds.

**What the scenario surfaces:**

- Fallback dispatch (when author skipped) is fast and seamless
- Dispatch record attribution is clear: dispatcher, not author
- Author is told their post was acted on
- The chain: member posts → skip → coordinator dispatches → WhatsApp team amplifies → X gets retweets

**Friction found:**

- What if two coordinators both see the queue and both dispatch? Race condition. The first dispatch "claims" — the queue item disappears for the second.
- What if the clipboard fails (some OSes)? Fallback: show the message inline with a copy button.

---

### Scenario 17 — System auto-comments on a closing campaign

<!-- @no-code-yet -->

_A post created days ago approaching its cap and expiry. The author is Grant._

The campaign is: "Email Derbyshire CC councillors before tomorrow's vote." Cap was 50. It's 19:45, vote starts at 20:00. 48/50 sent.

**19:45** — System detects threshold: 75% cap reached + approaching expiry. Auto-comment inserted (Activity filter visible): "⏱ 48 of 50 sent · 2 remaining · vote in 15 min."

**19:52** — Another member sends, cap reaches 49. Auto-comment: "49 of 50 sent · 1 remaining."

**19:56** — Member Sarah sends. Cap hits 50. Auto-comment: "🎯 Cap reached: 50 of 50 sent."

**20:00** — Expiry reached. System auto-comment: "✅ Campaign closed — 50 emails sent, vote underway."

Grant gets all these as notifications (he's the author). Members who reacted get the 🎯 notification (they're watching).

**20:45** — Grant's been told the result informally (the motion was defeated). He posts an Outcome comment on the campaign post: "🎉 Motion defeated 18-12. Thanks to everyone who wrote. Real impact."

Some members scrolling back see Grant's thank-you, react 🎯💪❤️.

**The next morning** — Grant creates a new Outcome post summarising the win. Cross-linked to the original campaign post. The lifecycle is complete.

**What the scenario surfaces:**

- Auto-comments at milestones (75%, 100%, closure) are useful without being spammy
- Default filter (Discussion) hides them; Activity filter shows them
- The member-authored outcome comment is the human story; system comments are the data layer
- Cross-post linking (outcome refers to original action) is a pattern

**Friction found:**

- Who's watching to see those 19:45 alerts? System notifications for Grant — yes. Members? Opt-in per-post "watch this" would be useful.
- The auto-comment at 75% could arrive at an awkward time (19:45 = mid-family-dinner). Rate limiting and quiet-hours respected.

---

## Writing more scenarios

This library seeds the build. More scenarios should be added as:

- New features land in the spec
- Real pilot behaviour surfaces patterns we hadn't imagined
- New roles appear (e.g. partner-org coordinators)

Each new feature added to the spec should come with at least one scenario. "We built dispatch" isn't enough without "here's how Sharon uses dispatch on a Sunday afternoon when she's tired."

Rules for new scenarios:

- Name the person
- Name the moment
- Show the happy path
- Show the friction
- End honestly (success or give-up)
- Don't skip steps
- Don't hand-wave

The scenarios are your lived-in proof that the product works. Treat them as canonical.

---

# Scenario 19 — Sharon shares a Guardian article

_Append to `docs/product/scenarios.md` between Scenario 18 and the
"Writer scenarios" section, OR keep as a standalone file at
`docs/product/scenarios/scn-19-sharon-shares-guardian.md` if the
team is migrating to per-file scenarios._

_Author: Paul · Status: Draft · Build unit: BU-link-share_

---

### Scenario 19 — Sharon shares a Guardian article with a preview card

<!-- @no-code-yet -->

_Sharon, member, writers group lead. Sunday morning, in the kitchen
with toast and tea. Her phone is on the counter._

Sharon has just read a Guardian article on a new bill going through
Parliament. It's a piece worth her network seeing — clear analysis,
not a hot take. She wants to share it on GPS Action so the writers
team and the wider feed can pick it up.

She opens GPS Action on her phone. She's already logged in. The feed
loads — about 20 posts including yesterday's Shabbat Shalom from
Cary, Eddie's council vote action call, a couple of news shares
from Bette. The feed feels alive — text posts, action calls, a
remembrance reflection.

She taps "New post". The composer opens. The familiar four fields
are there — title, body, AM URL, visibility — and below them a new
toggle: **"Share a link?"**

She taps it. The composer expands to show:

- **Link URL** — where she pastes the Guardian article URL
- **Title** — defaulted to a placeholder, she can override
- **Description** — short summary
- **Image URL** — picture from the article (optional)
- **Site name** — defaulted to "The Guardian" once she's pasted

She pastes the article URL. The fields stay empty — there's no
auto-fetch yet (per the brief, this lands later as a separate
feature). She types the article's title herself: "Bill X passes
second reading — what it means". She types a 30-word description:
"The bill changes how Y works. Worth reading before tomorrow's
committee debate." She pastes the article's hero image URL.
The site name field auto-suggests "The Guardian" from the URL host.

For her main post body, she writes two short paragraphs:

> If you're tracking the bill, this piece is the clearest summary
> I've seen. Worth reading.
>
> The committee meets tomorrow. Will write properly later.

Title: "Worth reading — Guardian on Bill X."
Visibility: public.
No AM URL — this is a share, not an action.

She taps Publish. The page redirects to /feed. Her post is at the
top. The card now renders:

- Author: Sharon Whitfield (writers lead label)
- Time: just now
- Title: Worth reading — Guardian on Bill X
- Body: her two paragraphs
- **A link card below the body**: a small image, the article title,
  the description, and "The Guardian" as the source label

The link card is clearly part of the post but visually distinct —
a slightly different background tone, rounded corners, the image
on the left or top. It looks like a Twitter/Bluesky link preview,
calmer.

She taps the link card. A new browser tab opens to the Guardian
article. She closes it. Returns to GPS Action. Her post is still
there. Cary has already reacted — a small heart icon next to the
card.

Sharon scrolls through the feed once more. She notices Bette's news
share from yesterday now also has a link preview — the retrofit
has made the feed visually richer than it was last week. The text-
only posts still feel right; the link-share posts add depth.

Total time from "I should share this" to shared: about 90 seconds.

---

**What the scenario surfaces:**

- The link-share post is a NEW post type, not a transformation of
  the AM URL field. AM URLs are for action campaigns; link URLs
  are for shared content. They coexist on the schema; the composer
  shows both
- The composer doesn't auto-fetch — this is deliberately scoped out
  of v1. Sharon types the metadata. The doc captures this honestly
- Link cards are visually distinct from the post body but clearly
  part of the same post — designed to read as "Sharon thought this
  was worth sharing"
- The 5 fields (URL, title, description, image, site name) are all
  optional except URL — if Sharon pastes only a URL, the card shows
  just the URL with a fallback domain label. Better with metadata,
  fine without
- Site name auto-suggests from the URL hostname — small UX touch
  that makes the form feel less robotic
- Reactions appear quickly (Cary's heart) — see Scenario 3 for
  reactions specifically

**Friction found:**

- Auto-fetch is the obvious next move. Members will expect it.
  Pasting a URL and watching the fields auto-fill is the 2026
  default expectation. The honest answer for now: parking-lot,
  next-iteration. But it's friction users will report
- Image URLs are tricky — Sharon has to right-click-copy from the
  Guardian's own page. Mobile users can't easily do this. Mobile
  paste of an image URL will be the rough edge. Possibly skip the
  image rather than fight with it
- The "Site name" field is the most expendable; "The Guardian"
  appears in the card whether the field is filled or not. Could be
  derived from the URL host alone. Surface this as a possible
  simplification
- Sharon didn't see a preview of the link card before publishing —
  she trusted the form. A small preview pane would be nice. But
  for v1, the form is plain. (D044 has FAB composer with live
  preview as the eventual replacement — that's BU-composer-fab)
- If a member shares the same URL twice (or two members share
  the same Guardian article), each post gets its own card metadata.
  No deduplication or shared preview cache — that's the LinkPreview
  separate-model approach we explicitly skipped. Future work
- The "Share a link?" toggle below the AM URL field could confuse:
  is the AM URL a link too? In the composer the field labels make
  it clear (AM URL = "for action campaigns"; link URL = "for
  articles, posts, videos"). Worth verifying with real users

---

**What we're NOT doing in BU-link-share:**

- Auto-fetching Open Graph metadata from the URL — Sharon types
  it manually. The auto-fetch lands as a separate BU because it
  needs careful security thinking (SSRF, timeouts, caching)
- A separate `LinkPreview` table for shared metadata across posts.
  Each post has its own copy
- Rich-media embeds (Twitter cards, YouTube players, podcast
  embeds inline). Just metadata + image URL renders as a card
- Link click tracking. Sharon tapping the card opens a new tab;
  we don't track who clicked
- Validation that the URL is reachable. The composer accepts any
  https URL with a valid format. If it 404s on click, that's the
  user's problem
- Edit/re-fetch if the URL changes after publishing. Static
  metadata
- Sharing private/internal URLs. Out of scope
- Per-post visibility specifically for link-share posts. Uses the
  existing `visibility` field (public / authenticated_only)

---

**How we'll know it worked (acceptance criteria):**

- I can log in as Sharon (or Eddie or any seeded member)
- I can navigate from /feed to /compose
- I see a "Share a link?" toggle in the composer
- Tapping it expands 5 fields: link URL, title, description, image
  URL, site name
- I can publish a post with link metadata
- After publishing, my post appears at the top of /feed
- The post card renders a link preview card below the body, with
  the title, description, image (if provided), and site name
- Tapping the link card opens the URL in a new tab
- A post WITHOUT link metadata renders as before (no card, just
  text + AM button if present)
- Mixed posts (text + AM URL + link card all present) render
  correctly: body, link card, AM button in sensible order
- Validation: link URL must be https; field rejects http and
  malformed URLs
- 4-5 hand-crafted seed posts have link previews with realistic
  metadata so the demo feed shows visual variety from the start

---

**Open questions:**

- Where does the link card sit visually — above the body, below
  the body, or to the side? Recommend below body, above AM button.
  CC will surface in BU-link-share execution
- If the image URL fails to load (broken image), what's the
  fallback? Show the card without the image? Show a placeholder
  icon? Recommend show without image, maintain card structure
- Should the link card have its own click target separate from
  the post body? Recommend yes — the whole card area is tappable
- Should the post body still be rendered if a link card is
  present? Yes — the body is the member's commentary, the card is
  the shared content. Both belong
- Can the same post have BOTH an AM URL and a link URL? Recommend
  yes — a post about "this Guardian article describes the issue,
  here's the campaign to act on it" is a real pattern. Both render

---

**Related:**

- ADR D045 — visibility defaults
- ADR D048 — post types (this is a soft type, not the formal
  PostType enum that's deferred)
- Scenario 1 — Sharon boosts a Sky News post (action variant)
- Scenario 6 — Claire publishes an outcome post (different post
  shape entirely)
- Scenario 3 — David reacts to a Shabbat Shalom post (reactions on
  any post type)
- Scenario 20 — Eddie writes his first comment on Maya's post (the
  comment-write flow + post-detail page UX)
- `docs/product/parking-lot.md` — auto-fetch OG metadata,
  multi-mailer URL allowlist

---

**Implementing code (filled in by engineers post-build):**

- `prisma/schema.prisma` — adds `linkUrl`, `linkTitle`,
  `linkDescription`, `linkImage`, `linkSiteName` fields to Post
- `shared/validation/post.ts` — extends schema for link fields
- `server/services/post.ts` — `createPost` accepts link metadata
- `server/routers/post.ts` — input shape extended
- `components/PostForm.tsx` — adds the "Share a link?" section
- `components/LinkPreviewCard.tsx` — new component for rendering
  the card
- `components/PostCard.tsx` — renders LinkPreviewCard if linkUrl
  present
- `scripts/seed.ts` — adds 4-5 link-share seed posts

---

**Screenshot / journey diagram:**

```
[ Screenshot placeholder — added after demo recording ]
```

---

**Revision log:**

- 2026-04-25 — initial draft (Paul, with Claude assistance)
- (post-recording) — screenshot added

---

### Scenario 20 — Eddie reads the Sky News post and writes his first comment

_Eddie, member, three days in. Tuesday evening, on the bus home._

Eddie scrolls his feed. Maya's Sky News bias post (the one Sharon
engaged with in Scenario 1) is still in rotation — reactions
trickling in, the AM action button still live. The card shows the
top suggestion bubble: Sharon's reply, _"This is exactly the kind of
pattern we should be naming. Worth a complaint to Ofcom — template
attached 💕"_. There's a "💬 12 comments" pill below the body.

He's curious what Sharon meant by "template attached." He taps the
card.

The detail page opens. The post anchors near the top of the screen
— author, title, body, AM button — and the comments thread stacks
underneath. Filter at the top reads "Discussion" by default. He
scrolls.

He sees:

- Sharon's comment with the Ofcom template snippet — five neighbours
  reacted 🎯 and 💪
- David T's reply: "Sent mine on Sunday. Took 90 seconds."
- A coordinator-pinned answer to "what counts as bias for Ofcom" —
  three short paragraphs, plain English
- Three more replies, mostly thanks-and-also-sent

He's persuaded. He scrolls back to the top, taps "Open in Activist
Mailer", signs the action. Returns to GPS Action — the post now
shows "You've taken this action ✓" on the AM button.

Now he wants to add his own voice. He scrolls to the comment
composer at the bottom of the thread. Single line, expandable:
"Add a comment…"

He taps. Composer expands. He types: "First time using the app —
the Ofcom template made it easy. Thanks Sharon."

He taps Post. The composer collapses. His comment appears at the
bottom of the Discussion thread, with his name, a "new member" chip,
and a relative timestamp ("just now").

He closes the app. Two small contributions in five minutes — read,
acted, replied. No celebration. No notification spam. Permission to
close.

**What the scenario surfaces:**

- Tap-card-to-detail is the canonical interaction (already
  established in Scenario 1) — the detail page is its own URL,
  shareable, deep-linkable per D045
- Detail layout: post anchored near top, thread stacked underneath.
  Not a card variant — a full thread view. On mobile the post
  occupies the top ~40% of the viewport before scrolling
- Default filter is "Discussion" (per Scenario 3 precedent). System
  comments hidden until member toggles to "Activity" or "All"
- Comment composer is a single line at the bottom of the thread,
  tap-to-expand. No floating-action-button — composer is in-line so
  it scrolls naturally with the thread
- New-member chip on Eddie's first comment is warmth, not gatekeeping
  — established members already have role chips; new members get
  context too
- Reading-then-acting-then-replying is one continuous flow on the
  same screen — action button stays accessible while comments are
  scrolled
- Action and comment are independent affordances — clicking AM does
  not automatically post a comment

**Friction found:**

- Eddie's comment count update — when he returns to the feed, does
  the "💬 12 comments" pill reflect his new comment, or stay at 12
  until next page load? Recommend optimistic update on the
  source-card too; revisit if perf is bad
- Top suggestion bubble on the source card — does it rotate to the
  most recent thoughtful comment, stay anchored to the highest-rated,
  or always show the first? Open: pick one, log a parking-lot story
- Composer keyboard focus on mobile — needs careful viewport
  handling so the keyboard doesn't push the post body off-screen.
  Default browser behaviour is usually fine; verify on iOS Safari
- Empty-after-typing case — if Eddie expands the composer, types
  something, then deletes it, should the composer collapse silently?
  Recommend yes, no confirmation
- Comment edit / delete — out of scope for this scenario. BU-comments
  brief should call this out as deferred to a follow-up

---

**Related:**

- Scenario 1 — Sharon boosts a Sky News post (the source post Eddie
  is replying to; tap-card-to-detail is established there)
- Scenario 2 — Emma's leafleting post (replies appear on the card;
  this scenario shows the thread on the detail page)
- Scenario 3 — David reacts on a Shabbat post (Discussion filter
  established)
- Scenario 6 — Claire's outcome post (Activity filter for system
  comments)
- Scenario 17 — System auto-comments on closing campaign (auto-
  comment behaviour visible on detail page)
- Scenario 18 — Eddie writes his first post (this scenario follows
  on three days later)
- Parking-lot — top suggestion bubble algorithm (which comment
  surfaces on the card)

---

**Revision log:**

- 2026-04-25 — initial draft (Claude, with Paul direction)

---

### Scenario 21 — Eddie tracks his vetting application from submission to outcome

<!-- @no-code-yet -->

_Eddie, prospective member. Tuesday afternoon — first week of trying to join._

Eddie has applied to GPS Action. He filled in the form last night — name, region (London E1), why he wants to join, named Sharon as his voucher, social media link. He hit submit and got a confirmation: "Your application is in. We'll be in touch."

This morning he opens the app to check. Bottom nav has a tab labelled **Requests**, with a small "1" badge. He taps.

The Requests tab opens with two sections:

- **My requests (1)**
  - Vetting application · _new_ · submitted yesterday 19:42

- **Notifications**
  - (empty)

He taps his application. It opens the case detail. The post-detail-style anchor at the top shows his application data — name, region, voucher, the link he provided. Below is a timeline with one entry:

> 19:42 — You submitted this request.

Status pill: **new**. He closes the app.

**Tuesday evening 20:15.** A push-style in-app banner doesn't appear (he's not on the app), but when he opens the app at 22:00, the Requests tab shows a "1 new" badge.

- **My requests (1)**
  - Vetting application · _in discussion_ · Sharon picked up 20:18

- **Notifications (1)**
  - Sharon picked up your application · 1h ago [unread]

He taps his application again. The detail now shows:

> 19:42 — You submitted this request.
> 20:18 — Sharon picked up this request. _(small grey system line)_
> 20:31 — **Sharon**: Hey Eddie — quick check, can you confirm your postcode? The form had E1 but you also mentioned you live in Whitechapel; just want to make sure I match the right region.

A reply box at the bottom says "Reply to the team…" — he taps, types "Yes, E1 4DJ. I work near Whitechapel station, that's why I mentioned it." He hits Post.

The system shows: "Your reply was sent." His own message appears in the timeline. Sharon will see it (in fact she also gets a `submitter_message` notification).

**Wednesday morning 09:14.** He opens the app. Banner at the top of feed: "Welcome to GPS Action 🤝". The Requests tab badge is gone. He taps anyway.

- **My requests (1)**
  - Vetting application · _done · approved_ · resolved 09:08

- **Notifications (1)**
  - Your application has been approved — welcome · 8m ago [unread]

He taps the notification. It opens the application. Timeline:

> ...
> 09:08 — Sharon resolved this request: **approved**.
> 09:08 — **Sharon**: Welcome, Eddie. Verified, social media checked, Sharon-vouched. You're a member now. Have a look around the feed; ping us in your local Bristol team's group channel any time.

He's in.

**What the scenario surfaces:**

- The Requests tab is the **single place** the member checks for status of things they've submitted
- Three statuses (new / in discussion / done) are enough — submitter doesn't need finer granularity
- The submitter sees only `audience: all` comments — Sharon's internal vetter notes (if any) stayed internal
- System messages (the "Sharon picked up..." line, "Sharon resolved..." line) are auto-posted on status transitions and visible to submitter
- Notifications are the trigger; the case detail is the destination
- The submitter is a first-class participant — they can reply when asked
- The outcome message + welcome happens in the same case thread, not a separate email or DM

**Friction found:**

- What if Eddie's reply to the postcode question takes 4 days? The case sits in `in_discussion` indefinitely. Should there be a "submitter hasn't replied — nudge?" reviewer affordance? Not in MVP, but worth flagging.
- What if Eddie wants to _withdraw_ his application after submitting? Needs a "withdraw" affordance on the submitter side (case → done, outcome `withdrawn`). Plumb in BU-requests.
- The notification copy ("Sharon picked up your application") is friendly but should not name the reviewer if reviewer-anonymity becomes a privacy concern. For MVP we name them; revisit.

**Related:**

- D054 (Request entity — what Eddie's application is)
- D056 (Comment audience — why Eddie sees only the `all` slice)
- D057 (Notifications — what fires when Sharon picks up + resolves)
- SCN-22 (the reviewer side of this same case)

---

### Scenario 22 — Sharon picks up and resolves Eddie's vetting application

<!-- @no-code-yet -->

_Sharon, vetter. Tuesday evening 20:15 — nightly review pass on her laptop._

Sharon opens GPS Action on desktop. Left sidebar (mobile = bottom-tab Requests) shows her Cases section:

- **In my queue — vetting (3)**
  - [new] Eddie — London E1 — 18h
  - [new] Daniel — Manchester M4 — 6h
  - [in discussion] Imogen — claimed by me, 2 days

She picks Eddie. The case opens. Top section shows the application context: name, region, voucher (Sharon — herself), link to social media. Below: an empty timeline (just Eddie's submission marker).

She taps **Claim**. Status flips `new → in discussion`. The system auto-posts: "Sharon picked up this request · 20:18". Sharon's view now includes the reviewer affordances: comment composer (default audience: reviewers), Resolve button, Mark urgent toggle.

She reads the application carefully. The form data looks fine. She clicks Eddie's social-media link in a new tab — public profile, looks consistent (writer, lives in London, posts about Israel/diaspora topics in a way that aligns with GPS values). Back to the case.

She types an internal note (default audience: **reviewers**):

> "Profile looks legitimate. Wants to make sure the postcode + region match — he wrote E1 but mentioned Whitechapel."

Hits Post. The internal note appears in the timeline with a small "internal · only reviewers see this" marker.

Then she toggles **Reply to submitter** and types:

> "Hey Eddie — quick check, can you confirm your postcode? The form had E1 but you also mentioned you live in Whitechapel; just want to make sure I match the right region."

Hits Post. This message is `audience: all`. Eddie will see it.

Sharon closes the case and moves to the next item in her queue. She's done what she can right now; the ball is in Eddie's court.

**Tuesday evening 22:00.** She gets a `submitter_message` notification: "Eddie replied on his application." She doesn't open right away — quiet hours. She'll see in the morning.

**Wednesday morning 09:00.** Sharon opens GPS Action. Notification badge: 1. She taps.

- **Notifications (1)**
  - Eddie replied on his application · 11h ago [unread]

She taps. Eddie's case opens to the timeline:

> 20:31 — **Sharon**: Can you confirm your postcode...
> 22:18 — **Eddie**: Yes, E1 4DJ. I work near Whitechapel station, that's why I mentioned it.

Good. Postcode and region match. She types one more internal note: "Postcode confirmed. E1 → London, fine." Then clicks **Resolve**. A modal opens:

- Outcome: `approved` / `declined` / `withdrawn` (radio)
- Required summary message to submitter (audience: all)

She picks **approved** and types the welcome message:

> "Welcome, Eddie. Verified, social media checked, Sharon-vouched. You're a member now..."

Hits Resolve. Status flips `in_discussion → done`. The system auto-posts the resolution line. Eddie's notification fires. The case disappears from her active queue and lands in her "Done by me" view (filterable but out of the way).

**What the scenario surfaces:**

- The reviewer's flow is **claim → discuss → resolve**. Three statuses, three actions, no friction.
- Internal vs external comments are distinct UX moments — not a thread tab toggle, an audience toggle on the composer
- The `audience: all` "Reply to submitter" affordance is opt-in, not default — encourages reviewers to type internal notes first
- Required outcome message on resolution forces the reviewer to communicate the decision
- Sharon never DMs Eddie outside the case — the case thread IS the channel
- The async pattern (pick up → ask → wait → resolve) is supported without dedicated assignee handoffs

**Friction found:**

- Sharon's internal note "Profile looks legitimate" — if Sharon were to make a snap negative call, internal notes could feel uncomfortable to other reviewers reading later. Reviewer norms (be diplomatic) need to be socialised, not just enforced via UI.
- What if Sharon is on the fence and wants to escalate to admin? Per D055 + the user's call: she @mentions an admin, the admin gets a notification, joins the discussion. No formal escalation flag.
- What if Sharon needs to take longer than expected to decide? No SLA enforcement in MVP; queue managers self-coordinate.

**Related:**

- D054 (Request entity — what Eddie's application is)
- D055 (per-type scopes — Sharon has `queue_manager:vetting`)
- D056 (Comment audience — internal vs all)
- D057 (Notifications — what fires throughout)
- SCN-21 (Eddie's side of this same case)

---

### Scenario 23 — Maya raises an urgent alert at the school gate

<!-- @no-code-yet -->

_Maya, Tower Hamlets coordinator. Friday 15:35 — at her child's school for pickup._

Maya is at the school gates. Two people are handing out leaflets that look antisemitic. She took photos discreetly. She wants to alert the team — both for situational awareness and because someone with media contacts might need to act fast.

She opens GPS Action on her phone. Bottom-right FAB. She taps. Tile picker opens with the post-type tiles. One tile is a **red warning triangle with exclamation mark** labelled "Alert." She taps that.

The alert composer opens:

- Category: "Happening now" (preselected — only category active right now)
- Reason / context (required, free text):

She types: "Antisemitic leaflet drop at gate of [school name redacted], Bow E3. Two people, ~30s, white men. Photos available. Anyone available to advise / pick up by phone? I'm with my kid; can't engage but can stay 10 min."

She hits Submit. The screen shows "Sent · the team has been alerted." She closes the app and watches the gate.

---

**Cary (queue manager, generalist — `queue_manager:*`).** Friday 15:36. Cary is on her laptop. The Requests tab she has open in her browser polls every 10 seconds; within 10 seconds, a new section appears at the top:

- **🔴 Urgent (1)**
  - Maya · Antisemitic leaflet drop at gate of [school]... · _new_ · 8s ago

Cary taps. Reads the context. She herself is across town — can't physically respond. But she notices Maya didn't @mention anyone specific. Cary types in the case discussion (audience: reviewers):

> "@Sharon @David — this is in your patch. Either of you free to call Maya?"

Sharon and David both get `mention` notifications in their Requests tabs.

---

**Sharon (vetter — but generalist enough to help here).** Friday 15:38. Sharon's tab is on her browser; the Urgent section appears with Maya's alert. She also has a `mention` notification from Cary.

She taps the case. Reads. She knows Maya from prior cases. She taps **Claim** — status `new → in_discussion`. The system auto-posts "Sharon picked up this request · 15:38".

She types a reply to Maya (`audience: all`):

> "Maya — calling you now. Stay safe. Can you describe what they're saying / handing out beyond the photos?"

She also pulls Maya's number from the contacts directory and calls. They talk. Maya describes. Sharon asks if there's a teacher near; Maya says yes. Sharon says: "Ask the teacher to handle if they can — don't engage yourself. We'll log this and follow up after pickup."

Sharon types another reply:

> "Spoke to Maya. Teacher being asked to address it. Maya stays with her kid, doesn't engage. Photos preserved. Once she's home and safe I'll do the formal flag/incident write-up."

---

**Friday 16:00.** Maya messages back:

> "All ok. Teacher came out, asked them to leave. They left. I have photos. School is on it. Thanks Sharon."

Sharon resolves the case. Outcome: **acted_published_post** (the team will write a public-facing incident note from the photos in the next hour) plus optional follow-up.

In the resolution message:

> "Glad you're safe. Photos with us. Will follow up with school + post a network-wide incident note within the hour. Thanks for raising this fast."

Status flips `in_discussion → done`. Auto-downgrade is moot — the case is resolved well within the 4-hour TTL.

**Maya** opens the app on her way home. Notification: "Sharon resolved your request — outcome: acted." She reads. Closes app. Nothing more she needs to do.

**What the scenario surfaces:**

- The FAB **alert tile** (red warning triangle, per D058 + D044) is the canonical entry for member-raised urgents
- The case **broadcasts** to all reviewers regardless of scope (Cary, Sharon, David, others) — situational awareness without bypassing role-based action
- Acting is still scope-aware — Cary can claim/comment but pulls in Sharon who has appropriate authority
- @mentions in the discussion route to the right person fast (per D055 + D057)
- The 10s polling cadence is fast enough — within 10 seconds of Maya hitting submit, every reviewer's tab shows the urgent
- The TTL of 4 hours is irrelevant in this case — resolved in 25 minutes
- Urgency does not bypass quiet hours for in-app delivery; in this case it doesn't matter (afternoon)
- The incident is real but the urgency is bounded — it gets resolved, not left dangling

**Friction found:**

- The school name and child identification need redaction discipline — the case context could be exposed if the database is leaked. Recommend: alerts touching child safety auto-route to incident type with extra review on what's logged. Surface in BU-requests's brief.
- The "10s polling" delay is fine for this case (Sharon picked up at +2 min) but a more time-critical alert (someone in physical danger right now) might warrant faster delivery. SSE / push notifications for `urgent_request_raised` is the real Phase-2 upgrade per D058.
- Cary used @mention to pull in Sharon — but if neither Sharon nor David had been online, who would have picked it up? Need a "no one available" escalation path — possibly auto-page-admin if no claim within N minutes for urgent cases. Park.
- Outcome typology (`acted_published_post`, `acted_dispatched`, `dismissed_no_action`) is a soft taxonomy; reviewers may not always pick the right one. Surface a free-text "what we did" field alongside the typed outcome.

**Related:**

- D044 (FAB intent-cards composer — alert tile lands here when BU-composer-fab ships)
- D054 (Request entity — type=alert is one of 11 types)
- D055 (per-type scopes — visibility broadens for urgent, action stays scoped)
- D056 (Comment audience — internal vs all in the discussion)
- D057 (Notifications — `urgent_request_raised` fires to all reviewers)
- D058 (Urgent flag, AlertCategory, polling, FAB alert tile, TTL — primary specification)
- SCN-2 (Emma's leafleting concern — slower form of similar incident, pre-D058)
- SCN-21, SCN-22 (the canonical submitter + reviewer flows for non-urgent cases)
