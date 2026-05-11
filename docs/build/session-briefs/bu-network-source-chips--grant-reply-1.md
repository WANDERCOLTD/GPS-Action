---
slug: bu-network-source-chips--grant-reply-1
status: draft
phase: 2
note: "Draft reply to Grant's 2026-05-11 email answering Section B (URL extraction). Paul reviews before sending. Once sent, mark status: sent. Round 2 reply will land when Section A (gps_chat_labels) lands."
---

# Reply to Grant — Round 1 (URL extraction)

_Draft, awaiting Paul's review before sending._

---

**Subject:** Re: URL extraction — view internals

Grant,

Thanks for walking through the actual rows — extremely useful, exactly
the level of detail we needed.

Short version: **yes please to both patches**, plus one small follow-
up and a gentle nudge.

## Patches — both yes

**(a) Email-domain regex fix** — yes, please go ahead. Free quality
win, no downside on our side. Today every `hello@aberdeen…` style row
unfurls to the wrong page; the fix makes our card layer trustworthy.

**(b) `urls text[]` column for multi-URL messages** — yes, please.
We'll render the first URL as the primary preview for now (matches
today's behaviour, no UX change), and add a "+N more links" affordance
later. Knowing the others are stored stops the silent data loss in
id=13-style rows.

## One small ask: `is_forwarded` boolean

You flagged ~28% of the feed is forwards (47/167) and that
`from_name` / `sender_hash` is the forwarder, not the original poster.
That's material — even just a small "↪ forwarded" badge in our card
meta row would set honest expectations. Since you're already reading
`context.forwarded` from the Whapi payload, exposing it as a column
should be near-trivial.

Please skip `original_sender_hash` for now — Whapi's metadata on it
is patchy by your own account, and we don't have a concrete UX that
needs it yet. We'll ask later if/when we do.

## Don't bother

- **Shorteners.** Our OG fetcher already follows redirects, so when
  we unfurl `bit.ly/abc` we end up reading OG tags from the
  destination page. The stored URL stays as the shortener but the
  rendered preview is correct. No periodic resolver needed your side.
- **Plain-text messages reaching the view.** Keeping `/network` as a
  link-feed by contract feels right. If we ever want a context-stream
  of plain-text messages, that's a separate surface.

## Gentle nudge

The other gating piece is the `gps_chat_labels` view we discussed —
Section A of the questions doc. We're about to roll out source chips
on `/network` (so members can filter by which WA group a card came
from, in preparation for retiring `/feed` as the canonical surface).
We've sketched a brief but it's blocked on knowing:

- Does the view carry a stable `slug` (kebab-case, persistent across
  label renames), or just a free-text `label`?
- Visibility model — does the view filter by role on your side, or
  do we filter post-fetch using our own role table?
- Is there a `display_order` column for chip ordering, or do we sort
  alphabetically?
- Any per-source metadata you want us to surface (colour hint, icon,
  member count, region slug, description)?

No rush — just want to be on your radar before you finalise the
schema, so we build to what you ship rather than retro-fit.

Thanks again — this kind of answer round saves us days of guessing.

Paul

---

## Internal notes (not part of the reply)

- **Round 1 patches accepted:** email-domain regex fix; `urls text[]`.
- **Round 1 new ask:** `is_forwarded: boolean` column.
- **Round 1 punts:** shorteners (us-side OK), plain-text inclusion
  (out of scope).
- **Round 2 will cover:** all of Section A (`gps_chat_labels`),
  Section C (operational), Section D (nice-to-have).
- When Grant replies on Section A, transcribe answers into
  `bu-network-source-chips--grant-questions.md`, promote into the
  parent brief, flip brief status from `planned` → `ready`.
