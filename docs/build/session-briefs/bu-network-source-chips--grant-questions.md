---
slug: bu-network-source-chips--grant-questions
status: partially-answered
phase: 2
note: "Questions for Grant (AIFA) blocking bu-network-source-chips. Draft 2026-05-11. Section B (URL extraction) answered 2026-05-11. Section A (gps_chat_labels) still pending — it's the gating blocker for the build."
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

**Grant (2026-05-11):** Server-side regex on `body_text` (which is
`text.body` or `link_preview.body` or `caption.body`, whichever
Whapi delivered). Priority order: `https?://…` match wins, then
`www.\S+`, then bare-domain match (TLD allowlist — see B6).
Yes — "Hey check this out: https://…" lands with `url` populated.

**Caveat (Grant, proactive):** The bare-domain regex matches
email-address domains. Real example in our data: a member typed
`hello@aberdeenperformingarts.com` (an email address) — the regex
captured `aberdeenperformingarts.com` as a URL. That row arrives
with `message_type=text`, `link_title=null`,
`url=aberdeenperformingarts.com`, and OG-unfurling gets the company
homepage rather than anything the sender meant to share. Grant has
offered a one-line regex patch (require leading whitespace /
start-of-string, not `@`). **Our reply: yes please.**

### B2 · Multiple URLs in one message — which one wins?

First, last, longest, or some heuristic? Sharon sometimes pastes 2–3
links in one message; we currently render only the upstream `url` and
ignore the rest.

**Grant (2026-05-11):** First wins. `regexp_match` (singular) under
the hood, returns the first match only. Real loss in our data —
e.g. id=13's `text_body` contains both a Facebook link AND a
`petition.parliament.uk` link; we stored only the Facebook one.
Grant offered to switch to `regexp_matches` (plural) and expose a
`urls text[]` column alongside `url`. ~10 min schema change.
**Our reply: yes please. Render first as the primary preview for
now; surface "+N more links" later.**

### B3 · Do we follow shorteners?

`bit.ly`, `t.co`, `lnkd.in`, `buff.ly`, etc. — does the view follow the
redirect and store the final destination, or store the shortener URL
as-is? (If the latter, our OG unfurler is fetching the shortener page
and getting garbage previews.)

**Grant (2026-05-11):** Stored as-is. No HTTP fetch, no redirect
resolution. No shortener URLs in the current 167-row sample, so
theoretical for now. Grant offered (a) we resolve client-side at
unfurl, or (b) he adds a periodic resolver that updates `url` in
place.

**Our position:** **No action needed from Grant.** Our existing OG
fetcher already uses `redirect: 'follow'`
(`server/services/link-metadata.ts:84`), so when we fetch a
shortener URL, the destination's OG tags come back. The stored
`url` stays as the shortener, but the rendered preview is correct.
Will revisit if cards show stale/wrong previews for shortened links.

### B4 · Messages with NO URL — do they reach the view at all?

If a member writes a plain-text message asking for help or sharing a
thought, does it land in `gps_group_messages` (perhaps with `url =
null`), or is the view filtered to URL-bearing messages only?

**Grant (2026-05-11):** Dropped — don't reach the view. By design
(link-feed scope). Plain "asking for help" messages get logged in
his `webhook_log` diagnostic table but don't insert into
`gps.messages`. He offered a one-line change to include plain text,
flagged that "it'd flip the feed character significantly."

**Our position:** **Keep as-is.** `/network` is a link-feed by
contract. If we later want a context-stream of plain-text messages,
that's a separate surface, not a flip of `/network`.

### B5 · WhatsApp's own link-preview metadata

When WA unfurls a link client-side (the in-app preview card with title
+ thumb), does any of that land in `link_title` / `text_body`? Or do
we only get the raw URL + the user's accompanying text?

**Grant (2026-05-11):** Yes — captured. When Whapi delivers
`type=link_preview`, Grant pulls `link_preview.url` (priority over
regex) and `link_preview.title` straight from WhatsApp's preview.
Of 167 rows: 144 are `link_preview` type (all have `link_title`),
23 are `text` type (all have `link_title=NULL`). A card with
`link_title=null` and `message_type=text` means WhatsApp didn't
unfurl client-side — the user just typed the URL plain.

### B6 · Any allow/blocklist of hosts upstream?

Are we silently dropping `youtube.com`, `tiktok.com`, `instagram.com`
posts, or anything else?

**Grant (2026-05-11):** No host blocklist. YouTube, Instagram,
Facebook, X.com, TikTok all flow through unchanged. Current top
hosts in his data:

| Host | Count (of 167) |
|---|---|
| x.com | 17 |
| www.facebook.com | 16 |
| us06web.zoom.us | 9 |
| chat.whatsapp.com | 9 |
| www.instagram.com | 8 |

Missing hosts cause is upstream of Grant: burner didn't see the
message (group permission, network), or it failed the chat
allowlist (currently just GPS Action Network! + Test group), or
Grant hid it via the curation CLI. **One filter to know:** for
bare-domain URLs (no `https://` scheme) the regex requires a known
TLD — `.com .co.uk .org .net .io .ai .blog .news` etc. URLs with
`https://` or `www.` always pass regardless of TLD.

**Our note:** `chat.whatsapp.com` at 9 rows is unexpected — those
are WA group-invite links. We currently OG-unfurl them and get
nothing useful. Parking-lot candidate: a "Join group" treatment.

### B7 · `link_title` source?

Is `link_title` your view extracting `og:title` from the URL,
WhatsApp's own preview, or something else? Some cards have a
`link_title` that disagrees with the OG title we fetch ourselves.

**Grant (2026-05-11):** WhatsApp's own preview metadata — what
WA's server returned when WA's client unfurled the URL. Grant does
**not** OG-fetch on his side. So if our OG fetch disagrees with
`link_title`, both are valid snapshots at different times; WA
caches preview metadata and pages change.

**Our position:** Prefer our fresh OG title for rendering; treat
`link_title` as fallback / "the title the sender visually saw in
WhatsApp." Already the behaviour in `NetworkCard.tsx` — uses
`linkPreview.title` first, falls back to `linkTitle`, then hostname.

### B8 · Forwarded / quoted messages

If Anna forwards Sharon's post that contained a link, does the
forward land as its own row with `url` carried over, or do forwards
drop out?

**Grant (2026-05-11):** Land as own row. **47 of 167 rows (~28%)
are forwards** — significant. Whapi delivers them as new events
with their own `id`, marked by `context: {forwarded: true,
forwarding_score: N}`. URL is extracted from the forwarded body as
normal. But **`from_name` / `sender_hash` is the forwarder (Anna),
not the original poster (Sharon)**. Grant offered to dig
`context.quoted` out of the raw payload and expose
`original_sender_hash` — but Whapi's metadata is patchy and he'd
want a few real examples first.

**Our reply:** Punt on `original_sender_hash` for now — but ask
Grant to **cheaply expose `is_forwarded: boolean`** (he already
reads `context.forwarded`; trivial column add). 28% of our feed
being forwards is material; even just a "↪ forwarded" badge in
the card meta row sets honest expectations.

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

## E. Things Grant volunteered (not asked, useful to know)

### E1 · Curation CLI hides ~18 rows

Grant runs a curation CLI that hides 18 rows from the view (mostly
Zoom invites). `id` sequence will appear to have gaps; that's
deliberate, not data loss. **Do not debug "missing id" gaps.**

### E2 · Triage of "missing cards" hypotheses

Grant's own ranking of why a card might appear missing:

1. **Multi-URL messages → only first URL captured.** (Most likely
   culprit. Mitigated by B2's `urls text[]` patch when shipped.)
2. **Email-domain false positives → wrong URL on text cards, not
   missing.** Quality issue, not missing. Mitigated by B1's
   regex patch when shipped.
3. **Chat allowlist** — only GPS Action Network! + Test currently
   flow through. Anything in GPS Network main, GPS Coffee, etc. is
   not in scope yet (this is what the source-chips BU prepares for).
4. **Grant's curation** — 18 rows deliberately hidden.
5. **WhatsApp `@lid` privacy** — not a missing-cards cause, but
   `from_name` is null for ~70% of senders.

### E3 · Top hosts in current data

| Host | Count | UX note |
|---|---|---|
| x.com | 17 | Compact treatment shipped in #338 |
| www.facebook.com | 16 | Standard OG unfurl works |
| us06web.zoom.us | 9 | Mostly curated out by Grant |
| chat.whatsapp.com | 9 | **Worth a specific treatment** — these are WA group-invite links; OG unfurl returns nothing useful |
| www.instagram.com | 8 | Standard OG unfurl works |

---

## Status tracker

| Section | Status |
|---|---|
| A. `gps_chat_labels` view shape | ❌ **Pending** — the gating blocker |
| B. `gps_group_messages` URL extraction | ✅ Answered 2026-05-11 |
| C. Operational | ❌ Pending |
| D. Nice-to-have | ❌ Pending |
| E. Volunteered by Grant | ✅ Captured 2026-05-11 |

Once Section A lands, promote the locked decisions into
`bu-network-source-chips.md` and flip its status from `planned` to
`ready`.
