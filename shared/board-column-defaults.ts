/**
 * @build-unit bu-coordination-board (build seq #2 — board-column chunk)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0006
 *
 * Default `BoardColumn` sets seeded on `Group` creation, keyed by
 * `GroupKind`. Per ADR-0006 these live in code (not in a reference-data
 * migration) — they're an initial-state convenience, not a boot-time
 * invariant. Group admins rename / reorder / delete freely after seed.
 *
 * Display names are intentionally short (kanban headers are tight on
 * mobile). Plain English; no jargon. Order is the seeded ordinal.
 *
 * The brief flags `workstream` columns 2-3 as confirmable against
 * Writers / IT pilot input. ADR-0006 locks them as the seed default;
 * a follow-up edit to this file is the rename path if pilots disagree.
 */

import type { GroupKind } from '@prisma/client';

export const BOARD_COLUMN_DEFAULTS_BY_KIND: Record<GroupKind, readonly string[]> = {
  workstream: ['Recruitment', 'Preparation', 'Implementation', 'Monitoring'],
  team: ['Recruitment', 'Preparation', 'Implementation', 'Monitoring'],
  region: ['New', 'Active', 'Resolved'],
  network: ['New', 'Open', 'Done'],
  topic: ['New', 'Active', 'Resolved'],
};

export function defaultColumnsForKind(kind: GroupKind): readonly string[] {
  return BOARD_COLUMN_DEFAULTS_BY_KIND[kind];
}
