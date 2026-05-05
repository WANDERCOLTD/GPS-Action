'use client';

/**
 * @build-unit bu-coordination-board (build seq #5 — Surface 2, PR #5b)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Unified Assign-me / Follow pair from the brief's Surface 2 layout.
 * Two adjacent buttons share visual language to surface the brief's
 * "subscribe and assign-me are the same conceptual motion at
 * different commitment levels."
 *
 *   - Assign me ↔ Unassign  (drives `assignment.assignSelf` /
 *     `unassignSelf`; auto-subscribe on assign per Tier-2 default #4).
 *   - Follow ↔ Unfollow      (drives `subscription.followSelf` /
 *     `unfollowSelf`; explicit unfollow survives unassign).
 *
 * Initial state (`assigned`, `following`) comes from the server-rendered
 * page derived from `getTicketDetail`. After a mutation, the server
 * action `revalidatePath`s the ticket route so the next render carries
 * fresh state — local optimism is not used (matches the rest of the
 * codebase's mutation pattern).
 */

import { useState, useTransition } from 'react';
import {
  assignSelfAction,
  unassignSelfAction,
  followSelfAction,
  unfollowSelfAction,
  type BoardActionResult,
} from '@/app/board/[groupSlug]/[ticketId]/actions';

export interface BoardActionPairProps {
  requestId: string;
  groupSlug: string;
  /** Is the viewer currently an active assignee on this ticket? */
  assigned: boolean;
  /** Is the viewer currently subscribed (any source) to this ticket? */
  following: boolean;
}

type ActionFn = (input: { requestId: string; groupSlug: string }) => Promise<BoardActionResult>;

export function BoardActionPair({
  requestId,
  groupSlug,
  assigned,
  following,
}: BoardActionPairProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: ActionFn) {
    setError(null);
    startTransition(async () => {
      const result = await action({ requestId, groupSlug });
      if (!result.ok) setError(result.error ?? 'Could not save — try again.');
    });
  }

  const assignLabel = assigned ? 'Unassign' : 'Assign me';
  const followLabel = following ? 'Unfollow' : 'Follow';
  const assignAction: ActionFn = assigned ? unassignSelfAction : assignSelfAction;
  const followAction: ActionFn = following ? unfollowSelfAction : followSelfAction;

  return (
    <div
      data-testid="board-action-pair"
      data-assigned={assigned ? 'true' : 'false'}
      data-following={following ? 'true' : 'false'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          data-testid="board-action-pair-assign-btn"
          data-state={assigned ? 'assigned' : 'unassigned'}
          data-request-id={requestId}
          disabled={isPending}
          onClick={() => run(assignAction)}
          className={`gps-btn gps-btn--sm ${assigned ? 'gps-btn--secondary' : 'gps-btn--primary'}`}
        >
          {isPending ? '…' : assignLabel}
        </button>
        <button
          type="button"
          data-testid="board-action-pair-follow-btn"
          data-state={following ? 'following' : 'unfollowed'}
          data-request-id={requestId}
          disabled={isPending}
          onClick={() => run(followAction)}
          className={`gps-btn gps-btn--sm ${following ? 'gps-btn--secondary' : 'gps-btn--ghost'}`}
        >
          {isPending ? '…' : followLabel}
        </button>
      </div>
      {error && (
        <span
          role="alert"
          data-testid="board-action-pair-error"
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
