'use client';

/**
 * @build-unit bu-coordination-board (Surface 2 — urgent-flip atom)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Urgent toggle for Surface 2. The urgent dot itself is rendered next
 * to the title by `EditableTicketTitle`; this component is just the
 * mark / clear control. Permission is "any group member" — same as
 * editTitle / editBody — gated server-side in `board.setUrgent`.
 *
 * Optimistic UX: the button label reflects what the click *will* do,
 * not the current state. So "Mark Urgent" when not urgent; "Clear
 * Urgent" when urgent. After click, the route revalidates and the
 * label flips. This mirrors the BoardActionPair "Assign me" /
 * "Unassign" affordance.
 *
 * Honest copy: no jargon — "Urgent" is the public-facing word.
 */

import { useTransition, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { setUrgentAction } from '@/app/board/[groupSlug]/[ticketId]/actions';

export interface UrgentToggleProps {
  requestId: string;
  groupId: string;
  groupSlug: string;
  /** Current `Request.urgency`. */
  urgent: boolean;
}

export function UrgentToggle({ requestId, groupId, groupSlug, urgent }: UrgentToggleProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function flip() {
    setError(null);
    startTransition(async () => {
      const result = await setUrgentAction({
        requestId,
        groupSlug,
        groupId,
        urgent: !urgent,
      });
      if (!result.ok) {
        setError(result.error ?? 'Could not update — try again.');
      }
    });
  }

  return (
    <div
      data-testid="board-urgent-toggle"
      data-urgent={urgent ? 'true' : 'false'}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
      }}
    >
      <button
        type="button"
        data-testid="board-urgent-toggle-btn"
        onClick={flip}
        disabled={isPending}
        className={
          urgent ? 'gps-btn gps-btn--secondary gps-btn--sm' : 'gps-btn gps-btn--ghost gps-btn--sm'
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
        }}
      >
        <AlertTriangle
          size={14}
          aria-hidden="true"
          style={urgent ? { color: 'var(--colour-danger)' } : undefined}
        />
        {urgent ? 'Clear Urgent' : 'Mark Urgent'}
      </button>
      {error && (
        <span
          role="alert"
          data-testid="board-urgent-toggle-error"
          style={{
            color: 'var(--colour-danger)',
            fontSize: 'var(--text-xs)',
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
