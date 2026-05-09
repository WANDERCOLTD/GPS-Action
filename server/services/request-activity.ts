/**
 * @build-unit bu-ticket-view-fixes — Sub-build A
 * @spec docs/build/session-briefs/bu-ticket-view-fixes.md (Item 14)
 * @adr 0015
 *
 * `Request.lastActivityAt` bump-helper.
 *
 * Single source of truth for "the team has done something visible to
 * this ticket." Per ADR-0015, every tRPC mutation that performs a
 * visible-activity bump-event calls `touchRequestActivity` after its
 * primary write. Reading the helper's call sites with `grep` keeps the
 * bump set auditable in PR review.
 *
 * Bump events (per ADR-0015):
 *   - comment posted / note posted
 *   - lifecycle status change (move-to-board / -backlog / mark done)
 *   - assignment add / remove (including Unassign)
 *   - share / unshare
 *   - title edit / description (`body`) edit
 *
 * NOT bumped:
 *   - silent metadata-only changes (audit-only backfills, system
 *     re-indexing)
 *   - `lastHeartbeatAt` writes (presence pattern — ADR-0011)
 *   - read events (subscription pings, view counts)
 *
 * Accepts either the singleton `prisma` client or a transaction client
 * (`Prisma.TransactionClient`) so callers can keep the bump inside the
 * same transaction as their primary write — failures roll back coherently.
 *
 * Layer boundary: services → db + lib + shared only.
 */

import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Bump `Request.lastActivityAt` to the supplied timestamp (defaults to
 * `now()`). Returns void — callers don't need the row back; if they do,
 * they read it via their normal query path on the next tick.
 *
 * The `db` parameter is intentionally typed as the union of
 * `PrismaClient` and `Prisma.TransactionClient` so call sites can pass
 * either: a top-level `prisma` for stand-alone bumps, or a `tx` from
 * inside `prisma.$transaction(...)` for atomic bumps that must roll
 * back with their primary write.
 */
export async function touchRequestActivity(
  db: PrismaClient | Prisma.TransactionClient,
  requestId: string,
  now: Date = new Date(),
): Promise<void> {
  await db.request.update({
    where: { id: requestId },
    data: { lastActivityAt: now },
  });
}
