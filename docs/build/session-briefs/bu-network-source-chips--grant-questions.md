---
slug: bu-network-source-chips--grant-questions
status: pending-answers
phase: 2
note: "Questions for Grant (AIFA) blocking bu-network-source-chips. Draft 2026-05-11. Send via Slack / call. Mark answered as we go."
---

# Questions for Grant — `gps_chat_labels` + URL extraction

_Context for Grant: GPS Action is making `/network` the canonical feed,
retiring `/feed`. We need to filter by source (WhatsApp group) and want
to plan against your actual view shape rather than guess. We've also got
some carryover questions on `gps_group_messages` URL extraction from
the unfurl-fixes pass (PR #338, shipped 2026-05-11)._

---

## A. `gps_chat_labels` — the labels view (new)

We're assuming you'll expose a view that maps `chat_id` → some
display info. To plan our chip strip, we need to know its shape and
semantics:

### A1 · Stable slug column?

Will the view carry a stable `slug` (kebab-case, never changes)
alongside the human `label`?

We need a slug for URL state — `/network?source=hendon-jag,friends-of-gps`.
A label like "Hendon JAG 🚩" doesn't URL-encode well and changes if you
rename the group. A separate `slug` column means the URL stays valid
when the label is edited.

**Preferred:** `chat_id, slug, label, ...`. If you can't add slug, we'll
generate one our side from `chat_id` (lossy — opaque to users).

### A2 · Display ordering?

Is there a `display_order` (or `sort_priority`) column, or do we sort
alphabetically?

Some groups are primary (GPS Network!), some secondary. Alpha is fine
to start, but if you have an opinion on the canonical ordering, expose
it.

### A3 · Visibility model

If some imported groups should be coordinator-only (e.g. an internal
"steward channel"), where does that gate live?

Options:
- **Grant side:** the view filters by some role token in the request,
  so anon-key callers only see public sources. Cleanest, but requires
  PostgREST RLS + role token plumbing.
- **GPS Action side:** the view returns everything; we filter post-fetch
  using our `RoleGrant` table. Simpler integration, but the anon key
  technically sees the existence of all chats.

Either works. Tell us which you want; we'll build to match.

### A4 · Per-source metadata you want us to display

What columns belong on the labels view that we should surface in the
chip / card meta row? Candidates:

- `colour_hint` (a brand colour for the chip dot — e.g. red for JAG)
- `icon_glyph` (lucide name, optional)
- `member_count` (display "~120 members" next to the chip)
- `region_slug` (if the group is regional — links to our regions table)
- `description` (tooltip text)

Strip whatever doesn't fit. We'd rather know early than retro-fit.

### A5 · New groups onboarding flow

When you add a new WA group to the Whapi pipe, what's the SLA for it
appearing in `gps_chat_labels` with a valid slug + label?

We need to know whether this is an instant change (we see it on next
poll) or a manual labels-table edit on your side (we see it later).
Affects whether we render a fallback for un-labelled `chat_id`s in the
meantime ("Unknown source · chat_id=…") or assume every row has a join.

### A6 · Backfill semantics

When a new group is added, does its message history flow through
`gps_group_messages` immediately, or only forward from the join date?

Affects what members see when a chip first appears. If history flows
in, the chip lights up populated; if not, it starts empty.

### A7 · Group rename / merge / split

If a WA group is renamed upstream, does the `chat_id` stay stable and
the `label` change, or does it get a new `chat_id`?

We URL-encode by slug; rename = slug edit on our side, doable. New
chat_id on rename = a more disruptive break (the old chip stops
working). Worth knowing.

---

## B. `gps_group_messages` — URL extraction (carryover from PR #338)

These are the questions we deferred from the unfurl-fixes session.
Still open.

### B1 · What's the rule for populating `url`?

Specifically: does the view scan `text_body` for any `http(s)://...`,
or does it only fire when WhatsApp itself attached a link-preview /
the message is URL-only?

Example we want to confirm: "Hey check this out: https://… great
article" — does that message reach us with `url` populated?

### B2 · Multiple URLs in one message — which one wins?

First, last, longest, or some heuristic? Sharon sometimes pastes 2–3
links in one message; we currently render only the upstream `url` and
ignore the rest.

### B3 · Do we follow shorteners?

`bit.ly`, `t.co`, `lnkd.in`, `buff.ly`, etc. — does the view follow the
redirect and store the final destination, or store the shortener URL
as-is? (If the latter, our OG unfurler is fetching the shortener page
and getting garbage previews.)

### B4 · Messages with NO URL — do they reach the view at all?

If a member writes a plain-text message asking for help or sharing a
thought, does it land in `gps_group_messages` (perhaps with `url =
null`), or is the view filtered to URL-bearing messages only?

### B5 · WhatsApp's own link-preview metadata

When WA unfurls a link client-side (the in-app preview card with title
+ thumb), does any of that land in `link_title` / `text_body`? Or do
we only get the raw URL + the user's accompanying text?

### B6 · Any allow/blocklist of hosts upstream?

Are we silently dropping `youtube.com`, `tiktok.com`, `instagram.com`
posts, or anything else?

### B7 · `link_title` source?

Is `link_title` your view extracting `og:title` from the URL,
WhatsApp's own preview, or something else? Some cards have a
`link_title` that disagrees with the OG title we fetch ourselves.

### B8 · Forwarded / quoted messages

If Anna forwards Sharon's post that contained a link, does the
forward land as its own row with `url` carried over, or do forwards
drop out?

---

## C. Operational

### C1 · Privacy / opt-out

If a member asks not to be visible in GPS Action surfaces, what's the
mechanism? Mask `from_name` to null on your side, exclude their
messages entirely, or our problem?

(Reminder: ~70% of senders are `@lid`-only already, so the question is
about the 30% with a real WA display name.)

### C2 · Rate of new groups

How often do you expect to add new WA groups to the pipe? Weekly,
monthly, ad-hoc? Affects whether we need a self-service onboarding
UI or whether ad-hoc-via-Grant is fine for the foreseeable future.

### C3 · Outage / staleness contract

When Whapi or your Supabase project is down, what's the surface we
should expect? `gps_group_messages` returns an empty list (today's
behaviour when env vars are missing — graceful degrade)? Returns a
stale snapshot? Returns 503?

We'd rather render "Network feed is catching up..." than render
nothing if there's a clear staleness signal.

---

## D. Lower-priority / nice-to-have

### D1 · Original WA message ID

Do you carry the WA-side message ID (so we could deep-link back to
the WA conversation in future)? If yes, fine to expose. If no,
moot — we'll use our `id` (the bigint primary key) as the canonical
reference.

### D2 · Reactions on the WA side

Does Whapi expose reactions on the source WA messages? Could we
surface "12 hearts on this in WA itself" alongside our own GPS-app
reactions? Park if it's expensive; just curious if the data is there.

### D3 · Thread / reply context

If a WA message is a reply to a prior one, does the parent come along
or is each row standalone? Affects whether we ever build threaded
context on `/network` cards.

---

_Once Grant has answered, transcribe his answers under each question
inline (use a `**Grant:**` line), then promote the locked decisions
into the parent `bu-network-source-chips.md` brief and flip its
status from `planned` to `ready`._
