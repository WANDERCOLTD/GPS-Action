---
slug: bu-tick-or-cross
status: planned
phase: 2
priority: high
note: "Demo slice — ready to assign. Channel deep-link cannot prefill; flow uses copy-to-clipboard + open channel."
---
# SESSION BRIEF · BU-tick-or-cross — "✅ or ❌" PostKind + send-on-publish to GPS Network

_Brief version: 0.1 · stub · Author: Paul (via Claude) · Date: 2026-04-27_

This is a **demo-quality slice**. It introduces a new PostKind named "✅ or ❌"
(peer to "Happening now", "Meetings", "Events" in the FAB picker), captures
the author's `promote` / `remove` choice as data on the post, and triggers a
WhatsApp share to the GPS Network channel as part of the publish flow. The
"shared to WhatsApp" mark is captured by an explicit confirm step on return.

The long-game replacement (WhatsApp Business API for Channels — D016, Phase 2)
is **out of scope**. This brief intentionally narrows D017 (which had a
similar shape under a different internal name) to what the demo needs.

---

## Why this exists / why now

Demo scenario: third-party allies monitor the GPS Network WhatsApp channel.
Posts prefixed `✅` are signals to amplify the linked target; posts prefixed
`❌` are signals to flag/report it. Today this is done by hand in WhatsApp.
The demo needs to show a member creating a `✅ or ❌` post inside GPS Action
and the post landing in the WhatsApp channel as part of the publish action,
with the post itself visibly marked in-app so members understand what
happened.

---

## Objective

Add a new managed `PostKind` row "✅ or ❌". Inside the composer for that
kind, require the author to pick `promote` (✅) or `remove` (❌) via a
segmented control. On publish: save the post, copy the formatted message
(`✅ {title}\n{body}` or `❌ …`) to the clipboard, and open the GPS Network
WhatsApp channel deep-link (channels do not accept `?text=` prefill — see
gotchas). On return, confirm step ("I sent it") flips a `sharedToNetworkAt`
timestamp. Card displays the ✅ / ❌ as part of the post's identity and
shows a "Sent to GPS Network" pill once shared.

Success looks like: tap FAB → pick `✅ or ❌` → choose ✅ → write title +
body → Publish → "Message copied — opening GPS Network channel…" →
WhatsApp channel opens → user pastes → returns to app → confirm → card
shows in feed wearing the ✅ + a "Sent to GPS Network" pill.

---

## Scope

### Build in this session

**ADR (must land first — D069):**

- `docs/architecture/decision-log.md` (APPEND — D069 records: (a) new
  `Post.signal: 'promote' | 'remove' | null` field, internal data only,
  member-facing copy never says "signal"; (b) new
  `Post.sharedToNetworkAt: DateTime?` field; (c) the deliberate divergence
  from D017's `verdict` naming — same shape, different name; (d) the
  demo-fib that publishes the post regardless of share confirmation; (e)
  the WhatsApp channel deep-link constraint and the chosen workaround).

**Schema:**

- `prisma/schema.prisma` (MODIFY — add `signal Signal?` and
  `sharedToNetworkAt DateTime?` to `Post`; add `enum Signal { promote
  remove }`. Migration hand-written, additive only — no breaking changes
  to existing rows.)

**Seed:**

- `prisma/seed.ts` (MODIFY — add `PostKind` row: `slug: 'tick_or_cross'`,
  `displayName: '✅ or ❌'`, icon, `isAlertEligible: false`. **sortOrder
  policy:** the ALERT-eligible kind keeps the top slot of the FAB
  picker — always. Position this new kind prominently (high in the
  list, no scroll required to see it) but **never #1**. Read existing
  rows at session start to pick the right sortOrder integer.)

**Composer (modify):**

- `app/(member)/compose/page.tsx` and the kind-scoped composer surface
  (paths to be confirmed at session start — see BU-composer /
  BU-fab-intent-picker briefs for current shape) — when
  `kind.slug === 'tick_or_cross'`, render a required segmented toggle
  `✅` | `❌` near the top of the form. Disable Publish until a choice
  is made.

**Service / router:**

- `server/services/post.ts` (MODIFY — `createPost` accepts optional
  `signal`; service-layer invariant: `signal` is required when `kind.slug
  === 'tick_or_cross'` and forbidden otherwise).
- `server/routers/post.ts` (MODIFY — surface the field in the create
  procedure input schema).
- New procedure `post.markSharedToNetwork({ postId })` — sets
  `sharedToNetworkAt = now()` if not already set. No-op on second call.
  Anyone authenticated can call (per #3 in pre-brief discussion).

**WhatsApp handoff (new):**

- `components/SendToNetworkConfirm.tsx` (new — post-publish modal:
  (a) shows the formatted message in a read-only block ("Here's your
  message — we've copied it for you"), (b) writes it to the clipboard
  via `navigator.clipboard.writeText` with a graceful fallback if the
  API is unavailable, (c) shows a single primary CTA "Open GPS Network
  channel" that launches `WHATSAPP_NETWORK_CHANNEL_URL` in a new tab,
  (d) on return shows "Did you send it?" with `Yes` / `Not yet`
  buttons. `Yes` calls `post.markSharedToNetwork`; `Not yet` dismisses
  without marking. Honest copy throughout — no "We've sent it!" lies.)
- `shared/share/network-channel-message.ts` (new — pure function:
  builds the formatted message string `✅ {title}\n{body}\n{postUrl}`
  or `❌ …`. No URL prefill — the channel URL comes straight from
  the env var since WhatsApp Channels can't carry a `?text=` payload.)
- `shared/env/whatsapp-network-channel.ts` (new — reads + validates
  `WHATSAPP_NETWORK_CHANNEL_URL`; throws at boot if missing in
  non-test environments.)
- The trigger here is automatic on publish — not a user-initiated card
  tap — so the existing `<WhatsAppShareButton>` (#111) is **not**
  reused for the publish flow. The card-side retry CTA (visible while
  `sharedToNetworkAt` is null) invokes the same
  `<SendToNetworkConfirm>` flow, not a `wa.me` share.

**Card display:**

- `components/PostCard.tsx` (MODIFY — when `post.signal` is set, render
  the corresponding emoji as a calm badge in the card header slot used
  by other kind badges (e.g. `⚡ Urgent`). **Tone follows voice rules:**
  no anxiety amplification on `❌` — same calm badge treatment for both
  `✅` and `❌`, distinguished only by the glyph. No red accent, no
  alarm styling. When
  `post.sharedToNetworkAt` is set, render a "Sent to GPS Network" pill
  next to the timestamp.)

**Tests:**

- `tests/unit/post-signal-invariant.test.ts` (new — service rejects
  `signal` without matching kind; service rejects missing `signal` when
  kind requires it; both promote and remove accepted.)
- `tests/unit/network-channel-message.test.ts` (new — message
  formatting for promote and remove; includes post URL; rejects
  missing env var via the validator.)
- `tests/unit/send-to-network-confirm.test.tsx` (new — clipboard
  write happens on mount; channel URL opens on CTA tap; confirm
  step calls `markSharedToNetwork`; "Not yet" leaves it null;
  fallback path when `navigator.clipboard` is unavailable.)
- `tests/integration/tick-or-cross-create.test.ts` (new — end-to-end
  create with both signal values, verify `sharedToNetworkAt` is null
  until `markSharedToNetwork` called, verify second call is no-op.)

**Docs:**

- `docs/product/analytics-events.md` (MODIFY — `post_shared_out` row
  gains the publish-triggered auto-handoff as an additional firer.
  Same event, no new event. Confirm at session start by reading the
  catalogue's existing `destination` enum which value to use
  (likely `'whatsapp'` reused; if a more specific value is needed,
  propose `'whatsapp_network_channel'` and surface).)
- `docs/product/scenarios.md` (MODIFY — new scenario SCN-NN walking
  Sharon through a `✅ or ❌` post end-to-end.)
- `prisma/README.md` (MODIFY — document new fields.)
- `package.json` (MINOR bump — new feature.)

### Do NOT touch

- `app/(member)/feed/page.tsx` — this slice should not change feed
  filtering. The new kind appears in the feed automatically because feed
  is kind-agnostic.
- `components/WhatsAppShareButton.tsx` — owned by #111 / BU-whatsapp-share.
  Reuse via wrapper, no edits to the existing component.
- `prisma/migrations/` for unrelated tables — additive migration only.
- All other PostKind rows / FAB picker entries — only adding one row.
- `Reaction` / `Comment` models — not touched by this slice.

### Out of scope (for this BU)

- WhatsApp Business API auto-post (D016, deferred to Phase 2). This BU is
  self-dispatch only.
- "Mass send" / multi-channel routing (would belong in a future
  BU-dispatch).
- Boost/remove team gating (D015) — explicitly opened to "anyone
  authenticated" for the demo per pre-brief discussion #3.
- Analytics on whether the WhatsApp tap actually delivered (we trust the
  confirm step; no server-side verification).
- UTM tagging, post-shared-out event tuning beyond what's needed to keep
  the catalogue honest.

---

## Contracts

### Inputs consumed

- `PostKind` table from `prisma/schema.prisma`
- `Post` create flow from `server/services/post.ts`
- `WhatsAppShareButton` machinery from #111 (reused as a wrapper, not
  modified)
- `WHATSAPP_NETWORK_CHANNEL_URL` env var (new — added in
  `.env.example` + production env)

### Outputs produced

- `Post.signal: 'promote' | 'remove' | null` — stable contract; the same
  shape D017 specified, just renamed.
- `Post.sharedToNetworkAt: DateTime?` — stable contract.
- `post.markSharedToNetwork({ postId })` tRPC procedure — idempotent.
- New `PostKind` row with slug `tick_or_cross`.

---

## Acceptance criteria

- [ ] FAB picker shows "✅ or ❌" alongside existing kinds
- [ ] Picking that kind opens a composer with a required ✅/❌ segmented
      control; Publish is disabled until a choice is made
- [ ] Publishing creates a Post with `signal` set and `sharedToNetworkAt`
      null
- [ ] Immediately after publish, a confirm modal appears showing the
      formatted message (`✅ {title}\n{body}\n{postUrl}` or `❌ …`),
      writes it to the clipboard, and offers a primary CTA "Open GPS
      Network channel" that launches `WHATSAPP_NETWORK_CHANNEL_URL`
      in a new tab (or via universal link on iOS standalone — see
      memory `project_ios_standalone_constraint`)
- [ ] On return, "I sent it" flips `sharedToNetworkAt`; "Not yet" leaves
      it null
- [ ] Clipboard fallback works when `navigator.clipboard` is unavailable
      (the message stays visible in the modal so the user can select it
      manually)
- [ ] Card in feed wears the chosen emoji prominently
- [ ] Once `sharedToNetworkAt` is set, card shows "Sent to GPS Network"
      pill
- [ ] Author who dismissed the confirm can re-trigger the WhatsApp share
      from the card later (CTA visible while `sharedToNetworkAt` is null)
- [ ] Service-layer invariant: `signal` only valid with the
      `tick_or_cross` kind; tested both directions
- [ ] `npm run typecheck && npm run lint && npm test &&
      npm run trace:check` all green
- [ ] `package.json` MINOR bumped per `docs/process/versioning.md`

---

## Permission matrix

| Action                          | Anyone authenticated | Notes |
| ------------------------------- | -------------------- | ----- |
| Create `tick_or_cross` post     | ✓                    | Demo: no role gate. D015 (boost_remove_team) deferred to post-demo. |
| Trigger send to GPS Network     | ✓                    | Author or anyone viewing the card while `sharedToNetworkAt` is null. |
| Mark post as shared             | ✓                    | The user who taps the WhatsApp CTA; idempotent. |

---

## UI states

| State              | Trigger                                  | What user sees                                 | What user can do            |
| ------------------ | ---------------------------------------- | ---------------------------------------------- | --------------------------- |
| Composer (no pick) | Kind selected, signal not yet chosen     | ✅/❌ toggle highlighted; Publish disabled     | Pick ✅ or ❌                |
| Composer (picked)  | Signal chosen                            | Toggle shows selection; Publish enabled        | Publish, change pick        |
| Publishing         | Tap Publish                              | Modal: formatted message visible, "Message copied — open GPS Network channel" CTA | Tap CTA to launch channel; cancel |
| Channel opened     | CTA tapped                               | Channel tab open in WhatsApp; in-app modal shows "Did you send it?" with two buttons | Paste in WhatsApp; return; I sent it / Not yet |
| In feed (unsent)   | Post exists, `sharedToNetworkAt` null    | Card wears emoji; CTA "Send to GPS Network"    | Tap CTA to retry handoff    |
| In feed (sent)     | `sharedToNetworkAt` set                  | Card wears emoji + "Sent to GPS Network" pill  | Read; reactions/comments    |

---

## Tests required

- Unit: signal/kind invariant; channel-message formatting; segmented
  control behaviour; clipboard write + fallback
- Integration: full create flow with both signal values; idempotent
  `markSharedToNetwork`; confirm-step paths

Not required:

- E2E with real WhatsApp delivery (manual)
- Visual regression on the new emoji rendering

---

## Scenarios to verify against

- **New SCN-NN** (drafted in this brief — Sharon publishes a `✅` post
  about a Sky News bias article) — full click-through
- **SCN-01** (existing — Sharon boosts a Sky News bias post) — should
  still work via the existing WhatsApp share rail; not regressed by
  the new kind

---

## Known gotchas

- **WhatsApp Channels do not support deep-link prefill.** Only `wa.me/`
  individual chats and `chat.whatsapp.com/<invite>` group invites accept
  `?text=` prefill. **Decision (this brief):** that's accepted for the
  demo. The flow copies the formatted message to the clipboard before
  opening the channel URL; user pastes once the channel tab opens. The
  honest copy in the confirm modal makes this explicit ("Message
  copied — open the channel and paste"). When Phase 2 wires the
  Business API (D016), the clipboard step disappears.
- **iOS standalone (home-screen bookmark)** has no URL bar and no native
  share sheet. Channel deep-links work there via universal link, but
  the "return to app" detection must not assume a tab close — use
  focus/visibility events. Memory: `project_ios_standalone_constraint`.
- **Clipboard API is gated** in some browsers (insecure origins, some
  permission prompts). Always show the formatted message in the modal
  too, so the user can select-copy manually if the API write fails.
- **The confirm step is self-report** — same honest-tracking principle
  as #111. No server-side verification.
- **Publishing without sharing leaves the post visible** — per pre-brief
  discussion #2. Card stays prominent (CTA visible) until shared, but is
  not hidden. Consider whether unsent posts should sort differently in
  the feed (out of scope for this BU; flag if it surfaces).

---

## Definition of done

- [ ] D069 appended to decision log
- [ ] All files in "Build" list created or modified per scope
- [ ] All files in "Don't touch" list untouched
- [ ] `npm run typecheck && npm run lint && npm test &&
      npm run trace:check` all green
- [ ] `package.json` MINOR bumped
- [ ] `WHATSAPP_NETWORK_CHANNEL_URL` added to `.env.example` with
      explanatory comment noting the no-prefill constraint and that
      the demo handles it via clipboard copy
- [ ] Manual click-through: full demo flow works on desktop Chrome and
      iOS Safari standalone
- [ ] PR description summarises the slice + links this brief + D069

---

## Pre-brief decisions (locked)

These were resolved in conversation before the brief was assigned. Any
session running this brief should treat them as final, not re-litigate.

1. **WhatsApp destination:** the actual GPS Network channel URL.
   Channels can't carry a `?text=` payload — that's accepted. The
   modal copies the message to the clipboard and opens the channel
   so the user pastes once. (The brief's flow + gotchas reflect this.)
2. **Analytics:** reuse the existing `post_shared_out` event. No new
   event. Confirm the right `destination` value at session start by
   reading the catalogue's enum.
3. **Kind icon:** "whatever's prettier" — pick whichever of
   emoji-string vs icon-name-slug the existing seeded rows use, and
   match. If both forms exist, lean to the one with the better visual
   result for `✅` and `❌`.
4. **Permission gate:** anyone authenticated. D015's
   `boost_remove_team` flag is deferred to post-demo.
5. **Cancelling WhatsApp leaves the post visible.** Publish always
   saves; the "Sent to GPS Network" pill is the only thing gated on
   actual confirmation.
6. **FAB picker order:** ALERT keeps the top slot, always. The new
   `✅ or ❌` kind sits prominently (visible without scroll) but
   never at #1.
7. **Card tone:** voice rules apply. `❌` posts get the same calm
   badge treatment as `✅` — no red, no alarm styling, no anxiety
   amplification. The glyph alone carries the meaning.

## Open questions (surface if encountered)

- Should unsent `tick_or_cross` posts sort or visually highlight
  differently in the feed (e.g. a "needs sending" treatment for the
  author)? Probably out of scope; surface if the natural feed
  treatment looks wrong in click-through.
- If the existing analytics catalogue's `destination` enum doesn't
  include a value that fits, propose `'whatsapp_network_channel'`
  rather than overloading `'whatsapp'`.

---

## Related

- D016 — WhatsApp Business API for Channels (deferred to Phase 2)
- D017 — Boost/Remove as a verdict on Post (this BU narrows it: same
  shape, demo-only, renamed `signal`)
- D015 — `boost_remove_team` flag (deferred for demo; anyone can post)
- D044 — Intent-first post creation / FAB cards model
- D062 — PostKind as managed table; orthogonal urgency flag
- D069 (new) — this BU's ADR
- BU-fab-intent-picker — adds a new entry to its picker
- BU-whatsapp-share / PR #111 — the share machinery this BU reuses
- Memory: `project_share_taxonomy` — share = socials + WhatsApp; this
  BU's flow is distinct (auto-publish handoff to a designated channel)
- Memory: `project_ios_standalone_constraint` — iOS standalone has no
  URL bar; `wa.me` universal link works without native share sheet
