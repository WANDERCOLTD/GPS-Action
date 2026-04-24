# Demo recording — preparation & script

**Status:** Prep doc, April 2026.
**Purpose:** Be ready to record a useful demo the moment the MVP is
complete. Everything below lives in the repo so future-you (and anyone
reviewing the demo) has context.

**Read alongside:**

- `docs/build/bu-sequence.md` — what "demo complete" means
- `docs/product/design-philosophy.md` — tone we're showing
- `docs/product/scenarios.md` — the user journeys being demoed

---

## When to record

Record when BU-composer merges. That's the demo-complete milestone.
The three sessions — BU-001-lite, BU-feed, BU-composer — between them
deliver the minimum:

- Login (dev stub)
- Feed with realistic posts
- Composer for new posts
- AM URL display + external link
- Audit of what happens

Don't record earlier; the fragments won't tell a coherent story.

Don't wait much longer; the demo decays the further ahead of it the
product gets. Record within a day or two of BU-composer merging.

---

## What NOT to demo

Before listing what to show, explicitly what's not in the demo:

- Any real authentication — dev stub is visible but we call it out
  as a stub
- Any admin surface — hasn't been built yet
- Any moderation — no flags, no queue, no review
- Groups membership UI — not built
- Any outcome tracking or analytics
- Any WhatsApp dispatch
- Any vetting / signup flow

**Be honest in narration.** When a viewer thinks "what about X?" and
X isn't built yet, say so explicitly. Honest demos build more trust
than polished-but-vague ones.

---

## The 90-second demo — tightest version

If you only have 90 seconds (Slack clip, tweet, quick intro):

```
0:00  → Open http://localhost:3001
0:05  → "This is GPS Action. A platform for coordinated community
         activism. Right now it runs on my laptop. Dev-only — we
         haven't deployed yet."
0:15  → Show /dev/login page. "Not real auth. The real thing comes
         next. For now, I pick Eddie as our demo member."
0:25  → Click "Log in as Eddie Morales". Land on /feed.
0:30  → "Here's the feed. Five seeded users have written posts.
         These are fake posts with invented names but realistic
         content."
0:40  → Scroll. Point out a cultural-moment post, an action call,
         a news share. "The feed mixes tones — not every post is
         urgent."
0:55  → Click an "Open in Activist Mailer" button on a post.
         "This is the distinctive bit. The author paste-included
         an AM campaign URL. Click opens their campaign in a new
         tab."
1:05  → Return. Click "New post". Fill in — title, body, AM URL.
1:25  → Submit. Return to feed. "Here's my post, top of the feed."
1:30  → "That's the minimum loop. Next we build real auth, deploy
         to staging, and invite pilot users."
```

90 seconds. No fluff. Every second earns its keep.

---

## The 3-minute demo — proper internal share

When you want Jeremy or another collaborator to really understand it:

### Opening (20s)

```
"I'm going to show you GPS Action's first working demo. It runs on my
 laptop — dev-only, no staging yet, no real auth. The goal is to prove
 the core loop: someone logs in, reads posts from their community,
 writes a new one, and it surfaces to everyone.

 I'll show it, then we'll talk about what's real, what's mocked, and
 what comes next."
```

### The flow (2 min)

**Step 1 — Login (20s)**

- Open `/dev/login`. "Not the real login. This is a developer
  'pick a user' screen. Real auth is the next Build Unit."
- Pick Eddie. Emphasise: "Eddie is a seeded user. One of five we've
  invented for the demo — Eddie Morales, Cary Whitfield, Bette
  Rosenthal, Humphrey Kline, Ingrid Blum. Fake people, realistic
  feel."

**Step 2 — Feed (45s)**

- Land on `/feed`. "Chronological feed of what other users have
  posted."
- Show post variety. "Different tones — a council vote action-call,
  a Shabbat message, an article share with commentary, an event
  invite, an outcome report. The platform handles range."
- Click a timestamp. Show it's relative.
- Point out the "Open in Activist Mailer" button on one post.
  "That's the distinctive bit. If a post has a campaign link, this
  button opens it in a new tab. The author's campaign isn't embedded
  here — we're just the pointer."
- Click it. Demonstrate the new tab. Come back.

**Step 3 — Composer (45s)**

- Click "New post". Land on `/compose`.
- Point out the form is simple. "Title, body, optional AM URL,
  visibility. Not the final composer — later we'll have intent-driven
  'What do you want to do?' cards. For now, simple form proves the
  wire-up."
- Fill the form. Keep it realistic.
  - Title: "Call your council re: Wednesday's planning meeting"
  - Body: ~3 lines of real-sounding text
  - AM URL: valid
  - Visibility: public (default)
- Click Post. Return to `/feed`. New post at top.
- Click the AM button on your own post. "Same mechanism, end-to-end."

**Step 4 — Switch user (15s)**

- Go back to `/dev/login`. "One more thing."
- Switch to Cary (queue_manager role). "Same feed, same access,
  different identity. Later, Cary sees things Eddie doesn't —
  moderation queue, admin surface — but for the demo, this shows
  the user-switching works."

### Closing (40s)

```
"That's the demo. Now what's real vs. mocked:

 REAL:
  - The database is real Postgres. Those posts actually exist.
  - The feed queries are real tRPC procedures with proper validation.
  - The audit log is real — every creation writes a row we can review.
  - Access control is real-ish: middleware pattern in place, ready
    for when real auth arrives.

 MOCKED:
  - Login — dev-only stub, rejects in production.
  - Authentication identity — cookie-based, no passwords.
  - All 5 users — seeded, not real people.
  - All posts — seed data, not real member content.
  - Activist Mailer URLs — these go to real AM campaigns only if
    you paste a real URL. For seed data they're placeholders.

 What's coming next:

  1. Real auth — magic links via email. Maybe Lucia or Auth.js.
  2. Deploy to staging so you can see it outside my laptop.
  3. Full admin surface — moderation queue, role grants, audit review.
  4. Then first pilot user.

 Questions?"
```

---

## Before recording — checklist

### Technical prep

- [ ] Dev database is clean — re-run seed to have pristine demo data
- [ ] No accidental real data in the database
- [ ] All terminal windows closed (except the one running dev server)
- [ ] Browser: use an incognito window so no extensions, no bookmarks
      bar, no personal tabs visible
- [ ] Browser zoom 100% or 110% — text readable without squinting
- [ ] Close Slack, email, Discord, anything that notifies
- [ ] Full screen the browser
- [ ] Macbook notifications: off (Do Not Disturb on)
- [ ] Screen recording app: QuickTime or Loom — know which you're
      using before you hit record

### Content prep

- [ ] Know what you're going to say before you record (script above,
      adapt to your voice)
- [ ] Do one dry run — catch awkward transitions before they're
      permanent
- [ ] Have the AM URL you'll paste ready on your clipboard
- [ ] Pre-type the title and body you'll use, somewhere you can copy
      from quickly

### Browser state prep

- [ ] Clear cookies before recording so `/dev/login` shows the picker
- [ ] Confirm seed data has variety — check the feed briefly first
- [ ] Confirm at least one seeded post has an AM URL that opens
      something plausible

---

## Framing for different audiences

### For Jeremy (partner, fellow executive)

Focus on strategic fit:

- "This is the first proof that what we've been designing actually
  works."
- "The schema covers more than what you see — we could light up
  groups, moderation, vetting when we need them."
- "Pace-wise, from empty repo to this took one week."
- "The demo is deliberately minimal — we wanted to see the critical
  loop first."

### For a technical contributor

Focus on infrastructure, discipline:

- "Every commit runs pre-commit hooks — format, lint — so no drift."
- "Mechanical enforcement: custom ESLint rules catch auth check drift,
  PII in logs, traceability."
- "Schema's got soft-delete, audit log, role grants all wired."
- "Everything's documented — session briefs, ADRs, architecture docs."
- "Stack: Next.js 15, Prisma 5, tRPC 11, TypeScript strict."

### For a community member / potential user

Focus on what they'd experience:

- "You'll see a feed of what people in the network are doing."
- "When someone wants your help — send an email, sign a petition —
  you get a clear button that opens the right tool."
- "The tone varies. Not everything's urgent. Shabbat messages
  feel different from action calls."
- "What you're NOT seeing today: we haven't built signup yet. When
  we do, it'll be vetted — not open to anyone."

### For a funder / board member

Focus on the operational story:

- "Deliberately thin MVP. Nothing built that we can't defend the
  need for."
- "Compliance thinking baked in from day one — UK GDPR, audit logs,
  data residency."
- "Next three months: real auth, first 10 pilot users, feedback loop."
- "Longer arc: moderation, groups, dispatch integration, outcome
  tracking."

---

## Common questions & suggested responses

### "Why not use an off-the-shelf tool?"

"We looked at forum software, Discord, Slack for activism. Each
handles one piece. GPS Action is the coordination layer across the
network's existing tools — WhatsApp stays, Activist Mailer stays,
email stays. GPS Action surfaces the asks, tracks outcomes, and
threads the work across those channels."

### "How are you handling moderation / safety?"

"Schema's there — every flag becomes a work item in a queue.
Queue manager role claims it, reviews, resolves, with full audit.
The UI for moderators isn't built yet but the data model supports
it. That's planned for after the first pilot deploys."

### "What about data protection?"

"UK GDPR compliant by design. Data's in eu-west-2 (London).
PII fields are tagged in the schema. Audit log is append-only.
We've got a security-baseline doc — happy to share."

### "Why does this need to exist?"

(Know your actual answer here — this is the strategic case for
GPS Action itself, not a technical one. The product docs have more
context. Be ready.)

### "What's the next 30 days look like?"

"Real auth, staging deploy, admin surface, first pilot invite.
Three-to-four weeks depending on how feedback from early pilot users
reshapes priorities."

### "Who else is working on it?"

(Your call — name collaborators or don't, depending on audience.
Be honest either way.)

### "Can I try it?"

"Not yet on a public URL. Once staging is up in about 2-3 weeks,
I can invite you. Want to be on the early list?"

---

## Follow-up templates

### When you share the recording

**To a collaborator / partner:**

```
Subject: GPS Action — first demo

Hi [name],

Quick demo of where GPS Action is: [link]

~3 min. Runs on my laptop so bear with the dev login. What you're
seeing:
 - Login as a seeded user
 - A feed of posts
 - Writing a new post with an Activist Mailer link
 - Back to the feed, new post at top

What I'd love to know:
 1. Does the feed feel like what you had in mind?
 2. Anything obviously missing from the first 30 seconds?
 3. Who else should see this?

Not for public sharing yet — everything's fake/seed. Staging in
~2-3 weeks.

Cheers,
Paul
```

**To a potential pilot user:**

```
Subject: Would you try an early version of GPS Action?

Hi [name],

I've been building a platform for coordinated activism across the
UK Jewish community. Short demo here: [link] (3 min, runs on my
laptop).

The real thing deploys to staging in a few weeks. I'd love to have
you as one of the first 10 pilot users — testing the flow, giving
honest feedback.

Low commitment — maybe 30 minutes of your time once it's live,
plus chat with me a couple of times as it develops.

Interested?

Paul
```

**To a funder / board member:**

```
Subject: GPS Action — progress update

Hi [name],

As promised, a first working demo: [link]

Context:
 - Built in [N] days over [Apr/May 2026]
 - Stack and discipline solid — 7 PRs, full type safety, mechanical
   enforcement
 - Dev-only today. Staging + pilot users ~4 weeks away.

The video is 3 minutes; detail in the description.

What I'd like next: [a specific ask — reference, intro to X,
feedback on Y strategic question, etc.]

Paul
```

---

## After the recording

### Cross-post the demo

Decide which of these channels get the link:

- Team Slack / Discord
- Private group chat with Jeremy et al
- Personal LinkedIn
- Not public

**Don't put it on YouTube unlisted and forget the link.** Track where
it went so you can gather feedback back into a single place.

### Log feedback

Every viewer's response goes somewhere. Options:

- A `docs/feedback/demo-v1-responses.md` doc in the repo
- A spreadsheet you maintain
- A dedicated Slack thread

Themes to watch for:

- What confused people
- What they assumed was real vs mocked
- What they wished was already built
- Their own use-case vs what you showed
- Their questions

These feed into Phase 2 priorities.

### Decide what to build next based on feedback

The demo is the moment truth-teslts planning. Three weeks of building
were based on Paul-assumptions. Now real viewers react.

**Expect at least one surprise.** If a feature you deprioritised turns
out to matter most to 3 out of 5 viewers, consider re-ranking.
Likewise if something you sweated over turns out not to register.

Post-demo priorities are NOT "finish the BU sequence plan as written."
They're "what did the demo reveal about what to build next?" The BU
sequence plan is a working hypothesis, not a commitment.

---

## What this doc does NOT cover

1. **Production launch plan.** Separate doc when staging is running.
2. **Press / external-facing launch.** Way too early.
3. **Sales / pricing.** Not relevant for a not-for-profit pilot.
4. **A formal user-testing protocol.** Pilot-phase concern.
5. **Specific recording software comparisons.** Use what you know.
6. **Video editing.** Recording should be one-take where possible;
   no editing for a dev demo.
7. **Accessibility review.** The demo shows functionality, not a
   polished product. WCAG audit is its own Phase 2 item.

---

## One reminder

The demo is a step, not a destination. What matters is the feedback
loop it triggers. Five honest reactions from five people who know
the problem domain are worth more than a thousand passive views.

Collect the reactions. Update priorities. Build the next thing.
