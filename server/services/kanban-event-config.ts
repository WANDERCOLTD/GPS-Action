/**
 * @build-unit bu-kanban-event-config
 * @spec build/session-briefs/bu-kanban-event-config.md
 * @adr 0014
 *
 * Hot-path read for atom 5d-3 of bu-coordination-board: should this
 * kanban event write a system-Comment row into the ticket thread?
 *
 * Per ADR-0014:
 *   - Global (one row per event kind), no per-group split in v1
 *   - No backfill — flipping affects future events only
 *   - Admin writes go through the generic admin CRUD surface (the
 *     `kanbanEventConfig` registry entry); this module exposes only
 *     the read.
 *
 * Performance note: a Prisma findUnique per call is ~1ms. If pilot
 * data shows this in a hot loop, add a process-level cache with a
 * short TTL (5–10s) — the toggles change rarely. Don't optimise
 * until measured.
 */

import type { KanbanEventKind } from '@prisma/client';
import { prisma } from '@/server/db/client';

/**
 * Returns true iff the named event kind is currently enabled. A
 * missing row is treated as `false` (defensive — every kind should
 * exist after the seed migration, but a missing row should not crash
 * the kanban mutation hot path).
 */
export async function isEventEnabled(eventKind: KanbanEventKind): Promise<boolean> {
  const row = await prisma.kanbanEventConfig.findUnique({
    where: { eventKind },
    select: { enabled: true },
  });
  return row?.enabled ?? false;
}
