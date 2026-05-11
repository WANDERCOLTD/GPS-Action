---
slug: bu-network-reactions
status: planned
phase: 2
priority: high
note: "Reactions on /network cards. Extend ReactionTargetType enum to add network_card. Reuse the existing rail/tray from /feed. Smallest of the three engagement briefs; unblocks visual parity between surfaces."
---

# SESSION BRIEF · bu-network-reactions — quiet emoji reactions on Network cards

_Author: Paul + Claude · Created: 2026-05-11_
_Type: Additive schema extension + UI reuse. One enum value, one nullable FK, one component re-mount._

---

## 1 · Business Analyst — why this matters

### The problem in plain language

Network cards are inert. Coordinators triage them via the
`Triaged / Promoted / Discarded` row, but the people best placed to
signal whether something resonates — the wider membership reading the
network feed — have no way to express anything. On `/feed` posts there
are eight quiet reactions (🕯️ 🙏 ❤️ 💪 🎯 💕 👍 😢) doing exactly that
work: emotional acknowledgement without the cost of a comment.

The asymmetry is bad UX. A member sees a Sharon-worthy article on
`/feed` and can press 💕; the same article surfaced on `/network`
gives them nothing but a triage row they're not qualified to use.

### Why this matters now

Three reinforcing reasons:

1. **The network feed just started feeling alive** (`bu-network-feed`
   shipped, link previews shipped, the cards look real). Reactions
   are the natural next layer of social affordance.
2. **Coordinators need member signal for triage decisions.** "32 hearts
   on this one in 2 hours" is a strong promotion signal — better than
   any algorithm we could write today.
3. **The plumbing is cheap.** `ReactionTargetType` was designed
   polymorphic from day one (D052 added `comment` the same way this BU
   adds `network_card`). One enum value, one FK.

### Who benefits

- **Members:** an emotional outlet on network content that doesn't
  require writing words (especially good for sensitive content where
  words feel wrong — bereavement posts, threat reports).
- **Coordinators:** a member-driven signal layered on top of triage.
- **Future "Promoted → Post" flow:** when a coordinator promotes a
  card, the existing reaction count comes along — no zero-state.

### Success looks like

- ≥30% of `/network` cards in a 30-day window carry at least one
  reaction.
- Coordinators report (informally) that they use reaction counts
  alongside their own judgement when triaging.
- Zero regressions on `/feed` reactions.

---

## 2 · Tech Lead — the design

### Schema

```prisma
enum ReactionTargetType {
  post
  comment
  network_card  // new
}

model Reaction {
  ...existing fields...

  // New nullable FK alongside the existing postId / commentId FKs.
  // When targetType='network_card', this FK is set and equals
  // BigInt(targetId). Service layer enforces the cross-check.
  networkCardStateId BigInt?
  networkCardState   NetworkCardState? @relation(
    "networkCardReactions",
    fields: [networkCardStateId],
    references: [messageId],
    onDelete: Cascade,
  )
}

model NetworkCardState {
  ...existing fields...
  reactions Reaction[] @relation("networkCardReactions")
}
```

**FK target: `NetworkCardState.messageId`** — not the upstream
`gps_group_messages.id` (we don't own that table). On first reaction,
the service upserts a `NetworkCardState` row with `status: NEW` so the
FK has a parent. The upsert is the same pattern used by the existing
triage handlers — no new mechanic.

### Migration

One additive forward-only migration:

1. Add `network_card` value to the enum.
2. Add nullable `networkCardStateId` column + FK to `Reaction`.
3. Add a CHECK constraint enforcing: `targetType='network_card'`
   ⇔ `networkCardStateId IS NOT NULL` ⇔ `postId IS NULL`
   ⇔ `commentId IS NULL`. (Belt and braces alongside service-layer
   validation; the existing comment-target migration is the model.)

No backfill. New rows only.

### Service layer

`server/services/reaction.ts` extends the existing handler:

- `toggleReaction(userId, targetType, targetId, emoji)` — already
  polymorphic by signature.
- New branch: when `targetType === 'network_card'`:
  - Validate `targetId` parses to bigint
  - Upsert `NetworkCardState` row keyed on `messageId = BigInt(targetId)`
    with default `status: NEW` if absent
  - Set `networkCardStateId = BigInt(targetId)` on the reaction
  - Set `postId = null`, `commentId = null`

The audit-log entry uses `action: 'reaction.toggle'` with
`entityType: 'networkCardState'` and `entityId: targetId`.

### Router

`server/routers/reaction.ts` — extend the `targetType` zod enum.
No new procedure; the existing `toggle` mutation accepts the new
target.

### UI

Reuse the existing `<ReactionTray>` / `<ReactionPill>` components.
They take `{ targetType, targetId, currentUserId, counts }` props
today (via `bu-comments-reactions` polymorphism) — no parameterising
needed. Mount in `<NetworkCard>` between the meta row and the link
preview block.

### Layer boundaries

All edits stay within enforced boundaries:

- `prisma/schema.prisma` (db)
- `prisma/migrations/<ts>_reactions_on_network_cards/` (db)
- `server/services/reaction.ts` (model)
- `server/routers/reaction.ts` (controller — types only from shared)
- `components/NetworkCard.tsx` (view)

No new lib code, no cross-layer leaks.

### Tests

- **Unit** — `tests/unit/reaction-service.test.ts`: extend with
  network_card branch coverage (upserts state row, sets correct FK,
  audit-logs with right entityType).
- **Integration** — `tests/integration/reaction-router.test.ts`:
  toggle on a fresh card creates state + reaction; toggle again
  removes; cascade-delete from NetworkCardState removes reactions.
- **Component** — `tests/unit/network-card.test.tsx`: tray renders;
  click dispatches toggle with the right target props.

### Rollback

Drop the `network_card` enum value, drop the FK column, drop the
CHECK constraint. The reaction service falls back to its prior
two-branch shape. `/feed` reactions are untouched throughout.

---

## Scope

### Build in this session

- `prisma/schema.prisma`
- `prisma/migrations/<ts>_reactions_on_network_cards/migration.sql`
- `server/services/reaction.ts` (extend)
- `server/routers/reaction.ts` (extend zod enum)
- `shared/validation/reaction.ts` (extend target enum)
- `components/NetworkCard.tsx` (mount tray)
- Tests above
- `package.json` version bump (patch)

### Do NOT touch

- `components/ReactionTray.tsx` / `ReactionPill.tsx` (already polymorphic)
- `components/PostCard.tsx` (no regression risk)
- `app/network/*` (the page itself doesn't change)
- `server/services/network.ts` (orthogonal to the reactions layer)

### Out of scope

- Reaction analytics dashboard (covered by existing reaction admin
  surface, network targets just add rows)
- Reaction-on-network notifications (push notifications for reactions
  are a v2 concern even on /feed today)
- "Promoted → Post" transformation (parked per Paul's answer to
  open-question #1)

## Acceptance criteria

- [ ] Reaction tray renders on every NetworkCard
- [ ] Tapping a reaction creates a Reaction row with
      `targetType='network_card'` and the correct `networkCardStateId`
- [ ] Tapping the same reaction twice toggles it off (existing pattern)
- [ ] First reaction on a card with no existing state row auto-creates
      a `NetworkCardState` row with `status: NEW`
- [ ] Tray shows aggregate count per emoji (same as /feed)
- [ ] Cascade-delete: removing a NetworkCardState row removes all its
      reactions
- [ ] CHECK constraint blocks malformed rows (test via raw SQL insert)
- [ ] No regression: `/feed` reaction toggle still works
- [ ] Audit log entries written with `entityType: 'networkCardState'`

## Permission matrix

| Action | Member | Coordinator | Director |
|---|---|---|---|
| React on network card | ✓ | ✓ | ✓ |
| View reaction counts | ✓ | ✓ | ✓ |
| Remove others' reactions | — | — | — (use admin tools) |

Same as `/feed` reactions.

## Open questions to surface

None — Paul's locked the three answers from the investigation:

1. Promoted does nothing yet (future may transform into a Post)
2. Same 8 emojis as `/feed`
3. Sharing concern is part of `bu-network-shares`, not this brief

## Context

- D050 — BU-reactions (origin of the reaction layer)
- D052 — BU-comments (polymorphic-ised the reaction enum first time)
- ADR-0017 — `NetworkCardState` schema
- `server/services/reaction.ts` — existing implementation
- `components/ReactionTray.tsx` — already polymorphic, ready to reuse
