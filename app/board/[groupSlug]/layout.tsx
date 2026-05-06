/**
 * @build-unit bu-coordination-board
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Per-group board layout. Wraps every surface (`/active`, `/backlog`,
 * `/done`, `/<ticketId>`) in `<UndoToastProvider>` so any move action
 * — wherever it fires from — can register a 5-second undo. Cleanest
 * way to get cross-surface coverage without re-mounting the provider
 * on each page.
 */

import type { ReactNode } from 'react';
import { UndoToastProvider } from '@/components/board/UndoToastContext';

export default function BoardGroupLayout({ children }: { children: ReactNode }) {
  return <UndoToastProvider>{children}</UndoToastProvider>;
}
