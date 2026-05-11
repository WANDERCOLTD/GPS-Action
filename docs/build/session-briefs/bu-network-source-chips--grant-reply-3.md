---
slug: bu-network-source-chips--grant-reply-3
status: draft
phase: 2
note: "Draft reply to Grant's 2026-05-11 Round 3 email — email-regex sweep done, A5 (labels = view of allowed_chats, slug NOT NULL by trigger), A6 (forward-only, with auto-backfill on offer). Paul reviews before sending. Once sent, mark status: sent."
---

# Reply to Grant — Round 3 (email sweep + A5/A6)

_Draft, awaiting Paul's review before sending._

---

**Subject:** Re: chip contract + email sweep + your two questions

Grant,

Email sweep — thanks. Clean outcome. Will be invisible to us within a
poll, no follow-up needed.

The architectural clarification on `gps_chat_labels` being a view of
`gps.allowed_chats` is exactly the contract I wanted to hear. We were
over-defending by typing `source` as nullable on the card type;
flipping that to non-null in the build that's in flight now. The
slug-via-INSERT-trigger pattern is the right call — stable identifier
without you having to remember to set it.

## A6 / auto-backfill — yes please

Strong UX win for the cost. When someone new joins via
`manage_allowlist.py`, having the chip land pre-populated reads much
better than "wait days for someone to share a link." Worth the 5
minutes.

Empty-state copy will still exist on our side as a fallback for
genuine quiet windows ("No links shared from `<source>` in the last
N days"), so the two compose cleanly — backfill handles the
new-source case, copy handles the legitimately-quiet case.

## Build kicks off now

No further blockers from our side. Source chips going in this
session — chips above the card list (URL-state via `slug`), source
meta on each card, "↪ forwarded" badge, source-palette overrides
for the chip colours. Will ping with the PR + a deploy preview when
it's up so you can sanity-check the labels view consumption end-to-
end.

Thanks for the fast iteration — three rounds in one day was not
on my bingo card.

Paul

---

## Internal notes (not part of the reply)

- **Round 3 status:** Section A fully answered (A5 + A6 both
  addressed). Email-regex sweep completed by Grant.
- **New asks in this reply:** auto-backfill on group-add (5-min
  change his side).
- **Architectural change adopted in this build:** `source` is
  non-null on `NetworkCard` / `SerializedNetworkCard` because
  `gps_chat_labels` is a view of `gps.allowed_chats` — same table,
  atomic insert. Slug is contract-NOT-NULL via INSERT trigger.
  `description / color / icon / member_count` remain nullable
  (presentational fallbacks behind our token override map).
- **Punts confirmed:** `gps_message_states` still parked;
  `region_slug` still skipped; `original_sender_hash` still parked.
- **Round 4** (if any) will cover Section C (operational —
  privacy, outage contract) and Section D (nice-to-have — WA msg
  ID, WA-side reactions, threads) when we surface a concrete need.
