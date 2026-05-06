/**
 * @build-unit bu-coordination-board (Surface 1 — shared lane icons)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Single source of truth for the icon + label representation of each
 * board lane (Active, Backlog, Done, Abandoned). Used by:
 *   - `BoardTabs` for the tab strip headers.
 *   - `CardLifecycleActions` for the per-card "move to <lane>"
 *     affordance — keeps the lane icon recognisable across surfaces.
 *
 * Adding a lane = add a new entry here. Don't fork icons elsewhere.
 */

import { CheckCircle2, Inbox, LayoutGrid, XCircle, type LucideIcon } from 'lucide-react';

export type BoardLane = 'active' | 'backlog' | 'done' | 'abandoned';

export interface BoardLaneMeta {
  label: string;
  icon: LucideIcon;
  /** URL suffix appended to /board/<groupSlug> for the list view. */
  href: string;
}

export const BOARD_LANE_META: Record<BoardLane, BoardLaneMeta> = {
  active: { label: 'Active', icon: LayoutGrid, href: '' },
  backlog: { label: 'Backlog', icon: Inbox, href: '/backlog' },
  done: { label: 'Done', icon: CheckCircle2, href: '/done' },
  abandoned: { label: 'Abandoned', icon: XCircle, href: '/abandoned' },
};
