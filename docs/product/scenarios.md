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

Top of the feed there's a "New post" link. He clicks it. The page changes to `/compose`. A form appears with three fields and a publish button. The fields are clearly labelled — title, body, "Activist Mailer URL (optional)." The composer is plain — no FAB cards, no intent picker, no template gallery. Per the brief, this is the stepping-stone composer; the full FAB experience comes later (BU-005).

**Eddie types his title:** "Camden council BDS motion — campaign live." He tabs to the body and writes a paragraph: what the motion proposes, when it's being debated, why it matters. Three or four sentences. He tabs to the AM URL field and pastes the campaign link he had on his clipboard. The field accepts it. There's no preview pane — the composer trusts him to know what he's pasted.

He clicks Publish. There's a brief loading state on the button, then the page redirects back to `/feed`. His post is at the top. The card shows his name, the time ("just now"), the title, the body, and an "Open in Activist Mailer" button that PostCard rendered because the `activistMailerUrl` is present.

He clicks the AM button. A new tab opens to the campaign page. He verifies it's correct. He closes the tab and returns to GPS Action.

His post is still there. No reactions yet — it's been less than a minute. He'll check back later.

Total elapsed time: under three minutes from "I should share this" to "it's shared." That's the point.

**What the scenario surfaces:**

- The composer is intentionally simple. Three fields, one button. Anything more is BU-005 territory.
- The "New post" link from the feed is the entry point. There's no FAB on the demo flow yet — the FAB lives in the future composer.
- AM URL handling is already done in `components/PostCard.tsx` from BU-feed; BU-composer just needs to put a value in the field and trust PostCard to render the button.
- The post lands at the top because the feed orders by `createdAt DESC`. No live update or websocket — just a server redirect after the mutation, and the next render shows it.
- The dev login flow is in play. In production this would be real auth; for the demo, `/dev/login` is sufficient.

**Friction found:**

- No draft auto-save. If Eddie closes the tab mid-compose, his work is gone. Acceptable for the demo (it's a 3-field form and posts are short) but a real concern for the post-demo composer. Drafts go in BU-005's scope per the existing parking-lot notes.
- No URL validation feedback in the composer beyond Zod's pass/fail on submit. Eddie won't know his AM URL is malformed until he tries to publish. Per `bu-composer.md` the AM URL field has inline validation feedback; verify in the click-through.
- No preview. Eddie doesn't see what the card will look like before he publishes. For the demo, fine. For the FAB composer (BU-005), live preview is in scope per D044.
- No success toast or confirmation copy after publishing — the redirect to feed-with-his-post-at-top is the implicit confirmation. Honest and minimal; possibly too quiet. Worth testing with real members.
- The "New post" link is just a link, not a button. On mobile, a thumb-reachable FAB will be the eventual entry point. The demo uses a link because it's simpler and the FAB belongs to BU-005.

**What this scenario does NOT cover:**

- Visibility selection (the demo's posts are all `members_only` per the bu-composer brief defaults; per-post visibility override is D045 and lands later).
- Region tagging, group tagging, intent selection — all deferred to BU-005 per D041, D043, D044, D048.
- Cancel-and-discard flow. The demo's composer has no Cancel button visible in the brief — Eddie either publishes or navigates away. Worth adding `compose-newpost-cancel` testid for the eventual cancel button when it lands.

## Writer scenarios

### Scenario 7 — Sharon creates a Writers event

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
