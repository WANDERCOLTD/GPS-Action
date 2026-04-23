# Analytics events — pilot instrumentation

**Purpose:** The minimum set of events to answer the questions the pilot must
answer. Not an encyclopaedia. Everything below must be instrumented before
pilot launch; anything not below is explicitly deferred.

**Destination:** PostHog (see D037).
**Privacy:** Hashed IDs and enums only. No PII. See section "PII policy" below.
**Related:** D037 (observability), D036 (feature flags), D038 (traceability).

---

## The questions we're trying to answer

Every event below exists to serve at least one of these questions. If you're
proposing a new event, point it at a question or don't add it.

1. **Are people using it?** (DAU / WAU / MAU, stickiness)
2. **Are they coming back?** (retention cohorts by signup week)
3. **Does it reduce WhatsApp noise?** (self-report at pilot checkpoints + publish rate)
4. **Do actions actually happen?** (ratio of `action_taken` to `post_published` on action posts)
5. **Where do new members drop off?** (onboarding funnel)
6. **Which features are loved vs ignored?** (feature usage counts by post/action type)
7. **Is moderation load manageable?** (flag rate, vetting latency)

---

## Event envelope

Every event shares this structure:

```json
{
  "event": "post_published",
  "distinct_id": "hash_of_user_id",
  "session_id": "uuid",
  "timestamp": "2026-04-23T14:32:01Z",
  "platform": "ios | android | web",
  "app_version": "0.6.1",
  "properties": {
    /* event-specific, see below */
  }
}
```

`distinct_id` is `sha256(user_id || salt)`. PostHog sees the hash, never the raw
ID. PII-safe for export and third-party analytics.

---

## The 16 events (MVP set)

Each entry: **name**, **when it fires**, **properties**, **fired from**,
**Build Unit**, **answers question(s)**.

### Identity & onboarding (5)

#### `signup_started`
**When:** User lands on invite link and the signup screen renders.
**Properties:** `invite_source` (enum: whatsapp, email, direct, other), `referring_member_id_hash?`
**Fired from:** Signup page (client-side, on mount).
**Build Unit:** BU-002 (Onboarding)
**Answers:** Q5 (funnel entry)

#### `signup_completed`
**When:** Account record created, user entered vetting queue.
**Properties:** `has_referrer` (bool)
**Fired from:** `server/routers/auth.ts:createAccount` (server-side)
**Build Unit:** BU-002
**Answers:** Q5

#### `vetting_approved`
**When:** Admin approves a vetting case.
**Properties:** `time_to_approval_hours` (number)
**Fired from:** `server/routers/vetting.ts:approve` (server-side)
**Build Unit:** BU-004 (Vetting workflow)
**Answers:** Q5, Q7

#### `first_post_published`
**When:** User publishes their first-ever post.
**Properties:** `days_since_approval` (number), `post_type`
**Fired from:** `server/routers/post.ts:publish` (server-side, checked via count)
**Build Unit:** BU-003 (Post publishing)
**Answers:** Q5, Q1

#### `first_action_taken`
**When:** User taps their first-ever action.
**Properties:** `days_since_first_post` (number), `action_type`
**Fired from:** `server/routers/action.ts:take` (server-side, checked via count)
**Build Unit:** BU-006 (Actions)
**Answers:** Q4, Q5

### Core activity (6)

#### `post_viewed`
**When:** A post renders in the feed AND is >50% visible for >500ms.
**Properties:** `post_type`, `position_in_feed` (int), `source` (enum: feed, region, search, direct)
**Fired from:** `app/components/FeedItem.tsx` (client-side, IntersectionObserver)
**Build Unit:** BU-005 (Feed)
**Answers:** Q1, Q6
**Sampling:** Rate-limited to one per post per session to avoid noise.

#### `post_published`
**When:** A post is successfully created.
**Properties:** `post_type`, `region_slug`, `has_image` (bool), `body_length_bucket` (enum: short, medium, long), `is_action_post` (bool)
**Fired from:** `server/routers/post.ts:publish`
**Build Unit:** BU-003
**Answers:** Q1, Q3, Q6

#### `action_taken`
**When:** User taps the action CTA on a post.
**Properties:** `action_type`, `post_id_hash`, `time_since_post_created_seconds` (number)
**Fired from:** `server/routers/action.ts:take`
**Build Unit:** BU-006
**Answers:** Q4, Q6

#### `comment_added`
**When:** Comment successfully posted.
**Properties:** `post_id_hash`, `is_system_generated` (bool), `has_attachment` (bool)
**Fired from:** `server/routers/comment.ts:add`
**Build Unit:** BU-007 (Comments)
**Answers:** Q1, Q6

#### `reaction_added`
**When:** User taps a reaction emoji.
**Properties:** `reaction` (enum, 14 core + 3 seasonal), `post_id_hash`, `is_comment` (bool)
**Fired from:** `server/routers/reaction.ts:add`
**Build Unit:** BU-008 (Reactions)
**Answers:** Q1, Q6

#### `post_shared_out`
**When:** User completes a 1-click share (not just tapping share, but the share actually dispatching).
**Properties:** `destination` (enum: whatsapp, x, email, copy_link, other), `post_type`, `post_id_hash`
**Fired from:** `app/components/ShareMenu.tsx` (client, after OS confirms handoff)
**Build Unit:** BU-010 (Sharing)
**Answers:** Q3, Q6

### Moderation (3)

#### `post_flagged`
**When:** User submits a flag on a post.
**Properties:** `reason_category` (enum), `post_id_hash`, `time_since_post_published_hours` (number)
**Fired from:** `server/routers/flag.ts:flagPost`
**Build Unit:** BU-012 (Flagging)
**Answers:** Q7

#### `vetting_case_opened`
**When:** Admin opens a vetting case for review.
**Properties:** `case_age_hours` (number)
**Fired from:** `server/routers/vetting.ts:open`
**Build Unit:** BU-004
**Answers:** Q7

#### `vetting_case_resolved`
**When:** Vetting case is closed.
**Properties:** `outcome` (enum: approve, reject, request_info, ban), `time_open_hours` (number)
**Fired from:** `server/routers/vetting.ts:resolve`
**Build Unit:** BU-004
**Answers:** Q7

### Dispatch (2)

#### `dispatch_started`
**When:** User opens the dispatch modal on a post.
**Properties:** `post_type`, `post_id_hash`
**Fired from:** `app/components/DispatchModal.tsx` (client, on open)
**Build Unit:** BU-011 (Dispatch)
**Answers:** Q3

#### `dispatch_completed`
**When:** User completes the dispatch flow (destinations confirmed).
**Properties:** `num_destinations` (int), `destinations_categories` (enum array), `time_to_dispatch_seconds` (number)
**Fired from:** `server/routers/dispatch.ts:complete`
**Build Unit:** BU-011
**Answers:** Q3

---

## Events explicitly NOT tracked in MVP

These have been considered and deferred — don't add them without a decision:

| Event | Why not |
|---|---|
| Scroll depth granularity | Too noisy at this scale; pilot too small for the signal |
| Click heatmaps | Over-engineering; not needed for pilot decisions |
| Time-on-screen per view | Battery drain + PII risk + weak signal |
| Search queries | Skip until search is a priority feature |
| Keystroke timing / typing patterns | Creepy; no clear use |
| Individual comment text or post body | PII — never track content |
| Referral viral coefficient | Meaningful only at scale; revisit post-pilot |

---

## Dashboards the events feed

Each dashboard lives as a saved PostHog insight (or collection of insights).
Named owner for each — that person keeps them current.

1. **Daily activity** — DAU, publishes, actions, comments over 7/28 days. Owner: Paul.
2. **Onboarding funnel** — `signup_started` → `vetting_approved` → `first_post_published` → `first_action_taken`. Step conversion + drop-off. Owner: Paul.
3. **Feature adoption** — counts per `post_type`, per `action_type`, per `reaction`. Identifies the quiet corners. Owner: Product lead.
4. **Moderation load** — flags per day, flag rate (flags ÷ posts), median vetting time, vetting outcomes breakdown. Owner: Moderation lead.
5. **Cohort retention** — Week N retention from signup week. Answers Q2. Owner: Paul.
6. **Pilot health scorecard** — single-page view of the five numbers that matter most (see "success criteria" below). Reviewed fortnightly in pilot reviews. Owner: Paul.

---

## Implementation rules

1. **PostHog is the destination.** One client library for the app, server-side
   emission from tRPC procedures. Do not add second analytics destinations without
   an ADR.
2. **Events are fire-and-forget.** Never block a user action waiting for
   analytics to ack. Failures are logged to Sentry but do not surface to the user.
3. **Server-side when possible, client-side when necessary.** 
   - State changes (publish, flag, resolve) = **server**.
   - Purely user-visible events (view, modal-opened) = **client**.
   - Double-tracking the same logical event from both client and server is a bug.
4. **PII never in properties.** No emails, display names, post bodies, comment
   text. Hashed IDs and enums only. Reviewer checks this on every PR touching
   analytics.
5. **Every new event added in a PR updates this doc.** No undocumented events.
   Reviewer rejects PRs that add events without updating the catalogue.
6. **Retention policy.** Raw events kept 180 days in PostHog. Aggregates
   (dashboards, saved insights) retained indefinitely. Personal data requests
   (DSAR) can force-delete all events for a `distinct_id`.

---

## PII policy

**Never send:**
- Raw `user_id` (use `distinct_id = sha256(user_id || salt)` only)
- Email, display name, phone, postcode, IP
- Post body, comment text, flag free-text reason
- File names, file contents
- URLs of user-uploaded content (the URL itself can be identifying)

**Safe to send:**
- Hashed user IDs
- Hashed post/comment IDs (for correlation across events)
- Enums (post_type, action_type, reason_category, outcome)
- Counts and durations
- Boolean flags (has_image, is_action_post)
- Region slugs (public; already visible in UI)

**Edge cases — ask before sending:**
- Timestamps at millisecond precision (possible fingerprinting vector; use minute-bucketed where feasible)
- Combined location + time data (can re-identify even with hashed ID)

---

## Pilot success criteria (measurable)

These are hypotheses we'll test. Not guarantees. Reviewed fortnightly; adjusted
with Jeremy and Sharon based on what we learn.

| Metric | Target | Source event(s) |
|---|---|---|
| DAU/WAU ratio at week 4 | > 0.5 | `post_viewed`, `post_published`, `action_taken` |
| Onboarding funnel: signup → first post | ≥ 60% within 7 days | The 5 identity events |
| Actions per action-post | ≥ 1.0 average | `action_taken` ÷ action posts |
| Flag rate | < 5% of posts | `post_flagged` ÷ `post_published` |
| Median vetting time | < 24 hours | `vetting_case_resolved.time_open_hours` |
| Week 2 → Week 4 retention | > 70% | Cohort from `signup_completed` |

When a metric misses the target, the fortnightly review discusses: **is the
metric wrong, is the feature wrong, or is the cohort wrong?** One of the three.

---

## Deferred decisions

- **Server-side PostHog proxy?** Under consideration to reduce client-side script
  size and avoid tracker blocking. Decide before GA.
- **Reverse-ETL to warehouse?** Only if PostHog becomes limiting. Not MVP.
- **A/B testing?** Out of scope. No infra until we have a concrete experiment design.
