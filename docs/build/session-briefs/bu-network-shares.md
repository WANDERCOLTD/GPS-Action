---
slug: bu-network-shares
status: shipped
shipped_in: "#TBD"
phase: 2
priority: medium
note: "Share rail on /network cards + intent/verified counter. Built on the polymorphic ShareEvent table from bu-share-event-polymorphic (ADR-0018). PostShare/D077 was never built; this BU did not parameterise the /feed rail (Option 1)."
---

# SESSION BRIEF · bu-network-shares — share network cards to socials + WhatsApp

_Author: Paul + Claude · Created: 2026-05-11_
_Type: UI reuse + service wiring. Depends on bu-share-event-polymorphic shipping first. No new schema (uses ShareEvent table extended in the prior BU)._

---

## 1 · Business Analyst — why this matters

### The problem in plain language

Network cards are amplification candidates. Sharon sees a great
Telegraph article in the network feed — she wants to share it to
X (where her followers will retweet), to her WhatsApp groups (where
local activists will rebroadcast), to Facebook (where her older
relatives engage). Today she has to:

1. Copy the URL from the network card
2. Open the platform separately
3. Paste, compose, send
4. Come back to GPS Action
5. Update no one — there's no record she shared it

This is exactly the friction `bu-post-share-counter` removed for
`/feed` posts. The same rail, the same verified-send dialog, the
same counter — should work on Network cards.

Critically: the **link Sharon shares is the upstream URL** (the actual
Telegraph article), not a GPS-app page. That's the right UX — her
followers want to read the article, not land on our app first. But we
still want to track the share — that's why
`bu-share-event-polymorphic` exists.

### Why this matters now

1. **Coordinated activism needs amplification.** Triaged + Promoted
   without an easy share button is half the workflow. Network cards
   are surfaced specifically because they're shareable; not building
   the share button is a glaring omission.
2. **The plumbing is ready** (assuming `bu-share-event-polymorphic`
   has landed): one enum value to add, two components to parameterise,
   one mount-point to wire.
3. **Share counts inform triage.** A card with 14 verified X-shares is
   probably worth Promoting before one with zero. Coordinator dashboards
   in the next phase will surface this.

### Who benefits

- **Sharon-style members** — friction removed for the most important
  activism workflow.
- **Coordinators** — share counts as a Promote-readiness signal.
- **The network as a whole** — easier amplification = more reach for
  the content that resonates.

### Success looks like

- Identical share rail UX on `/network` and `/feed` — same X/IG/FB
  primary row, same separate WhatsApp button.
- Members who share a network card see the same "Did you send?"
  follow-up they see on `/feed`.
- Counter pill on each NetworkCard shows verified share count, with
  per-destination tooltip breakdown.
- ≥20% of `Promoted` cards have at least one verified share within
  the first 30 days post-launch (a Promoted card that no one shares
  is a triage miscall worth surfacing).

---

## 2 · Tech Lead — the design

### Dependencies

- **`bu-share-event-polymorphic` must be shipped first.** That BU
  renames `PostShare` → `ShareEvent`, adds the `network_card` enum
  value (Phase C of that BU includes the enum addition, OR phase A
  if we choose to land the enum upfront — see open questions).

This brief assumes that's done and `ShareTargetType` includes
`network_card`.

### Schema

**No new schema.** The polymorphic `ShareEvent` table from
`bu-share-event-polymorphic` already accepts `targetType='network_card'`
and `networkCardStateId` FK.

If the prior BU shipped Phase A/B but the enum value wasn't yet
added: this brief includes a one-line migration adding it.

### Service layer

`server/services/share-event.ts` (renamed in prior BU) — already
polymorphic. No changes required for the data flow.

A new helper `getNetworkCardShareCounts(messageIds: BigInt[])`
projects the share counter for the list view, in the same shape
the `/feed` counter projection uses:

```ts
{ total: number; perDestination: Record<ShareDestination, number> }
```

### Components — parameterise existing share UI

Two existing components need a `target` prop instead of a `post` prop:

**`<PostShareGroup>` → `<ShareGroup>`** (rename):
- Old props: `{ post }`
- New props: `{ url: string; title: string; targetType: ShareTargetType; targetId: string }`
- Caller in PostCard derives `{ url, title, targetType: 'post', targetId: post.id }` from post
- Caller in NetworkCard derives `{ url: card.url, title: card.linkPreview?.title ?? card.linkTitle ?? card.url, targetType: 'network_card', targetId: card.messageId }`

**`<WhatsAppShareButton>`** — same parameterisation. (Per
share-taxonomy memory: WhatsApp stays adjacent, NOT inside the social
rail.)

**`<ShareConfirmDialog>`** — already takes `{ targetType, targetId,
destination }`. No change.

The rename of `PostShareGroup` → `ShareGroup` lives in this BU's PR,
not the prior one — keeps `bu-share-event-polymorphic` scoped to
schema/service.

### API contract

`POST /api/analytics/share-intent` — already accepts polymorphic
`targetType` + `targetId` (from prior BU). No change.

### UI placement in NetworkCard

Below the link preview, above the triage row:

```
┌─ NetworkCard ───────────────────────┐
│ <Meta row: sender · group · time>   │
│ <LinkPreviewCard (if preview)>      │
│ <textBody (if any)>                 │
│ ┌─ engagement bar ─────────────────┐│
│ │ [reactions tray]  · 3            ││  ← from bu-network-reactions
│ │ [share rail · 14]                ││  ← this BU
│ └──────────────────────────────────┘│
│ [Triaged] [Promoted] [Discarded]    │
└─────────────────────────────────────┘
```

Share counter pill (`★ 14`) is part of the share rail group — clicking
it opens a small breakdown popover (already implemented for `/feed`,
just needs the targetType prop).

### Tests

- **Unit** — `tests/unit/share-group.test.tsx`: rendering with
  `targetType='network_card'` produces the right share URL (upstream,
  not GPS-app), fires intent with the right target.
- **Component** — `tests/unit/network-card.test.tsx`: share rail
  renders, counter pill renders the projection value.
- **Integration** — `tests/integration/share-event-network.test.ts`:
  intent flow then verified flow leaves correct row state.

### Rollback

- Drop the `<ShareGroup>` mount in `NetworkCard.tsx` — visual rail
  disappears. Existing rows in `ShareEvent` with `targetType='network_card'`
  stay (harmless).
- `bu-share-event-polymorphic` is untouched — that BU's rollback is
  independent.

---

## Scope

### Build in this session

- `components/PostShareGroup.tsx` → renamed to `components/ShareGroup.tsx`, parameterised
- `components/WhatsAppShareButton.tsx` — parameterised
- `components/PostCard.tsx` — update prop mapping (no visual change)
- `components/NetworkCard.tsx` — mount `<ShareGroup>` + counter pill
- `server/services/share-event.ts` — `getNetworkCardShareCounts` helper
- `server/services/network.ts` — join the share count projection into the list response (`NetworkCard.shareCounts` field, same shape as `/feed`)
- `shared/network-card.ts` — extend `NetworkCard` type with `shareCounts`
- Tests above
- `package.json` version bump (patch)

### Do NOT touch

- `ShareEvent` schema (prior BU's territory)
- `ShareConfirmDialog` (already polymorphic)
- `Reaction` layer (orthogonal — that's `bu-network-reactions`)
- Triage state row (orthogonal)

### Out of scope

- Per-destination counter dashboard (existing /data/shareEvent covers
  inspection)
- "Most-shared network cards this week" admin view (Phase 3 candidate)
- OAuth-verified shares (rejected in D077 — verified means user
  self-confirmed)
- Auto-promote-on-N-shares (parked — coordinator judgement remains
  the gate)

## Acceptance criteria

- [ ] Share rail (X / IG / FB) renders on every NetworkCard
- [ ] WhatsApp button renders adjacent to the rail (per share taxonomy)
- [ ] Clicking X opens X with **the upstream URL** pre-filled (not a GPS link)
- [ ] Clicking X fires `share-intent` with `targetType='network_card'`, `destination='x'`
- [ ] After window returns focus, `<ShareConfirmDialog>` prompts for verified
- [ ] Verified confirmation sets `confirmedAt` on the ShareEvent row
- [ ] Counter pill on card shows the verified count
- [ ] Counter tooltip shows per-destination breakdown
- [ ] Same intent-then-verified flow works for WhatsApp + IG + FB
- [ ] No regression on `/feed` share rail (uses the same renamed `<ShareGroup>`)

## Permission matrix

| Action | Member | Coordinator | Director |
|---|---|---|---|
| Share network card | ✓ | ✓ | ✓ |
| View counter | ✓ | ✓ | ✓ |
| View per-destination breakdown | ✓ | ✓ | ✓ |

Same as `/feed`. No gating.

## UI states

| State | When | What user sees |
|---|---|---|
| Idle | Default | Rail + counter pill (greyed if count=0) |
| Sharing | Tap → window opens | Button briefly flashes "Opening X..." |
| Verify-prompt | Focus returns | Modal: "Did you send it?" Yes/Not yet/Skip |
| Counted | After Yes | Counter ticks up; pill briefly highlights |
| Skipped | After Skip / Not yet | No change; intent stays unverified |
| Rate-limited | Tap within 30s of prior | Silent noop (D077 §abuse) |

## Open questions to surface

- **Share URL anchor.** Should the shared URL be just `card.url`
  (cleanest) or include a `utm_source=gps-action&utm_medium=network`
  query? UTMs help upstream analytics but make the link slightly less
  clean. Lean: no UTM (honesty over self-promotion in tracking).
- **Title fallback.** If `linkPreview` is null AND `linkTitle` is null,
  what's the share title? Lean: the hostname of `card.url`.
- **Counter pill threshold.** Show the pill always, or only when
  `total > 0`? D077's display threshold for /feed was "always show".
  Lean: same here for consistency.

## Context

- D077 / ADR-0003 — share counter on /feed (the pattern reused)
- D047 — honest tracking (verified vs intent split, preserved)
- bu-share-event-polymorphic — the foundation this BU depends on
- bu-network-reactions — sibling BU, ships first (smaller, lower risk)
- Share taxonomy memory: share = socials rail + WhatsApp separate, NOT email
