# How we spec features

A guide for anyone who wants to help shape what GPS Action does. You
don't need to write code. You need to understand the people we serve
and how they'd use this thing.

This doc is for:

- Volunteers who know the community and want to suggest features
- Anyone joining the team who hasn't done this before
- Engineers who want a refresher on what a good scenario looks like

It takes about 10 minutes to read.

---

## Why we bother

A feature without a clear story is a feature nobody asked for. Before
we build something, we describe how a real person would actually use
it. We call this **a scenario**.

A scenario answers four questions:

- **Who** is using this?
- **What** are they trying to do?
- **What happens** as they use it?
- **How do we know** it worked?

If we can't answer these clearly before building, we shouldn't build.

A good scenario means:

- The volunteer writing it can explain it to someone in their
  community without reading from a script
- The engineer reading it can build it without 20 follow-up questions
- The tester reading it can verify it without asking the engineer
  what success looks like

Every feature in GPS Action started as a scenario. The login flow,
the feed, the post composer — each was a story before it was code.

---

## What a scenario is — and isn't

### A scenario IS

A short story about one specific person doing one specific thing in
the product. Concrete. Named. Bounded.

> **Eddie sees an urgent council vote and wants his network to send
> letters.** He logs in, clicks "New post", types "Council vote
> Thursday — 48 hours to email" with a link to the pre-built
> Activist Mailer campaign, and clicks Post. The post lands at the
> top of the feed where Cary, Bette, and others see it within
> minutes.

That's a scenario. You can picture it.

### A scenario IS NOT

- A feature list ("the system should support post creation")
- A use case in the abstract ("users can post things")
- A wireframe ("the form has 4 fields and a submit button")
- A technical spec ("post.create takes a Zod-validated input...")

Those things might come later, but they're downstream. The scenario
comes first.

---

## The 6 sections of a scenario

Every scenario in GPS Action has these six parts. The template lives
at `docs/product/scenario-template.md` — copy it when starting a new
one.

### 1. Title — the one-line summary

A name in the form `<Person> <does what>`.

> ✓ "Eddie writes an urgent action call"
> ✓ "Cary moderates a flagged post"
> ✗ "Post creation flow"
> ✗ "Action workflow MVP"

If your title doesn't have a person and a verb, rewrite it.

### 2. Context — who is this person, what's going on?

Two or three sentences setting the scene. Not a biography — just
enough that the reader pictures the moment.

> Eddie Morales is a member who runs a 200-person WhatsApp group of
> local parents. He's just seen a council vote announcement that
> matters to his community. He needs to get a letter-writing
> campaign in front of his network within 24 hours.

Don't say "the user" or "a member." Use a name. Make it specific.
Specificity reveals problems. Vagueness hides them.

### 3. Steps — what they actually do

A numbered list of physical actions, in order. One action per step.
Plain English. No clicks or URLs unless they really matter.

> 1. Eddie opens GPS Action on his phone
> 2. He sees the feed, scrolls past two posts from earlier today
> 3. He taps "New post"
> 4. He types a short title
> 5. He pastes the campaign URL
> 6. He picks "public" so anyone can see it
> 7. He taps "Post"
> 8. He's back on the feed; his post is at the top

Watch out for steps that combine multiple actions ("he fills in the
form and submits"). Split them. Each action is its own step.

### 4. Expected outcome — how does it end?

What's the world like after the scenario succeeds? Both for the
person AND for everyone else affected.

> - Eddie's post appears at the top of the feed for everyone who
>   loads it next
> - Cary, Bette, Humphrey, and Ingrid see it on their next visit
> - The post has an "Open in Activist Mailer" button that opens
>   Eddie's campaign in a new tab
> - Eddie's action is recorded in the audit log (so we can later
>   see who posted what and when)

If you can't describe the "after," the scenario isn't done.

### 5. What we're NOT doing — the boundary

This is the most often-skipped section, and the most useful one. List
what's deliberately out of scope.

> - Eddie can't edit the post after publishing (yet)
> - We don't notify Cary etc. — they discover it on their next visit
> - We don't track who clicked "Open in Activist Mailer" yet
> - The post can't be scheduled for later

Without this section, scope balloons. Engineers add features "while
they're at it." Testers test things that weren't promised. Reviewers
ask why something obvious is missing.

Saying "not doing X" before anyone asks saves arguments later.

### 6. How we'll know it worked — acceptance

Bullet points a tester can verify by clicking through the product.

> - I can log in as Eddie
> - I can navigate from /feed to /compose with one click
> - I can fill the form and submit
> - The post appears at the top of /feed after submitting
> - The "Open in Activist Mailer" button opens the URL in a new tab
> - If I leave the title empty, I see an error
> - If I paste a URL that isn't from activistmailer.com, I see an error

A non-engineer should be able to test the scenario by reading these.
If they can't, the acceptance bullets are too technical.

---

## How to find a good scenario

If you have a feature idea, work backwards from a moment.

**Don't start here:** "We should let people share posts to WhatsApp."

**Start here:** "Cary just saw a great post Eddie wrote. Her WhatsApp
group of 80 parents would care. What does she do next?"

The second framing forces you to imagine the person, the context,
and the friction. That's where the design questions live.

### Useful prompts

- "When does this matter most?" — finds the urgent case
- "What did the person do just before this?" — finds the entry point
- "What did they want to do but couldn't?" — finds friction
- "What would make them give up?" — finds failure modes
- "Who else is affected by this action?" — finds knock-on effects

### The five-questions test

Before you finish writing a scenario, answer these. If any answer is
"I don't know," the scenario isn't ready.

1. What's the person's name?
2. Why are they doing this _today_?
3. What's the one thing they want at the end?
4. What's the worst thing that could go wrong?
5. Who else feels the consequences?

---

## Anti-patterns we've learned to avoid

### Speaking in the abstract

> ✗ "A user can create a post by filling out a form."
> ✓ "Eddie taps 'New post', types his title, pastes a campaign URL,
> and taps 'Post'."

The first reads like a manual. The second reads like a story.
Stories are easier to test, easier to question, and harder to
misunderstand.

### Listing every possible variant

A scenario is one path through the product. If there's another
distinct path, write a separate scenario. Don't try to capture
"and also if she's an admin then..." inside one scenario.

### Mixing scope and acceptance

Don't put "and also it should support attachments" in the steps. If
attachments aren't in scope, they go in the "Not doing" section.

### Hiding the assumption

> ✗ "Eddie taps 'Post' and the post appears in the feed."
> ✓ "Eddie taps 'Post'. He's redirected to the feed. His post is
> at the top because the feed is sorted newest-first."

The first hides why the post appears at the top. The second names
the rule. Spelling it out makes it easier to verify.

---

## What happens after you write a scenario

1. **You commit it** — a markdown file in `docs/product/scenarios/`
2. **Someone reviews** — usually Paul, sometimes another contributor
3. **It gets discussed** — open questions surface, edges get found
4. **It's accepted** — the scenario is now part of the spec
5. **It maps to a build unit** — engineers translate it into a brief
6. **It gets built** — code is written
7. **It gets verified** — the acceptance bullets become the test plan
8. **It might get updated** — if the build reveals something the
   scenario missed, we revise it together

You don't need to do steps 5-7. But you can if you want.

---

## A worked example

`docs/product/scenarios/scn-eddie-writes-action-call.md` is a fully
worked scenario you can read as an example. (It exists once the
demo lands; ask if it's not there yet.)

Read it before writing your first one. Notice:

- How specific Eddie's situation is
- How short each step is
- How the "Not doing" section names things you'd otherwise wonder about
- How acceptance bullets are concrete enough to test

If your scenario looks roughly like that, you're on the right track.

---

## Common questions

### How long should a scenario be?

About one printed page when finished. If it's longer, it probably
covers two scenarios. If it's shorter, it might be missing the
"Not doing" or "Acceptance" sections.

### What if I don't know technical details?

You don't need them. Write the scenario in plain English. Engineers
will translate it into technical specs later. Your job is to make
the human story clear; theirs is to make it work.

### What if my scenario contradicts an existing one?

That's useful. Surface it. Often a contradiction reveals an
unstated assumption — exactly what scenarios are for.

### Can I write a scenario about something we haven't built yet?

Yes — that's the main use. Most scenarios are written before the
feature exists.

### How many scenarios should we have?

A handful per feature area. Not one per click, not one per
permission combination. One per **distinct journey** a person could
take.

For example, posting:

- Eddie writes an urgent action call (the main case)
- Cary writes a quiet cultural-moment post (different tone)
- Bette tries to post but the AM link is wrong (failure case)

Three scenarios. They cover different dimensions of the same
feature. We don't need fifty.

### Where do I get a screenshot for the scenario?

After the feature is built and the demo's been recorded, screenshots
become available in `docs/product/screenshots/`. If you're writing a
scenario for a feature that doesn't exist yet, skip the screenshot
section — leave a placeholder. Add the image after the build.

---

## Where to start

1. Read `docs/product/scenario-template.md` (the blank template)
2. Read one or two existing scenarios in `docs/product/scenarios/`
3. Pick a moment in your community's life that GPS Action could help
   with
4. Copy the template
5. Fill it in
6. Open a pull request, or send it to whoever's coordinating spec
   contributions

That's it. Welcome.
