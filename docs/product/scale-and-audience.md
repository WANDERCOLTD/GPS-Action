# Scale and audience

**Status:** Product reference, April 2026.
**Source:** GPS executive input, April 2026 planning round.
**Purpose:** Capture the real-world scale GPS Action is designed
to serve, and the concept of "coordinator" as understood by GPS
leadership. Supersedes any earlier, smaller assumptions in design
docs.

---

## The numbers

| Metric                                           | Current      | Projected |
| ------------------------------------------------ | ------------ | --------- |
| **A — GPS members** (across all WhatsApp groups) | 250          | —         |
| **B — Total reachable via coordinator networks** | **~350,000** | —         |
| **C — Admins across GPS databases**              | 1,300        | —         |
| **D — Coordinators**                             | 200          | 1,000+    |
| **E — Trusted circle**                           | 40           | —         |
| **F — Active posters** (create content)          | 125          | —         |
| **G — Reactivists** (share others' content)      | 200          | —         |
| **H — Volunteers**                               | 80           | —         |

**The headline number is B — 350,000 reachable people.** GPS Action
is not a 250-member forum. It is a coordination layer for a network
with six-figure downstream reach.

---

## What a coordinator actually is

**A coordinator is a member of GPS who has their own reachable network
beyond GPS itself.** That network might be:

- A rabbi's congregation
- A WhatsApp group admin's 200-person chat
- A school parent representative's year-group list
- A newsletter writer's 2,000 subscribers
- A synagogue's email list
- A community organisation's members
- Someone's personal circle of friends and family (even just 15 people)

### The key insight

> **Nearly everyone is a coordinator.** Everyone has _some_ network
> — whether just their own friends and family, or tens of thousands
> in their databases.

This is not a power-user tier. It is the default. A GPS member who
is NOT a coordinator is the exception — someone whose reach is
essentially themselves.

### Implication for the product

The original mental model — "members are many, coordinators are few,
coordinators get special tools" — is **wrong**. The correct model is:

- **Everyone joining GPS declares (or implies) some reach**
- **That reach varies by orders of magnitude** (15 people vs. 15,000)
- **GPS Action amplifies through declared reach**

This reshapes:

1. **Role model.** `coordinator` as a distinct role may be redundant.
   A `reach` field on User (self-declared or observed) may be more
   accurate.
2. **Onboarding.** Asking "what are your networks?" is a first-class
   question, not an optional field.
3. **Post amplification.** A post's potential impact is the sum of
   its reachers' reach, not just the GPS member count.
4. **Dispatch mechanics.** The meaningful unit is not "GPS member
   sees post"; it is "GPS member dispatches to their network."

See also: **D049** (if written) — the proposed ADR exploring
`role=coordinator` vs. `reach=<number>` as the modelling primitive.

---

## Activity mix

Of 250 current GPS members:

- **125 active posters** create new content
- **200 reactivists** amplify others' content (overlaps with active
  posters — a member can be both)
- **80 volunteers** do operational work (moderation, vetting,
  organising events)
- **40 trusted circle** — internal working group with elevated
  responsibilities

Roughly **half of members post at least sometimes**; roughly
**80% share or amplify**. These are coordination-network-active
members, not passive observers.

This matters for feed design: the feed is a list of things _to act
on_, not an entertainment stream. Users who've joined but aren't
posting or sharing are less common than in consumer social platforms.

---

## Volume — forthcoming

GPS leadership is providing estimates for posts/actions per week per
type:

- Tick/cross action posts (send an email, sign this)
- Social shares
- Send-email requests
- Join-group requests
- Shabbat Shalom and cultural moments
- Event announcements
- Meeting invites

These numbers will land in this doc when provided. Placeholder
estimates, pending real data:

| Post type         | Estimated weekly volume (placeholder) |
| ----------------- | ------------------------------------- |
| Tick/cross action | ~10/week                              |
| Social shares     | ~25/week                              |
| Send email        | ~3/week                               |
| Other types       | TBD                                   |

At current scale: ~200 posts/month total (order-of-magnitude).
At projected scale (1,000 coordinators): **plausibly 1,000-5,000
posts/month** — 10-25× current.

---

## Post types — real-world grounding

GPS leadership is providing **screenshots of actual WhatsApp posts**
so GPS Action's composer can reflect real usage, not hypothesised
taxonomy.

**Status:** screenshots pending.
**Impact:** until screenshots arrive, PostType taxonomy stays
deferred per D048. The composer UI (BU-composer for demo; BU-composer-fab
full composer post-demo) renders a simple form that doesn't branch
on type.

When screenshots arrive, expect 10-14 real post types. The working
list (to be validated):

- Join-group invitations
- Shabbat Shalom / cultural moments
- Share-this-post (amplification asks)
- Event announcements
- Meeting invitations
- Action calls (send an email)
- Tick/cross actions
- News shares with commentary
- Incident reports
- Outcome / report-back
- Discussion / questions
- Trusted-circle alerts (private)
- Volunteer recruitment
- Coordinator-to-coordinator handoffs

This is a best-guess list to be validated against real screenshots.

---

## Implications for technical design

### Schema

The `User` model may need:

- `selfDeclaredReach: Int?` — user's estimate of their own network
  size
- `verifiedReach: Int?` — GPS-verified estimate (optional, admin-set)
- `networkDescription: String?` — free-text description of their
  reach (what they lead, what list they write, etc.)

None of this is urgent for the demo. Consider for BU-admin (admin)
or post-demo.

### Feed performance

With 1,000-5,000 posts/month, the feed query is simple — trivially
fits in any index. No perf concerns at projected scale.

### Dispatch mechanics — the real volume driver

One post → 100 coordinators see it → 50 coordinators amplify it →
each to an average of 700 people → **35,000 downstream recipients
per amplified post**.

Some posts will have 350k+ reach (if all major coordinators amplify).
Dispatch infrastructure (email, WhatsApp share) must handle spikes.

This reinforces that **GPS Action is a coordination layer, not a
content layer**. Its job is to make the amplification decision and
the amplification action both easy and accurate. The amplification
itself happens through existing channels (WhatsApp, email, social).

### Moderation stakes

A post with mistaken facts or inappropriate tone, amplified through
350k reach, is a significant community event. Moderation is not a
nice-to-have. The schema supports it (Flag, OutcomeReview models)
but the UI and workflow need real investment post-demo.

### Audit volume

Every dispatch event, every post, every role change writes an audit
entry. At projected scale, audit volume is in the low-millions rows
per year — comfortable for Postgres, but partitioning or cold-storage
strategies may matter in year 2+. Parking-lot item: **audit log
retention policy**.

---

## Implications for product strategy

1. **Coordinator onboarding is a product pillar, not a feature.**
   Most members are coordinators; signing them up well matters.

2. **Reach matters more than membership.** 250 members with 350k
   reach is more interesting than 2,500 members with 3k reach.
   Metrics the exec cares about should reflect reach, not member
   count alone.

3. **The amplification chain IS the product.** Compose → reach
   coordinators → coordinators dispatch to their networks →
   recipients act → outcome reports close the loop. Features that
   shorten or clarify this chain are high-value.

4. **Dedup and cosurfacing (per product docs) are real.** With
   200+ coordinators each receiving the same original article,
   many will independently want to share it. Surfacing "this is
   already being amplified by 12 others — pile on here" prevents
   duplicated noise.

5. **The network is trust-scaffolded.** Coordinators vouch for
   their networks. The trust chain (GPS → coordinator → their
   network) is part of why it works. UX should make that
   scaffolding visible where helpful (authorship labels, amplifier
   lists, etc.).

---

## Updates to other docs

When this doc landed, these docs should reference it:

- `/docs/product/design-philosophy.md` — principle about reach
  being the unit, not membership
- `/docs/product/groups.md` — groups as sub-networks within the
  coordinator model
- `/docs/product/post-creation-flow.md` — composer design waits for
  screenshots per D048 note
- `/docs/architecture/decision-log.md` — D048 annotated as blocked-
  pending-screenshots; D049 (new) sketches the coordinator-role
  question

---

## What this doc does NOT resolve

1. **How reach is self-declared or verified** — future work
2. **Whether `coordinator` as a role stays or becomes a reach
   field** — D049 (proposed ADR, not yet decided)
3. **Specific post type taxonomy** — waiting on screenshots
4. **Exact volume per type** — waiting on GPS estimates
5. **Dispatch capacity planning** — premature until infrastructure
   exists to measure
6. **Monetisation / fundraising implications** — separate doc when
   relevant

---

## Provenance

These numbers come from GPS leadership input in April 2026. They
supersede any smaller/earlier assumptions in design docs. When
updated, record the date and source below.

### Revision log

- **2026-04 — initial capture.** 250 members; 350k reach via
  coordinator networks; 200 coordinators (projected 1,000+); activity
  mix as listed.
- Future updates: record new figures here as GPS leadership provides
  them.
