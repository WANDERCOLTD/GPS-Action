---
slug: bu-network-sort-options
status: planned
phase: 2
priority: medium
note: "Stub 2026-05-11. Newest/Oldest axis shipped as a first cut (PR open). Value axes (most-reacted, most-shared, triage-status, per-source interleave) need backend joins and stay unshipped — file a follow-up BU when product picks which one to add next."
---

# SESSION BRIEF · bu-network-sort-options — member sort + pagination affordances on /network

_Stub · Created: 2026-05-11. Companion to the sent_at-DESC sort fix that
just landed — flagged by Paul mid-session, parked here for the next
product pass._

---

## Why

The compound `sent_at DESC, id DESC` sort fixed the most-broken state
(backfilled rows masquerading as new), but it locks members into one
view. With the chip strip live and three sources flowing, members may
want:

- **Sort by reaction count / share count** — most-amplified first.
- **Sort by triage status** — NEW vs TRIAGED vs PROMOTED clusters.
- **"Most active in last 7 days"** sources — surface where signal is.
- **Per-source "latest only"** — show top N from each chat regardless
  of global recency (so a quiet chat isn't drowned by a noisy one).

And on pagination:
- The "Load more" affordance is fine, but no way to jump to a
  specific date / cursor. After a 1,096-row backfill of historical
  rows, scrolling back to "February" is a long click chain.
- Date-range slider? Window-days picker (currently locked at 90)?

## Open product questions

1. **Which sort options actually matter?** Time / reactions / shares /
   triage / per-source — pick the 1–2 that earn the chip-strip-style
   prominent UI affordance. Sharon-warmth posture: don't surface 5
   sort options if 4 are noise.
2. **Per-source vs global?** A "5 most recent from each source"
   interleave changes the data shape (it's no longer one feed; it's a
   grid). Worth it?
3. **Window-days control?** Currently locked at 90 via the schema's
   `NETWORK_LIST_MAX_WINDOW_DAYS`. Member-facing slider, or
   coordinator-only?
4. **Where does the control live?** Next to the chip strip? In a
   coordinator-only kebab menu? Behind a settings overlay?
5. **URL-state encoded?** All current filter state on `/network` is
   in the URL (`?source=...`). Sort = `?sort=recent|reacted|shared`?
   Cursor remains opaque.

## Surface this BU depends on

- `bu-network-source-chips` (#343, #346, this PR) — the chip strip
  exists and demonstrates the URL-state pattern members are
  familiar with.
- Latest sort fix (this PR) — `sent_at DESC, id DESC` is the default;
  any sort option overlay sits on top.

## Not in scope

- Triage-bulk-actions (separate BU).
- Custom feeds / saved views (D-future).
- Search within `/network` (covered by `bu-search-surface`, shipped).

## Next step

Paul to confirm which sort options actually matter. If he picks 1
("most-reacted within source"), this is a small BU. If he picks 4
across two axes (sort × interleave), it's bigger.
