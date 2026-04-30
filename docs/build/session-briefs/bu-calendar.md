---
slug: bu-calendar
status: abandoned
phase: 2
priority: medium
superseded_by: bu-event-time
note: "Split on 2026-04-30 into bu-event-time (prerequisite: schema, composer, edit, PostCard, seed) and bu-calendar-view (depends: /calendar tab + agenda + month + nav). Two BUs run in parallel; bu-calendar-view branches off bu-event-time. See those two briefs for the live work."
---

# SESSION BRIEF · BU-calendar — SUPERSEDED

This brief was the initial single-bundle plan for a Calendar tab. Per
walk-through of open questions on 2026-04-30, the work was split into
two independently shippable BUs:

1. **bu-event-time** — schema (`event_at`, `event_ends_at`,
   `location_text`), composer date picker, edit page, PostCard event
   display, seed events, `listUpcoming` server query. Standalone value:
   richer post cards on `/feed` even before the calendar tab lands.
2. **bu-calendar-view** — `/calendar` route, agenda + month views,
   AppNav tab between Feed and Requests, feature-flag gate. Depends
   on bu-event-time's schema + query.

See those briefs for the live scope. This file is kept as a decision
record only.
