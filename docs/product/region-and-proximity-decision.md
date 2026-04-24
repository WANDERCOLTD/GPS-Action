# Region & proximity — decision memo

**Status:** DECIDED — 23 April 2026.
**Owner:** Paul, with input from Jeremy.
**Decision recorded by:** Paul.

---

## What this memo is

A working document that thought through how GPS Action handles **place** —
where members are, what they see, how queue managers are scoped, how content
flows.

The decision has now been made (see §"The decision" at the bottom). The
schema in `docs/architecture/erd.md` follows from these answers.

---

## Why this matters now

Every other entity in the system references "region" or "location" in some
way:

- **Users** are _somewhere_ (or live multiple places)
- **Posts** are _for_ someone (national? local? everywhere?)
- **Queue managers** are scoped to _somewhere_ (their patch)
- **Events** happen _at_ a place
- **Council action** requires knowing _which council_

If we get this wrong in Slice 1 of the schema, we're retrofitting it later
across every feature. If we get it right, every feature inherits a clean
spatial model.

This is the most important product decision in the schema.

---

## The reframe that prompted this memo

Initial assumption: region is **identity** — _what region am I in_ — picked
once at signup, derived everything from there.

Paul's reframe (23 April): region might be **proximity** — _what's near me
right now_ — derived from phone location at the moment of need.

Both are coherent. They're genuinely different products. The truth is
probably layered — proximity for the user-facing experience, structured
regions underneath for council action and queue-manager scope.

**Jeremy's reframe (23 April, later same day):** neither. Region is simply
an **optional tag on posts**. No filtering for members in MVP. No region
scope for queue managers in MVP. Solidarity across regions is a feature,
not a bug, at pilot scale.

---

## The three layers (model the schema must support)

### Layer 1 — Structured regions

A list of UK places with hierarchy:

- National
- Region (London, North West, Scotland, etc.)
- Council / borough (Brent, Camden, Manchester, etc.)

Each entry has:

- A name and slug
- A parent (for hierarchy queries)
- Council-specific data (council website, councillor contacts) — populated
  later for the council-action features

**Used for:** tagging posts, informational display in the UI, future filter
features. **Not used in MVP for:** member feed filtering, queue-manager
access scoping.

### Layer 2 — Member proximity

**Deferred.** No phone location, no postcode collection, no distance
calculations in MVP.

Considered for future if pilot shows members want "near me" filtering.

### Layer 3 — Post location

A post can have:

- One optional region tag (Manchester, London, National)
- Precise lat/lng — **deferred to when events ship as a first-class type**

Most posts in MVP will be untagged (global/everyone). Some will be tagged
("Event in Manchester") as informational display.

### Layer 4 — The filter chain

For MVP: **no filtering.** Every member sees every post. Region is an
informational tag, not a filter.

**Future filter:** member chooses one or more preferred regions; posts
tagged outside those regions get hidden from their default feed. Untagged
posts always show. Trigger: members complain about feed volume, or
coordinators want their community to see more focused content.

---

## The three questions — and what was decided

The original memo posed three positions per question. The actual decision
went outside those positions on Q2 and Q3 — into a new Position 2D and 3D
that are genuinely simpler.

---

### Q1 — Default privacy posture for location

**Original positions:**

- 1A — Postcode-only, location strictly optional
- 1B — Honest opt-in at onboarding
- 1C — Strongly encourage location

**DECIDED: N/A — no location services in MVP.**

No postcode collected. No location permissions requested. Location is not
part of the MVP data model for members.

**Reasoning:** Starting with no filtering means location isn't needed. If
later we add region filtering, members can simply tick which structured
regions they care about. Location services can be added Phase 2 if
proximity features are requested.

---

### Q2 — Default feed behaviour for a new member

**Original positions:**

- 2A — National only until customised
- 2B — National + 25-mile radius from postcode
- 2C — Everything by default; member filters down

**NEW POSITION 2D: Everyone sees everything. Region is an optional
informational tag on posts.**

- Default feed = every published post, ordered by recency
- No region filter, no proximity filter
- Posts may carry a region tag ("Manchester", "Glasgow") for informational
  display
- Members see these tags but cannot filter by them in MVP

**DECIDED: Position 2D.**

**Reasoning:**

- At pilot scale, feed volume is low enough that everyone seeing everything
  is a feature, not a bug — cross-regional solidarity
- Defers the privacy question
- Zero geospatial complexity
- Preserves the option to add filtering later without a schema change
  (regions already exist as a table; just enable the WHERE clause when
  needed)
- Member self-filtering is future work — add when members ask for it

**Example use cases that work cleanly:**

- "Event happening in Manchester" — tagged Manchester; everyone in the
  pilot sees it and understands where it is
- "Urgent — people needed now in Glasgow" — tagged Glasgow; everyone sees
  it; members not in Glasgow can still amplify or share with Glasgow
  contacts

---

### Q3 — Queue manager scope (originally "coordinator scope")

**Original positions:**

- 3A — Structured regions only
- 3B — Radius from anchor postcode
- 3C — Hybrid

**NEW POSITION 3D: No region scope for queue managers. Dynamic cohort,
single global queue.**

- Queue managers work from one unified queue regardless of region
- Dynamic cohort: admins grant and revoke queue_manager role at will
- No region filtering on queue views
- Region tags visible on work items but informational only

**DECIDED: Position 3D.**

**Reasoning:**

- Pilot cohort of queue managers is small — a shared workload with many
  eyes is more robust than regional assignments
- Workload self-balances without admin intervention
- Coverage gaps don't exist — everyone covers everything
- Simpler queue UX — no "switch region" mental overhead

**Revisit trigger:** if pilot reveals queue managers want region-focused
queues ("I'm better at vetting Londoners"), re-evaluate. Likely driver:
queue volume grows past the point where everyone seeing everything becomes
noisy.

---

## Related decision — coordinator role

A separate but intertwined decision made in the same conversation:

**"Coordinator" is an identifying fact about a member, not a permission.**

Coordinators run external communities (WhatsApp groups, newsletters,
community networks). GPS Action tracks this so future features can surface
amplification reach. But coordinator status grants no special powers in
GPS Action.

Queue management is a separate role (`queue_manager`) granted by admins
and revocable at will. A member can be:

- Just a member (most)
- A coordinator only (labelled, but no queue access)
- A queue manager only (queue access, no external groups)
- Both (labelled and has queue access)

Full detail: see D042 in the decision log, and admin-surface.md's role
model.

---

## Schema implications (what got simpler)

Compared to the default-lean I'd originally proposed (1B + 2B + 3A), the
actual decision simplifies significantly:

| Component                    | Under decided model      | Notes                                           |
| ---------------------------- | ------------------------ | ----------------------------------------------- |
| `User.homeLat/Lng`           | **Not in schema**        | No location collection                          |
| `User.allowLocationServices` | **Not in schema**        | No location permissions                         |
| `Region` table               | Yes, but simpler         | Hierarchy only; no centroids, no boundaries     |
| `Post.location`              | Optional region tag (FK) | No lat/lng for MVP                              |
| `Post.regionTag`             | Optional, FK to Region   | Used for display only                           |
| Feed query complexity        | **Simple**               | `ORDER BY createdAt DESC` with no region filter |
| PostGIS extension            | **Not needed**           | No geospatial queries                           |
| Queue manager scope          | **Not scoped**           | Global queue, all items visible                 |
| Coordinator identity         | Separate tables          | See D042 and admin-surface.md                   |

**No geospatial infrastructure in MVP.** No PostGIS, no distance
calculations, no radius queries. This is a meaningful simplification.

---

## What this memo does NOT cover

1. **Member moves house / life changes** — no home captured, so no change
   semantics to worry about
2. **Multiple homes** — same reason; out of scope
3. **International members** — region table is UK-focused; international
   reach would need an extended region model
4. **Region naming conventions** — editorial call for when we populate the
   table
5. **Region creation by admins** — per M5, regions pre-loaded (~20 major
   UK places + all standard regions + national), growable by admins on
   request
6. **Region merge / boundary changes** — operational concern, not relevant
   to MVP
7. **UI visualisation of regions** — admin dropdowns and post-tagging
   pickers; standard UI concern

---

## The decision

> **Q1 (privacy posture):** N/A — no location services in MVP. Location
> can be added Phase 2 if proximity features are requested.
>
> **Q2 (default feed):** Position 2D (new) — everyone sees everything.
> Region is an optional informational tag on posts. No filtering in MVP.
>
> **Q3 (queue manager scope):** Position 3D (new) — no region scope for
> queue managers. Single global queue. Dynamic cohort: admins grant/revoke
> queue_manager role at will.
>
> **Decided by:** Paul, in consultation with Jeremy.
> **Date:** 23 April 2026.
> **Follow-on decisions:**
>
> - D041 (Region as optional tag only)
> - D042 (Coordinator identity vs queue_manager permission split)

---

## What happens after the decision

1. ✅ ERD Slice 1 brief writes with these answers baked in
2. ✅ `Region` table is simple — hierarchy only, no geospatial data
3. ✅ `User` has no location fields
4. ✅ `Post` has an optional `regionTagId` FK
5. ✅ `WorkItem` has an informational `regionSlug` (for display, not filtering)
6. ✅ The default feed query pattern for BU-005 is `posts ORDER BY createdAt DESC` with no region filter
7. ✅ The queue UI for BU-001 shows every work item to every queue manager
8. ✅ Coordinator profile and role_grants schemas specified in admin-surface.md

---

## Related docs

- `docs/architecture/admin-surface.md` — role model (member / queue_manager
  / admin), coordinator-identity schema
- `docs/architecture/claim-and-lease.md` — WorkItem.regionSlug is
  informational only per this decision
- `docs/architecture/decision-log.md` — D041 and D042 record these decisions
  as formal ADRs
- `docs/product/parking-lot.md` — member region filtering (future), location
  services (future), coordinator verification (future), reach analytics
  (future)
