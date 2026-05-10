'use client';

/**
 * @build-unit bu-ticket-view-fixes (Sub-build D — Item 17)
 * @spec docs/build/session-briefs/bu-ticket-view-fixes.md
 *
 * Client wrapper for the backlog list. Owns:
 *
 *   - Optimistic-removal state. When a card on the backlog moves to an
 *     active column, the row vanishes immediately rather than waiting
 *     on the server-action's `revalidatePath` round-trip. On error,
 *     the row is restored and an error toast appears.
 *   - The "Moved to <Column>" toast (Sharon-warmth voice — informal,
 *     not anxious). Includes a `View →` link to the active board for
 *     coordinators who want to see where the card landed; tapping it
 *     navigates explicitly. Default flow stays on /backlog.
 *
 * The mechanism is a React context (`BacklogListContext`) consumed by
 * `CardLifecycleActions` when the card sits on the backlog. The
 * context exposes `registerOptimisticMove(requestId, columnLabel)` —
 * called immediately on user pick so the row vanishes — and
 * `registerMoveError(requestId, message)` for rollback. Cards outside
 * this list see the context as null and behave as before (no-op).
 *
 * Note on cache mechanics: tRPC mutations would use `onMutate` /
 * `onError` / `onSettled` for the same effect. Our move flow runs
 * through a server action (`moveCardAction`) plus `revalidatePath`
 * rather than tRPC; the equivalent here is local state for the
 * optimistic mark and the server's revalidation as the eventual
 * source of truth.
 */

import { createContext, useContext, useState } from 'react';
import Link from 'next/link';
import { Card, type CardProps } from '@/components/board/Card';
import { BacklogQuickAdd } from '@/components/board/BacklogQuickAdd';

export interface BacklogListContextValue {
  /**
   * Optimistically hide a ticket from the rendered list. Called when
   * the user picks a destination column, before the server round-trip
   * completes — the row vanishes immediately.
   */
  registerOptimisticMove: (requestId: string, columnLabel: string) => void;
  /**
   * Roll back an optimistic move and surface an error toast. Called
   * when the server action fails after the optimistic remove fired.
   */
  registerMoveError: (requestId: string, message: string) => void;
}

const BacklogListContext = createContext<BacklogListContextValue | null>(null);

export function useBacklogList(): BacklogListContextValue | null {
  return useContext(BacklogListContext);
}

interface ToastState {
  requestId: string;
  columnLabel: string;
}

interface ErrorState {
  requestId: string;
  message: string;
}

export interface BacklogListProps {
  groupSlug: string;
  groupId: string;
  tickets: CardProps['ticket'][];
  activeColumns: Array<{ id: string; displayName: string }>;
}

export function BacklogList({ groupSlug, groupId, tickets, activeColumns }: BacklogListProps) {
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);

  const ctx: BacklogListContextValue = {
    registerOptimisticMove: (requestId, columnLabel) => {
      setRemovedIds((prev) => (prev.includes(requestId) ? prev : [...prev, requestId]));
      setToast({ requestId, columnLabel });
      setError(null);
      // Auto-dismiss the toast after a beat so it doesn't linger.
      // Sharon-warmth: brief acknowledgement, permission to close.
      window.setTimeout(() => {
        setToast((t) => (t && t.requestId === requestId ? null : t));
      }, 4000);
    },
    registerMoveError: (requestId, message) => {
      // Roll back the optimistic remove — the row reappears.
      setRemovedIds((prev) => prev.filter((id) => id !== requestId));
      setError({ requestId, message });
      setToast(null);
      window.setTimeout(() => {
        setError((e) => (e && e.requestId === requestId ? null : e));
      }, 5000);
    },
  };

  const visibleTickets = tickets.filter((t) => !removedIds.includes(t.id));

  return (
    <BacklogListContext.Provider value={ctx}>
      <ul
        data-testid="board-backlog-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {visibleTickets.map((ticket) => (
          <li key={ticket.id} style={{ margin: 0 }}>
            <Card
              groupSlug={groupSlug}
              ticket={ticket}
              lifecycle={{
                status: 'backlog',
                groupId,
                currentColumnId: null,
                activeColumns,
              }}
            />
          </li>
        ))}
        <li style={{ margin: 0, marginTop: 'var(--space-2)' }}>
          <BacklogQuickAdd groupId={groupId} groupSlug={groupSlug} />
        </li>
      </ul>
      {toast && (
        <div
          data-testid="board-backlog-moved-toast"
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 'var(--space-5)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--colour-surface-raised)',
            border: '1px solid var(--colour-border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 6px 18px color-mix(in oklch, currentColor 12%, transparent)',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            maxWidth: 360,
          }}
        >
          <span>Moved to {toast.columnLabel}.</span>
          <Link
            href={`/board/${groupSlug}`}
            data-testid="board-backlog-moved-toast-view"
            style={{
              color: 'var(--colour-text-link)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            View →
          </Link>
        </div>
      )}
      {error && (
        <div
          data-testid="board-backlog-move-error"
          role="alert"
          style={{
            position: 'fixed',
            bottom: 'var(--space-5)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--colour-surface-raised)',
            border: '1px solid var(--colour-danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--colour-danger)',
            fontSize: 'var(--text-sm)',
            maxWidth: 360,
          }}
        >
          {error.message}
        </div>
      )}
    </BacklogListContext.Provider>
  );
}

interface BacklogEmptyProps {
  groupSlug: string;
  groupId: string;
}

export function BacklogEmpty({ groupSlug, groupId }: BacklogEmptyProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <p
        data-testid="board-backlog-empty"
        style={{
          padding: 'var(--space-5)',
          background: 'var(--colour-surface-sunken)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--colour-text-secondary)',
          textAlign: 'center',
        }}
      >
        No tickets in the backlog. New tickets land here before being placed on a column.
      </p>
      <BacklogQuickAdd groupId={groupId} groupSlug={groupSlug} />
    </div>
  );
}
