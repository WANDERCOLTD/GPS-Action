/**
 * @build-unit bu-network-shares
 * @spec adrs/0018-share-event-polymorphic.md
 * @spec architecture/decision-log.md (D047, D077)
 * @spec product/analytics-events.md
 * @spec build/session-briefs/bu-network-shares.md
 *
 * Polymorphic share-event service. Writes intent + verified rows to
 * the `ShareEvent` table created by Phase A of
 * bu-share-event-polymorphic (ADR-0018). Mirrors the Reaction service's
 * polymorphic shape — one service surface, multiple target types.
 *
 * Two write paths:
 *
 *   - `recordShareIntent` — fires when a member taps a share button.
 *     Upserts an intent row (unique by target + user + destination).
 *     Re-taps within the 30s rate-limit window are silent no-ops (per
 *     D077 §abuse). Outside that window, re-taps update `intentAt`.
 *     `confirmedAt` is preserved when present (an existing verified
 *     row is NOT downgraded by a fresh intent).
 *
 *   - `confirmShareSent` — fires when the member taps "I sent it" in
 *     the verify-prompt dialog. Upserts the same unique key but sets
 *     `confirmedAt = now()` (idempotent: once verified, stays
 *     verified — repeat confirms are no-ops).
 *
 * One read path:
 *
 *   - `getNetworkCardShareCounts` — projects per-card counters for
 *     the /network list. Returns `{ total, perDestination }` for each
 *     messageId. `total` is the verified count (confirmedAt IS NOT
 *     NULL) per D047 — verified is what the public counter reads.
 *     The per-destination breakdown carries both intent + verified
 *     splits in the tooltip layer (Phase 2 — for now the public
 *     payload is verified-only to match the brief's "honest tracking"
 *     posture).
 *
 * Auth boundary: this service does NOT enforce authentication. The
 * caller (router / API route) must establish the userId. Refusing
 * here would duplicate the gate.
 */

import type { ShareDestination, ShareTargetType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';

// ── Types ────────────────────────────────────────────────────────────────

export interface RecordIntentInput {
  userId: string;
  targetType: ShareTargetType;
  /** Stringified parent id. BigInt-safe — network card ids are BIGINT. */
  targetId: string;
  destination: ShareDestination;
}

export interface ConfirmSentInput extends RecordIntentInput {}

export interface ShareCounts {
  /** Verified count (confirmedAt IS NOT NULL). Public counter reads this. */
  total: number;
  /** Per-destination verified counts. Tooltip breakdown reads this. */
  perDestination: Record<ShareDestination, number>;
}

/**
 * 30-second rate-limit window for re-taps on the same (target, user,
 * destination) tuple. Per D077 §abuse: a member rage-tapping the same
 * share icon should produce one row, not N. Re-taps inside the window
 * are silent — neither erroring nor updating the row. Re-taps outside
 * the window refresh `intentAt` (the member legitimately re-shared).
 */
const INTENT_RATE_LIMIT_MS = 30_000;

// ── Helpers ──────────────────────────────────────────────────────────────

const ALL_DESTINATIONS: readonly ShareDestination[] = [
  'whatsapp',
  'x',
  'instagram',
  'facebook',
  'email',
  'copy_link',
  'other',
];

function emptyPerDestination(): Record<ShareDestination, number> {
  const out = {} as Record<ShareDestination, number>;
  for (const d of ALL_DESTINATIONS) out[d] = 0;
  return out;
}

/**
 * Resolve which typed FK column to populate based on targetType. Keeps
 * the cascade contract intact — Postgres will drop share rows when the
 * parent post / network card is deleted. The polymorphic discriminator
 * `targetId` is the cross-target index.
 */
function typedForeignKeys(input: RecordIntentInput): {
  postId: string | null;
  networkCardStateId: bigint | null;
} {
  if (input.targetType === 'post') {
    return { postId: input.targetId, networkCardStateId: null };
  }
  if (input.targetType === 'network_card') {
    return { postId: null, networkCardStateId: BigInt(input.targetId) };
  }
  // Exhaustive — TS narrows. If a future enum value lands without a
  // service-side branch, throw rather than silently dropping the FK.
  throw new Error(`[share-event] unsupported targetType: ${String(input.targetType)}`);
}

// ── Intent ───────────────────────────────────────────────────────────────

/**
 * Result discriminates so callers (and tests) can assert the rate-limit
 * path without re-querying. `kind: 'rate_limited'` means a row existed
 * and was inside the 30s window — no DB write occurred.
 */
export type RecordIntentResult =
  | { kind: 'created' }
  | { kind: 'updated' }
  | { kind: 'rate_limited' };

export async function recordShareIntent(input: RecordIntentInput): Promise<RecordIntentResult> {
  const fks = typedForeignKeys(input);

  const existing = await prisma.shareEvent.findUnique({
    where: {
      share_event_unique: {
        targetType: input.targetType,
        targetId: input.targetId,
        userId: input.userId,
        destination: input.destination,
      },
    },
    select: { intentAt: true },
  });

  if (existing) {
    const sinceMs = Date.now() - existing.intentAt.getTime();
    if (sinceMs < INTENT_RATE_LIMIT_MS) {
      return { kind: 'rate_limited' };
    }
    await prisma.shareEvent.update({
      where: {
        share_event_unique: {
          targetType: input.targetType,
          targetId: input.targetId,
          userId: input.userId,
          destination: input.destination,
        },
      },
      data: { intentAt: new Date() },
    });
    return { kind: 'updated' };
  }

  try {
    await prisma.shareEvent.create({
      data: {
        userId: input.userId,
        targetType: input.targetType,
        targetId: input.targetId,
        postId: fks.postId,
        networkCardStateId: fks.networkCardStateId,
        destination: input.destination,
      },
    });
    return { kind: 'created' };
  } catch (err) {
    // Race: a parallel request inserted the row between our findUnique
    // and create. Treat as rate-limited (the parallel request just
    // wrote an intent for this tuple — re-doing it now is a noop).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { kind: 'rate_limited' };
    }
    throw err;
  }
}

// ── Confirm ──────────────────────────────────────────────────────────────

export type ConfirmSentResult = { kind: 'confirmed' } | { kind: 'already_confirmed' };

/**
 * Set `confirmedAt = now()` on the row matching the unique key. If the
 * row doesn't exist (no prior intent — direct verify), creates it with
 * both `intentAt` and `confirmedAt = now()`. Idempotent: re-confirming
 * an already-confirmed row is a no-op (preserves the original
 * confirmation timestamp).
 */
export async function confirmShareSent(input: ConfirmSentInput): Promise<ConfirmSentResult> {
  const fks = typedForeignKeys(input);

  const existing = await prisma.shareEvent.findUnique({
    where: {
      share_event_unique: {
        targetType: input.targetType,
        targetId: input.targetId,
        userId: input.userId,
        destination: input.destination,
      },
    },
    select: { confirmedAt: true },
  });

  if (existing?.confirmedAt) {
    return { kind: 'already_confirmed' };
  }

  const now = new Date();
  await prisma.shareEvent.upsert({
    where: {
      share_event_unique: {
        targetType: input.targetType,
        targetId: input.targetId,
        userId: input.userId,
        destination: input.destination,
      },
    },
    create: {
      userId: input.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      postId: fks.postId,
      networkCardStateId: fks.networkCardStateId,
      destination: input.destination,
      intentAt: now,
      confirmedAt: now,
    },
    update: {
      confirmedAt: now,
    },
  });

  return { kind: 'confirmed' };
}

// ── Read ─────────────────────────────────────────────────────────────────

/**
 * Bulk-project verified share counts for the /network list. Returns a
 * Map keyed by the stringified messageId. Cards with zero verified
 * shares get a zero-filled `ShareCounts` so the caller can unconditionally
 * read `counts.total`.
 *
 * Implementation notes:
 *   - `confirmedAt IS NOT NULL` is the verified filter (D047). Intent-only
 *     rows do NOT appear in the public counter.
 *   - Grouped by (targetId, destination) so the per-destination breakdown
 *     is one query, not N.
 *   - Empty input → empty Map. Callers can iterate the list without a
 *     conditional.
 */
export async function getNetworkCardShareCounts(
  messageIds: ReadonlyArray<string>,
): Promise<Map<string, ShareCounts>> {
  const out = new Map<string, ShareCounts>();
  if (messageIds.length === 0) return out;

  for (const id of messageIds) {
    out.set(id, { total: 0, perDestination: emptyPerDestination() });
  }

  const grouped = await prisma.shareEvent.groupBy({
    by: ['targetId', 'destination'],
    where: {
      targetType: 'network_card',
      targetId: { in: [...messageIds] },
      confirmedAt: { not: null },
    },
    _count: { _all: true },
  });

  for (const row of grouped) {
    const entry = out.get(row.targetId);
    if (!entry) continue;
    entry.perDestination[row.destination] = row._count._all;
    entry.total += row._count._all;
  }

  return out;
}
