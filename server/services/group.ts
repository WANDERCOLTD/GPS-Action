/**
 * @build-unit bu-group-identity
 * @spec docs/build/session-briefs/bu-group-identity.md
 * @spec docs/adrs/0013-group-colour-identity.md
 *
 * Group-shaped helpers that don't fit the kanban-scoped reads in
 * group-kanban.ts. Currently: the colour-key round-robin used at
 * group creation.
 *
 * Layer boundary: services → db + lib + shared only.
 */

import type { GroupColourKey } from '@prisma/client';
import { prisma } from '@/server/db/client';

/**
 * Canonical palette order (per ADR-0013). The order matters as the
 * lexical tiebreaker when multiple colours are tied as
 * least-recently-used (e.g. on a fresh DB where no colour has been
 * assigned yet, this returns `slate` first).
 */
export const GROUP_COLOUR_PALETTE: readonly GroupColourKey[] = [
  'slate',
  'rust',
  'moss',
  'plum',
  'ochre',
  'teal',
  'indigo',
  'coral',
  'sage',
  'amber',
  'rose',
  'stone',
];

/**
 * Pick the next colour-key for a new Group, round-robin LRU (per
 * ADR-0013 §assignment policy):
 *
 *   1. Find the most-recent `createdAt` per colourKey across all
 *      non-soft-deleted groups.
 *   2. Any palette name with zero usage wins outright (palette-order
 *      tiebreak among unused).
 *   3. Among used names, pick the one whose most-recent assignment
 *      is oldest — i.e. least recently used.
 *
 * Soft-deleted groups are excluded from the usage count: a colour
 * that's only "in use" by a soft-deleted group is fair game again.
 */
export async function assignNextColourKey(): Promise<GroupColourKey> {
  const usage = await prisma.group.groupBy({
    by: ['colourKey'],
    where: { deletedAt: null },
    _max: { createdAt: true },
  });

  // Score each palette entry: -Infinity for "fully unused" (no row in
  // `usage`), 0 for "used but with a null _max" (defensive — Prisma
  // shouldn't return that), or the row's max(createdAt) ms otherwise.
  // The lowest score wins; palette order is the stable tiebreak.
  const lastUsedScore = new Map<GroupColourKey, number>();
  for (const row of usage) {
    lastUsedScore.set(row.colourKey, row._max.createdAt?.getTime() ?? 0);
  }

  let best = GROUP_COLOUR_PALETTE[0] as GroupColourKey;
  let bestScore = lastUsedScore.has(best)
    ? (lastUsedScore.get(best) ?? 0)
    : Number.NEGATIVE_INFINITY;
  for (const name of GROUP_COLOUR_PALETTE.slice(1)) {
    const score = lastUsedScore.has(name)
      ? (lastUsedScore.get(name) ?? 0)
      : Number.NEGATIVE_INFINITY;
    if (score < bestScore) {
      best = name;
      bestScore = score;
    }
  }
  return best;
}
