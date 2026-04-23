# Region & proximity — decision memo

**Status:** OPEN — awaiting product decision before Slice 1 of the ERD lands.
**Owner:** Paul, with input from Jeremy and Sharon.
**Decision recorded by:** *(name and date when decided)*

---

## What this memo is

A working document to think through how GPS Action handles **place** —
where members are, what they see, how coordinators are scoped, how content
flows.

This memo is not a recommendation document — it's a *thinking* document. It
lays out the three questions that need answers, the tradeoffs honestly, and
proposed positions you can adopt, modify, or reject.

When the decision is made, the answers go at the bottom of this file
(section "The decision") and the schema in `docs/architecture/erd.md` follows.

---

## Why this matters now

Every other entity in the system references "region" or "location" in some
way:
- **Users** are *somewhere* (or live multiple places)
- **Posts** are *for* someone (national? local? everywhere?)
- **Coordinators** are scoped to *somewhere* (their patch)
- **Events** happen *at* a place
- **Council action** requires knowing *which council*

If we get this wrong in Slice 1 of the schema, we're retrofitting it later
across every feature. If we get it right, every feature inherits a clean
spatial model.

This is the most important product decision in the schema. It's also the one
where I (Claude) cannot decide for you — it's about how you want GPS Action
to *feel*, not about what's technically optimal.

---

## The reframe that prompted this memo

Initial assumption: region is **identity** — *what region am I in* — picked
once at signup, derived everything from there.

Paul's reframe (23 April): region might be **proximity** — *what's near me
right now* — derived from phone location at the moment of need.

Both are coherent. They're genuinely different products. The truth is
probably layered — proximity for the user-facing experience, structured
regions underneath for council action and coordinator scope.

---

## The three layers (model the schema must support)

### Layer 1 — Structured regions

A list of UK places with hierarchy:
- National
- Region (London, North West, Scotland, etc.)
- Council / borough (Brent, Camden, Manchester, etc.)
- Optionally: ward (within a council)

Each entry has:
- A name and slug
- A position (lat/lng centroid)
- Optionally: a boundary shape
- A parent (for hierarchy queries)
- Council-specific data (council website, councillor contacts) — populated
  later for the council-action features

**Why we need this layer regardless of how proximity is used:**
- Council action ("email your councillor") needs structured regions —
  there's no "councillor for a 25-mile radius"
- Coordinator scoping is cleanest with structured assignments
- Reporting and analytics group naturally by structured regions
- The Module 11 councillor campaign engine in the original SRS is built on
  this

### Layer 2 — Member proximity

The user-facing layer. A member's "near me" is computed from:
- Phone location (if permission granted)
- OR home postcode (a fallback single point)
- AND a radius preference (default 25 miles, member can change)

This is what powers the default "what's happening near me" feed.

### Layer 3 — Post location

A post can have:
- One or more structured region tags (Brent, London, National)
- A precise lat/lng (for events, incident reports, place-specific content)
- An "is national" flag (overrides regional filtering)

Most posts are tagged with a structured region; events and incidents add
precise location too; some posts are explicitly national.

### Layer 4 — The filter chain

A member's default feed becomes a query roughly like:
> Show me posts where any of: I've subscribed to that structured region, OR
> the post's location is within my radius, OR the post is national.

Each filter is a member-configurable preference.

---

## The three questions for the decision

The questions are not "which schema to use" — that follows from the
answers. They're "how should GPS Action *feel* on these three dimensions?"

---

### Q1 — Default privacy posture for location

**The question:** When Sharon signs up, what's the relationship between
GPS Action and her phone's location?

**Three positions:**

#### Position 1A — Postcode-only, location strictly optional
- Signup asks for a postcode. That's the only spatial input required.
- Location services are never proactively requested.
- Members who want fresher proximity (e.g. while travelling) can enable it
  later in settings.
- **Posture:** "We respect your location is yours. Postcode is enough."

#### Position 1B — Honest opt-in at onboarding (recommended starting point)
- Signup asks for postcode (always).
- Onboarding includes a clear, honest moment: *"Allow GPS Action to use your
  location? We use this to show you content and events near you. You can
  always say no — your postcode will work."*
- Members who allow location get fresher proximity. Members who don't get
  the postcode-derived experience.
- **Posture:** "We're honest about why we'd want this. We respect 'no'."

#### Position 1C — Strongly encourage location
- Signup nudges towards location-on. Postcode is the fallback.
- Onboarding implies location is the "proper" experience.
- **Posture:** "GPS Action works best with location."

**Tradeoffs:**
- 1A is most privacy-respectful but loses the "near me" feel for travelling
  members.
- 1B is the honest middle ground — most users say yes when asked clearly.
- 1C feels coercive in the current cultural moment. Avoid.

**Considerations specific to GPS Action:**
- Members may be concerned about being tracked given the sensitive nature
  of GPS work. Many will be deliberate about location permissions.
- Older or less tech-comfortable members may decline by default.
- Coordinators may have strong opinions on what they want.

**Default lean if no decision made:** Position 1B.

---

### Q2 — Default feed behaviour for a new member

**The question:** Sharon has just signed up. She hasn't customised
anything. What does she see when she opens GPS Action for the first time?

**Three positions:**

#### Position 2A — National only until customised
- Default feed = posts marked `is_national = true`
- Sharon sees national-interest content from day one.
- A prominent prompt invites her to add her postcode / regions for local
  content.
- **Posture:** "Here's the national picture. Tell us where you are for the
  local picture."

#### Position 2B — National + 25-mile radius from postcode (recommended starting point)
- Postcode collected at signup → 25-mile default radius
- Default feed = national posts + posts within 25 miles of her postcode
- Sharon sees something concrete and locally relevant immediately
- A subtle UI prompt to widen / narrow / adjust regions
- **Posture:** "Here's what's near you and what's happening nationally."

#### Position 2C — Everything by default; member filters down
- Default feed = every post in the system
- Filters available: by region, by topic, by post type
- Sharon decides what to remove
- **Posture:** "Here's everything. Filter what doesn't matter to you."

**Tradeoffs:**
- 2A is safe but boring on day one — Sharon may not understand what GPS
  Action *is* if she only sees national headlines.
- 2B feels relevant out of the box, prompts the natural next action
  (adjust filters), but assumes location is enough to define relevance.
- 2C overwhelms — first-time members will bounce off the firehose.

**Considerations specific to GPS Action:**
- A pilot member should have a "wow" moment, not a blank screen.
- Local action is a core value — surfacing it by default reinforces what
  the product is *for*.
- 2C might suit power users (coordinators) but breaks for newcomers.

**Default lean if no decision made:** Position 2B.

---

### Q3 — Coordinator scope: structured or fuzzy?

**The question:** When Grant is "the South-West London coordinator," what
does that mean technically? What can he see in the queue? What does the
admin surface show him?

**Three positions:**

#### Position 3A — Structured regions only (recommended starting point)
- Each coordinator is assigned to one or more structured regions
  (e.g. Grant: Wandsworth, Lambeth, Merton)
- His queue shows work items tagged with those regions
- Clear, predictable, no ambiguity
- "National" coordinators have access to all regions
- **Posture:** Coordinator scope is a list, not a fuzzy area.

#### Position 3B — Radius from anchor postcode
- Each coordinator has a postcode + radius
- His queue shows work items whose region's centroid is within the radius
- More flexible (Grant can be the "primary coordinator" for what's actually
  near him)
- **Posture:** Coordinator scope is "near me, professionally."

#### Position 3C — Hybrid
- Coordinator has *both* a list of structured regions AND a radius
- His queue shows work items matching either
- "I cover Wandsworth, Lambeth, Merton — and anything within 10 miles of
  my postcode that isn't yet claimed"
- **Posture:** Both clean assignment and flexible reach.

**Tradeoffs:**
- 3A is operationally clean. If a flag is in Brent, Brent's coordinators
  see it. No ambiguity. Easy to govern, easy to audit, easy to load-balance.
- 3B is fuzzy. If Grant's postcode is in West London with a 10-mile
  radius, his queue overlaps with five other coordinators' radiuses. Whose
  flag is whose? Conflict-prone.
- 3C tries to give both, but the "either" logic creates the same conflict
  problem as 3B for the radius portion.

**Considerations specific to GPS Action:**
- Coordinator workload balancing matters — if everyone in London sees every
  London flag, no one feels owned. Structured assignment forces ownership.
- Coverage gaps (a region with no assigned coordinator) need explicit
  handling — they become "national" or "unassigned" by default.
- Members get fuzzy proximity (they're casually browsing); coordinators get
  clean assignments (they're working).

**Default lean if no decision made:** Position 3A.

---

## What changes based on the answers

The schema implications differ meaningfully:

| Component | If 1A + 2A + 3A | If 1B + 2B + 3A | If 1C + 2C + 3C |
|---|---|---|---|
| `User.homeLat/Lng` | Optional, postcode-derived | Optional, two sources | Required |
| `User.allowLocationServices` | Default false | Default false, nudged | Default true |
| `Region` table | Hierarchy + centroids | Hierarchy + centroids + boundaries | Same as 1B |
| `Post.location` | Tags only | Tags + optional lat/lng | Tags + lat/lng + radius |
| Feed query complexity | Simple | Moderate (geospatial) | Complex (geospatial + multi-source) |
| PostGIS extension | Optional | Recommended | Required |
| Coordinator scope query | Simple (region IN ...) | Simple (region IN ...) | Complex (region OR radius) |

**The default lean (1B + 2B + 3A) is moderate complexity** — geospatial
queries for member feeds, structured queries for coordinator scopes. PostGIS
recommended but not strictly required for MVP.

---

## What this memo does NOT cover

(The pattern — naming what's deferred.)

1. **Member moves house** — what happens to their feed and subscriptions
   when their postcode changes. Worth a paragraph in the spec; not a
   product call.
2. **Multiple homes** — members with a London base and a country place,
   or family in two regions. Default: one postcode, one radius. Multi-home
   support is parking lot.
3. **International members** — UK Jewish community has diaspora ties.
   Postcode + radius assumes UK; international members would need different
   handling. Defer.
4. **Region naming** — "London Borough of Brent" vs "Brent" vs "Brent
   Council." Editorial. Not part of this decision.
5. **Region creation by admins** — can admins add new regions, or is the
   list fixed? Default: pre-loaded from ONS data; admins request additions.
6. **Region merge / boundary changes** — councils occasionally merge or
   reorganise. Operational concern; not relevant to MVP.
7. **Visualisation of regions** — maps in the UI, region pickers, etc.
   UI concerns; ERD supports either way.

---

## Suggested process for making the decision

If you're making the call alone:
1. Read each question. Sit with the position you'd default to.
2. Ask yourself: would Sharon agree? Would Jeremy? If unsure on either,
   raise it before deciding.
3. Record your answer below.

If you're making it with Jeremy and Sharon:
1. Send them this memo before the conversation
2. Half-hour call, walk through the three questions
3. Aim for one position per question, not consensus on every detail
4. Record the outcome below

If you can't get a decision in a reasonable timeframe:
1. Adopt the default leans (1B + 2B + 3A) provisionally
2. Note the assumption in the schema
3. Commit to revisiting after pilot week 2 with real data

---

## The decision

*To be filled in when made. Format:*

> **Q1 (privacy posture):** Position __ — *(brief reasoning)*
>
> **Q2 (default feed):** Position __ — *(brief reasoning)*
>
> **Q3 (coordinator scope):** Position __ — *(brief reasoning)*
>
> **Decided by:** _____________
> **Date:** _____________
> **Anyone consulted:** _____________

Once recorded, this memo's status changes to **DECIDED** and the schema in
`docs/architecture/erd.md` follows from the answers.

---

## What happens after the decision

1. ERD Slice 1 is briefed with the chosen positions baked in
2. Slice 1 includes the `Region`, `UserRegion`, `User` (with home location
   fields per the chosen position), and other foundation entities
3. PostGIS extension is enabled or not based on Q2's choice
4. The default feed query pattern is documented for BU-005 (Feed) to follow
5. The coordinator-scope middleware pattern is documented for BU-001 (Admin
   scaffolding) to follow

---

## Related docs

- `docs/architecture/admin-surface.md` — coordinator role model assumes
  region scoping per Q3
- `docs/architecture/claim-and-lease.md` — `WorkItem.regionSlug` field
  assumes structured regions
- `docs/product/parking-lot.md` — multi-home, international members,
  member-defined regions all parked
- `docs/architecture/decision-log.md` — once decided, this becomes ADR D041
