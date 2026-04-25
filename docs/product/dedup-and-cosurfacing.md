# Post deduplication & co-surfacing

**Purpose:** When two members independently try to surface the same content (same
URL), the product should quietly merge the second attempt into the first as a
comment — preserving both voices, avoiding feed duplication, and never making
anyone feel blocked or corrected.

**Status:** ABSORBING into feature spec v0.6. Will become §3.31.
**Build Unit:** BU-dedup (Post deduplication & co-surfacing) — to be created.
**Related:** D013 (self-dispatch default), design-philosophy principle 1
(one-click is king), analytics-events.md.

---

## The problem

With self-dispatch as default (D013), two members may independently notice the
same content and try to post it within minutes of each other. Without
intervention:

- The feed shows two posts asking for the same share — clutter, confusion.
- The first sharer's post may be marked "unread" for the second sharer, even
  though they engaged with the same content.
- Both sharers' voices get scattered across two threads, fragmenting any
  discussion.
- Double-dispatch to WhatsApp groups becomes likely.

## The principle

**Openness first.** We don't block. We don't hide. We merge gracefully and
preserve both voices.

The canonical post stays singular — it's Sharon's post, authored by Sharon.
Abby's attempt to post the same content becomes a comment on Sharon's post,
framed warmly to honour her independent contribution:

> _"Abby saw this too and wants to share."_

No co-authorship. No shared bylines. No ownership ambiguity. Just Sharon's
post with Abby's comment sitting naturally beneath it.

---

## Detection

### What counts as a duplicate (MVP)

**URL match after normalisation.** Two posts are considered duplicates if their
primary content URL, after normalisation, is identical.

**Normalisation rules:**

- Lowercase scheme and host
- Strip `www.` prefix
- Remove common tracking parameters: `utm_*`, `fbclid`, `gclid`, `mc_cid`,
  `mc_eid`, `ref`, `source`, `igshid`
- Resolve known URL shorteners (bit.ly, t.co, tinyurl, ow.ly) to their final
  destination before comparison
- Remove trailing slash
- Strip URL fragments (`#anchor`)
- Preserve query params that are semantically meaningful (e.g. `?v=abc123` on
  YouTube, `?p=123` on WordPress)

**Explicitly out of scope for MVP:**

- Image perceptual hashing (two posts of the same screenshot)
- Title similarity matching (same story, two different outlets)
- Body text similarity matching

These are Phase 2 enhancements. URL-match alone catches the large majority of
real-world cases and has zero false positives when correctly normalised.

### Time window

Configurable admin setting. Default: **24 hours**.

A post older than `dedup_window_hours` does not trigger dedup for new attempts.
After 24 hours (or the configured value), the content is fair game for fresh
framing.

**Setting:** `dedup_window_hours` (integer, range 1–168, default 24).
Changes audit-logged. Not a feature flag — it's a config value (per D036).

### Where detection runs

Server-side, at post creation time, before the post is persisted. Query:

```sql
SELECT id, author_id, created_at
FROM posts
WHERE normalised_url = $1
  AND created_at > NOW() - INTERVAL '$2 hours'
  AND status = 'published'
ORDER BY created_at DESC
LIMIT 1
```

The `normalised_url` column is populated at post creation, indexed.

---

## The flow (Variant A — one-step, auto-merge default)

Abby pastes a URL Sharon posted 2 hours ago. She finishes composing and taps
**Post**.

### Interstitial screen

Before the post is created, Abby sees:

> **Sharon posted this 2 hours ago** — [view her post]
>
> Your thoughts will be added as a comment so we keep it all in one place.
>
> **[Add my comment]** ← primary button
> [Post separately instead]

**Copy rules:**

- Warm, honest (design-philosophy principle 5)
- Sharon's name is a link that previews her post inline (small card) — Abby
  can see what she's about to join before deciding
- Time reference is relative ("2 hours ago," "yesterday," etc.) — humans
  think in relative time
- "Post separately instead" is visible, not buried. Not a tiny "more options" link.

### Path A — Abby taps "Add my comment" (the default)

1. Abby is taken to a **comment composer** on Sharon's post.
2. The composer is pre-populated with the system framing:
   > _"Abby saw this too and wants to share."_
3. Below that, a collapsed disclosure: **"Include what you wrote? [show]"**
4. If expanded, her original draft is there for her to copy or paste fragments
   from. She can leave the default framing, replace it with her own words, or
   combine them.
5. She submits → comment lands on Sharon's post with metadata flag
   `origin: duplicate_merged` (see analytics below).
6. Sharon receives a **specific notification** (see below).
7. Abby's feed marks Sharon's post as **read** (she engaged with it).

### Path B — Abby taps "Post separately instead"

1. Her original post is created as normal, as a new top-level feed item.
2. No comment is added to Sharon's post.
3. Analytics event `post_merge_declined` fires so we can measure how often this
   happens (signal for future spec decisions).
4. Abby's feed marks Sharon's post as **read** anyway — she engaged with the
   content knowingly when she decided to post separately.

### Path C — Abby taps Cancel (X or back gesture)

1. Returns to her draft untouched — she may be thinking.
2. Sharon's post is marked **read** for Abby (she engaged).
3. No analytics event beyond `post_merge_suggested` which fired on interstitial
   show.

---

## Read-state rules (summary)

| Who                                                 | Their read state for Sharon's canonical post |
| --------------------------------------------------- | -------------------------------------------- |
| Sharon (the author)                                 | Read (she posted it)                         |
| Abby, who merged her post as a comment (Path A)     | Read                                         |
| Abby, who chose to post separately (Path B)         | Read                                         |
| Abby, who cancelled the dedup interstitial (Path C) | Read                                         |
| Any other member                                    | Unread until they view, as normal            |

**Rule:** Any interaction with the dedup interstitial marks the canonical post
as read for the interacting user. Engagement is engagement, regardless of the
branch taken.

---

## Sharon's notification

When a merged comment (`origin: duplicate_merged`) lands on her post:

> **"Abby saw this too and added her thoughts to your post."**

Not the generic:

> ~~"Abby commented on your post."~~

**Why:** the specific copy tells Sharon something genuinely different — a second
member independently chose to surface this content. That's a reach signal she'd
want to know. Generic copy flattens it into noise.

**Implementation:** the notification template keys on the comment's `origin`
field. `duplicate_merged` → specific copy. `manual` → standard copy.

---

## Dispatch interaction

When Abby sees the dedup interstitial, she also sees the dispatch indicator
(the WhatsApp-logo + groups popover from the v0.5 dispatch discussion):

> **Sharon posted this 2 hours ago**
> _Sent to: Boost/Remove Channel, North West Coordinators_
>
> Your thoughts will be added as a comment so we keep it all in one place.
> ...

If Sharon has already dispatched to the groups Abby was planning, Abby sees
this immediately — preventing double-dispatch without any additional UX.

If Sharon _hasn't_ dispatched yet, Abby (or anyone) can still self-dispatch
from the canonical post as normal. Dispatch is a post-level action, not
author-restricted. This matches D013.

---

## Data model additions

### `posts` table

- `normalised_url` (text, indexed) — populated at insert; recomputed if URL changes
- `has_merged_comments` (boolean, derived) — true if any comment has `origin: duplicate_merged`; UI hint

### `comments` table

- `origin` (enum: `manual`, `duplicate_merged`, `system_generated`) — default `manual`
- `attempted_post_draft` (text, nullable) — the original draft Abby had written,
  preserved for her access but not shown publicly by default
- `attempted_dispatch_targets` (text[], nullable) — groups she was intending to
  dispatch to, captured for analytics

No new table needed. The merging is a semantic relationship (Abby's comment ON
Sharon's post), not a new entity.

---

## Analytics events

Three new events added to the pilot instrumentation set:

### `post_merge_suggested`

**When:** Dedup interstitial is shown to a user.
**Properties:** `canonical_post_id_hash`, `time_since_canonical_hours` (number),
`attempting_user_id_hash`.
**Fired from:** `server/routers/post.ts:publish` (server-side, before persist).
**Answers:** "How often is dedup detection firing?"

### `post_merge_accepted`

**When:** User accepts the merge (Path A).
**Properties:** `canonical_post_id_hash`, `time_on_interstitial_seconds`,
`kept_original_draft` (bool — did they include their original text via disclosure).
**Fired from:** `server/routers/comment.ts:add` when `origin: duplicate_merged`.
**Answers:** "Is the default working? Are people accepting the merge?"

### `post_merge_declined`

**When:** User chooses "Post separately instead" (Path B).
**Properties:** `canonical_post_id_hash`, `time_on_interstitial_seconds`,
`reason_category` (optional, if we add a lightweight reason picker later).
**Fired from:** `server/routers/post.ts:publish` when user confirms bypass.
**Answers:** "When do people override the default? Do we need to tune the
detection or the flow?"

**Expected ratio at pilot:** `accepted` should be 60–80% of `suggested`. If
`declined` dominates, the detection is too aggressive (false positives) or
the framing is wrong.

---

## Copy library additions

These system-generated strings live in `docs/product/copy-library.md` so
Claude Code uses them consistently:

| Key                                | Copy                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `dedup.interstitial.headline`      | "{author_first_name} posted this {relative_time}"                          |
| `dedup.interstitial.reassurance`   | "Your thoughts will be added as a comment so we keep it all in one place." |
| `dedup.interstitial.primary_cta`   | "Add my comment"                                                           |
| `dedup.interstitial.secondary_cta` | "Post separately instead"                                                  |
| `dedup.comment.default_framing`    | "{author_first_name} saw this too and wants to share."                     |
| `dedup.comment.disclosure_label`   | "Include what you wrote?"                                                  |
| `dedup.notification.specific`      | "{commenter_first_name} saw this too and added her thoughts to your post." |

Note on pronouns: "her" in the notification above assumes Abby is the example.
Real implementation uses `{commenter_first_name} saw this too and added their
thoughts to your post.` — "their" is neutral, honest, and matches design
philosophy (no assumptions about member identity).

---

## Edge cases — thought through

### What if Sharon's post was deleted?

No dedup match, because the query filters on `status = 'published'`. Abby's
post goes through as a new top-level post.

### What if Abby's attempt has a _different_ URL that normalises to the same?

Caught — normalisation is the key. e.g. `https://bbc.co.uk/news/12345` and
`https://www.bbc.co.uk/news/12345?utm_source=twitter` match after normalisation.

### What if the URL resolves through a shortener to match Sharon's direct URL?

Caught — shortener resolution is part of normalisation. Worth noting this adds
latency to post creation (resolution can take 200–500ms). Mitigation: cache
shortener resolutions for 7 days.

### What about a URL with legitimately distinct content? (e.g. same host, different story)

The normalisation preserves the path and meaningful query params, so
`bbc.co.uk/news/12345` and `bbc.co.uk/news/67890` do not match. Different
stories, no false dedup.

### What if two users hit "Post" within the same second?

Race condition. Handled via database unique index on `(normalised_url, created_at_hour_bucket)`
or — simpler — by serializing post-creation on `normalised_url` with a brief
advisory lock. Second-comer sees the first as already-existing and gets the
dedup flow.

Decision: **advisory lock** approach. Simpler than bucket indexing, handles
the race correctly, releases automatically on transaction commit.

### What if someone wants to post the same URL 25 hours after the first?

No dedup triggers — outside the window. Their post appears as a fresh top-level
item. If this becomes a pattern ("the same article keeps getting posted every
day"), that's a product signal worth reviewing; not a dedup problem to solve in
MVP.

### What if the canonical post author (Sharon) is the one re-posting her own URL within the window?

Dedup still fires — but the interstitial copy adapts:

> "You posted this earlier today — do you want to add a new comment instead?"

Her old post remains canonical; her new thoughts become a comment. Consistent
with the principle — the canonical post is singular.

### What if the post has multiple URLs in its body?

MVP rule: **primary URL only**, where primary = the first URL in the body that's
not an image embed. Documented as a known limitation. Phase 2 enhancement:
multi-URL dedup with a disambiguation step if multiple URLs match different
canonical posts.

---

## What this spec does NOT cover

Calling these out explicitly (per the pattern I'm adopting) so gaps are visible:

1. **Image-only posts** — same screenshot, different pastes. Phase 2
   (requires perceptual hashing infrastructure).
2. **Title/body similarity** — same story from two different news outlets.
   Phase 2 (requires NLP infra or an LLM call, latency and cost tradeoffs).
3. **Cross-channel dedup** — if GPS Action later integrates with Telegram or
   similar, dedup across channels needs its own design.
4. **Bulk dedup for imported content** — if admins backfill posts from another
   system, bulk dedup rules will differ.
5. **Revocation / un-merge** — if Abby realises she wanted her own post after
   all. For MVP: she can delete her comment and post separately. A proper
   un-merge flow is Phase 2 if the need is real.
6. **"I was first" disputes** — both posts created within milliseconds of each
   other; whichever hit the database first wins. If this becomes a social
   tension, a fairness policy might be needed. Unlikely at MVP scale.

---

## Implementation sketch for Claude Code

When BU-dedup is briefed, the session should expect to:

1. Add `normalised_url` column + migration to `posts` table (two-phase if
   backfilling existing posts).
2. Add `origin`, `attempted_post_draft`, `attempted_dispatch_targets` columns
   to `comments` table.
3. Write the URL normalisation utility (`server/lib/url/normalise.ts`) with
   comprehensive tests — this is the riskiest piece and must not be cavalier.
4. Write the shortener resolver with caching.
5. Wire detection into the `publish` tRPC procedure.
6. Build the dedup interstitial component (Storybook stories for all three paths).
7. Build the comment composer variant that accepts `duplicate_merged` origin
   with the disclosure pattern.
8. Wire the three analytics events.
9. Update the notification template for `duplicate_merged` origin.
10. Seed data generator produces a dedup scenario (one post + one merged comment)
    so Storybook and previews show this working.
11. Integration test: two attempts to post the same URL within the window →
    canonical post + merged comment + correct notification + correct read-state.

**Estimated sessions:** 3–4 Claude Code sessions. Largest piece is URL
normalisation + shortener resolution with proper test coverage.

**Depends on:** BU-composer (post publishing), BU-comments (comments), BU-auth (notifications).

**Blocks:** Nothing critical — this is a quality-of-life feature, not a
foundation. Can ship mid-build.
