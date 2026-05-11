---
slug: bu-network-source-chips--grant-reply-2
status: draft
phase: 2
note: "Draft reply to Grant's 2026-05-11 Round 2 email — Section A (gps_chat_labels) + Round-1 patches shipped. Paul reviews before sending. Once sent, mark status: sent."
---

# Reply to Grant — Round 2 (`gps_chat_labels` + Round-1 patches shipped)

_Draft, awaiting Paul's review before sending._

---

**Subject:** Re: URL extraction + chat_labels — all four shipped

Grant,

Brilliant — that unblocks us. Source chips are now a buildable
session whenever we have the calendar room. Quick read-back so we
both have the contract written down, plus a small handful of asks.

## What we're going to do with the view

Reading `chat_id, slug, label, description, display_order, color,
icon, member_count` from `public.gps_chat_labels`. Embedded PostgREST
join on `gps_group_messages` so each card carries its source inline.

- **`slug` as URL state.** `/network?source=gps-action-network,test-group`,
  comma-separated. Stable across renames, exactly what we wanted.
- **Sort `display_order ASC, label ASC`.** Lower = earlier; the
  1/999 gap pattern is great — if you ever want a new source
  slotted at a particular priority, just pick a number between
  existing values and we'll pick it up automatically.
- **Visibility = our side.** Got it. No filter from you; we'll add
  role gating in tRPC when there's a coordinator-only chat to gate.
  For now both seeded chats are effectively public — no work
  needed.
- **`description`** surfaces in the chip tooltip (and the
  "Manage sources" overlay when we build one).
- **`member_count`** stays off the chip itself (chips are filters,
  not roster metrics) but appears in the manage-sources view.

## Colours and icons — a small ask

`#3fb950` and `#8b949e` are starter values, exactly as you flagged.
On our side they don't quite slot into the GPS Action token palette
(our urgent treatment uses red, cultural marker is bordeaux, and a
GitHub-success green doesn't read as "primary network"). The plan:

- **Treat your `color` column as a fallback.** Default rendering
  uses an override map keyed off `slug`, mapped to our design
  tokens (`styles/tokens.css`).
- **For any new sources you add**, just pick whatever colour feels
  right — we'll override on our side as needed; no need to
  coordinate up-front.

Icons (🎯 and 🧪) — fine as-is. We render emoji rather than lucide,
so what you've picked reads. We may swap 🎯 to something else for
GPS Action Network! once we see it on a chip, but that's a
cosmetic call we'll make later.

## Email-regex backfill sweep — yes please

The ~3–4 rows still carrying bad URL extractions from
`hello@aberdeenperformingarts.com`-style messages: please re-extract
from raw when you get a moment. Cheap to fix, and historical cards
get to be trustworthy. No urgency.

## Two small follow-up questions (non-blocking)

These don't gate our build; just want to bottom them out for our
empty-state copy and operational confidence:

1. **Onboarding SLA / unlabelled chats.** If a new `chat_id` gets
   added to `gps.allowed_chats` before its `gps_chat_labels` row
   exists, do its messages flow through `gps_group_messages` (with
   `slug=null` on the join) or are they held back until the label
   row exists? Either is fine — we just need to know whether to
   render a defensive "Unknown source · `<chat_id>`" fallback chip
   or assume every row joins cleanly.

2. **Backfill semantics on group-add.** When you add a new WA
   group to the pipe, does its message history flow through
   immediately or only forward from the join date? Affects what
   members see when a chip first appears — empty for days vs.
   instantly populated. Informs the empty-state copy on the chip
   side.

## Caching — adopted as you suggested

24h server-side cache on `gps_chat_labels` with a manual purge
button (admin-only). Existing 5-min cache on `gps_group_messages`
stays. We'll add the "Refresh sources" button to the admin
dashboard as a small follow-up.

## `gps_message_states`

Agreed — leave it parked. If full-feed refetches start to bite
we'll ping you, but the 5-min cache window means we're nowhere
near hitting that pain.

Thanks again — Round 1 + Round 2 in one day is faster than we
were expecting, and the column choices read like you'd already
thought through the chip UX.

Paul

---

## Internal notes (not part of the reply)

- **Round 2 status:** Section A answered enough to build; A5 +
  A6 raised as non-gating follow-ups. Brief flipped `planned` →
  `ready`.
- **New asks in this reply:**
  - Email-regex backfill sweep on the ~3–4 existing bad rows.
  - A5 (onboarding SLA when no label row exists).
  - A6 (backfill semantics on group-add).
- **Punts confirmed:** `region_slug` skipped; `gps_message_states`
  parked; `original_sender_hash` parked.
- **Round 3 will cover:** A5/A6 answers when Grant returns,
  Section C (privacy, outage contract) and D (nice-to-have) when
  we surface a concrete need for them.
- **Build session:** branch `feat/network-source-chips-<YYYYMMDD>`
  when Paul greenlights. Scope is in the brief's "Scope (when
  decisions are in)" block; ETA 1 session.
