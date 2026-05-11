---
slug: bu-network-source-chips--grant-questions
status: answered
phase: 2
note: "Questions for Grant (AIFA) blocking bu-network-source-chips. Draft 2026-05-11. Section B (URL extraction) answered 2026-05-11 morning. Section A (gps_chat_labels) answered 2026-05-11 afternoon — view shipped. A5 (onboarding SLA) and A6 (backfill semantics) not directly addressed but not gating; raised in Round 2 reply. Section C and D still pending."
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

**Grant (2026-05-11):** **Yes.** `slug text` column shipped. Persistent
across label renames. Only mutates if Grant explicitly rotates it.
"Safe to use as a route param (`/network?source=gps-action-network`)."

**Our position:** Use `slug` directly as the URL-state key. No
client-side generation. Chip-strip code reads `slug`, parses
comma-separated `?source=` param straight to a slug array.

### A2 · Display ordering?

Is there a `display_order` (or `sort_priority`) column, or do we sort
alphabetically?

Some groups are primary (GPS Network!), some secondary. Alpha is fine
to start, but if you have an opinion on the canonical ordering, expose
it.

**Grant (2026-05-11):** **Yes.** `display_order int` column shipped.
Lower = earlier. Default 100. Wide gap left between seeded values
(`gps-action-network=1`, `test-group=999`) so new sources can slot in
without renumbering. Sort recipe: `display_order ASC, label ASC`.

**Our position:** Use `display_order ASC, label ASC` for chip
rendering. Answers open product Q1 (chip ordering) — no longer
needs a separate decision.

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

**Grant (2026-05-11):** **GPS Action side.** No server-side role
filtering — the view returns everything currently in
`gps.allowed_chats`. Rationale: not at the scale where Grant
filtering it makes sense; if/when we need role gating, do it
post-fetch in tRPC.

**Our position:** Build the visibility gate in
`server/services/network.ts` against our own `RoleGrant` table when
we need it. **For this BU, defer:** the two currently-seeded chats
(GPS Action Network!, Test) are both effectively public for now;
no coordinator-only source yet exists. When the first one does
(e.g. a steward channel), add a `visibleToRole` column on a local
`NetworkSource` mirror table or hard-code the filter — design
choice deferred to that BU.

### A4 · Per-source metadata you want us to display

What columns belong on the labels view that we should surface in the
chip / card meta row? Candidates:

- `colour_hint` (a brand colour for the chip dot — e.g. red for JAG)
- `icon_glyph` (lucide name, optional)
- `member_count` (display "~120 members" next to the chip)
- `region_slug` (if the group is regional — links to our regions table)
- `description` (tooltip text)

Strip whatever doesn't fit. We'd rather know early than retro-fit.

**Grant (2026-05-11):** Shipped: `color text` (hex, nullable),
`icon text` (single emoji or icon hint, nullable),
`description text` (1–2 sentence summary), `member_count int` (set
manually for now; periodic Whapi sync = v2). **Skipped:**
`region_slug` (felt speculative; flag if we actually need it).

Seed:
- `gps-action-network` → "GPS Action Network!" · `#3fb950` · 🎯 ·
  190 members · `display_order=1`
- `test-group` → "Test (Grant + burner)" · `#8b949e` · 🧪 ·
  2 members · `display_order=999`

Grant's framing: "These are starter values — your call on the
colour palette and icons, just tell me what you want and I'll
update on this side. Or you can override `color`/`icon` on your end
and treat my values as fallbacks."

**Our position:**
- **`color`** — `#3fb950` (GitHub-success green) and `#8b949e` (a
  cool grey) don't match our token palette. Test group's grey is
  fine as-is (it's a low-signal chat). GPS Action Network!'s green
  is a clash candidate — our urgent treatment uses red, our
  cultural-marker is bordeaux, and green doesn't read as "primary"
  in our system. **Plan:** treat Grant's `color` as a fallback,
  and lock a brand-colour map on our side keyed by `slug`. Reply
  asks Grant to point at our `styles/tokens.css` once chips ship
  visually, so any future-source colour he picks aligns.
- **`icon`** — emoji rather than lucide name is fine (we already
  use emoji for cultural markers). 🎯 reads as "GPS Action /
  target / coordinated" — OK as a placeholder; revisit after first
  render. 🧪 for Test is right.
- **`description`** — surface in chip tooltip + `/network` chip-
  strip "manage sources" overlay (if/when that exists).
- **`member_count`** — show "~120 members" alongside the chip
  label in the long-list / manage-sources view. **Don't** show on
  the chip itself — the chip is for filtering, not roster.
- **`region_slug`** — agreed: skip for now. Two-axis source-vs-
  region modelling is premature when only one currently-active
  group exists.

### A5 · New groups onboarding flow

When you add a new WA group to the Whapi pipe, what's the SLA for it
appearing in `gps_chat_labels` with a valid slug + label?

We need to know whether this is an instant change (we see it on next
poll) or a manual labels-table edit on your side (we see it later).
Affects whether we render a fallback for un-labelled `chat_id`s in the
meantime ("Unknown source · chat_id=…") or assume every row has a join.

**Grant (2026-05-11):** Not directly addressed. The reply implies
labels are seeded manually (he listed two by hand), but didn't
state whether a new `allowed_chats` entry without a corresponding
`gps_chat_labels` row produces unlabelled message rows or whether
labels are a hard precondition.

**Our position:** Not gating for this BU — only two chats exist
today and both have labels. Build assuming every row joins.
**Raise in Round 2 reply:** ask Grant to confirm whether the
join is enforced (no-label = no messages flow) or whether we
should render a defensive "Unknown source · `<chat_id>`" fallback
chip when a label is missing.

### A6 · Backfill semantics

When a new group is added, does its message history flow through
`gps_group_messages` immediately, or only forward from the join date?

Affects what members see when a chip first appears. If history flows
in, the chip lights up populated; if not, it starts empty.

**Grant (2026-05-11):** Not directly addressed.

**Our position:** Not gating for this BU. **Raise in Round 2
reply** — answer informs empty-state copy (open product Q3): is a
new chip likely to be empty for days while traffic accumulates, or
does Whapi backfill on join? If forward-only, the empty-state copy
should read along the lines of "This source just joined the
network — links will appear here as members share them."

### A7 · Group rename / merge / split

If a WA group is renamed upstream, does the `chat_id` stay stable and
the `label` change, or does it get a new `chat_id`?

We URL-encode by slug; rename = slug edit on our side, doable. New
chat_id on rename = a more disruptive break (the old chip stops
working). Worth knowing.

**Grant (2026-05-11):** Implicitly answered via A1. Slug is
"persistent across label changes; only mutates if I explicitly
rotate it." This implies `chat_id` is the upstream stable
identifier and `label` is the freely-mutable display name; a
rename = `label` change while `chat_id` (and Grant's chosen
`slug`) stay put.

**Our position:** Safe to URL-encode by `slug`. Renames don't
break shared `?source=…` URLs. If Grant ever rotates a slug
(rare, his choice), we'll need a redirect on our side or live
with the broken link — risk accepted given the low frequency.
Merge / split is unaddressed but speculative; not gating.

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

### E4 · Round-1 patches all shipped (Round 2 update, 2026-05-11)

All three patches we accepted in Round 1 are now live on Grant's
side, in a single drop alongside the `gps_chat_labels` expansion:

1. **Email-domain regex fix.** Bare-domain pattern now requires
   whitespace / start-of-string before the match. No more capturing
   `aberdeenperformingarts.com` from `hello@aberdeenperformingarts.com`.
   Subdomains like `news.bbc.co.uk/world` still capture correctly.
2. **`urls text[]`** on `public.gps_group_messages`. Ordered by first
   appearance, deduped, trailing punctuation stripped. `url`
   (singular) still exists and equals `urls[0]` (or
   `link_preview.url` when WA attached a preview — in which case
   it's prepended to `urls` so `urls[0] === url`). Existing rows
   backfilled — e.g. id=13 now has both Facebook + Parliament
   petition URLs.
3. **`is_forwarded boolean`** sourced from `context.forwarded`.
   47 of 167 existing rows backfilled to `true`. Forwarder
   identity (`from_name`, `sender_hash`) remains the forwarder, as
   discussed — original-sender preservation stays parked.

**Backfill caveat (Grant, proactive):** ~3–4 existing rows with the
email-regex false positive are still in the table with their bad
`url`. Re-extraction from raw is a one-off Grant offered to run if
we want it. **Our reply: yes please** — cheap to fix, makes
historical cards trustworthy.

### E5 · `gps_chat_labels` rate limit + cache guidance

Grant: practical PostgREST anon rate limit on Supabase free/basic
tier is ~200 req/min per IP, soft-throttled beyond. His
recommendation:

- **`gps_chat_labels`** (chip data, changes ~weekly at most):
  24h server-side cache + manual purge button.
- **`gps_group_messages`** (link feed): 5-min cache, per earlier
  discussion.

**Our position:** Adopt both. Our existing `network.ts` service
already caches the message feed at 60s in dev / 300s in prod
(`server/services/network.ts` cache key); chip data fetched
separately, key on the empty-args call, TTL 24h. Manual purge =
admin "Refresh sources" button on the admin dashboard, calls the
cache-bust endpoint (small follow-up; not in this BU's scope).

### E6 · `gps_message_states` view stays parked

Grant volunteered that the incremental-sync view stays parked as
discussed. "If you ever hit refetch-pain, ping me and it's a 10-min
addition." No action — we'll revisit if/when full-feed refetches
become noticeable.

---

## Status tracker

| Section | Status |
|---|---|
| A. `gps_chat_labels` view shape | ✅ Answered 2026-05-11 — view shipped; A5 (onboarding SLA) + A6 (backfill semantics) raised in Round 2 reply, not gating |
| B. `gps_group_messages` URL extraction | ✅ Answered 2026-05-11 — all three Round-1 patches shipped (see E4) |
| C. Operational | ❌ Pending — raised in Round 2 reply |
| D. Nice-to-have | ❌ Pending — non-blocking |
| E. Volunteered by Grant | ✅ Captured 2026-05-11 (E1–E3 Round 1; E4–E6 Round 2) |

Section A landed. Decisions promoted into
`bu-network-source-chips.md`; brief status flipped `planned` →
`ready`. Build session can start once Paul greenlights.
