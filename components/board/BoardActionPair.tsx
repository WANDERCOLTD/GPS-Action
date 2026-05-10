'use client';

/**
 * @build-unit bu-coordination-board (build seq #5 — Surface 2, PR #5b)
 *              · bu-ticket-view-fixes (Sub-build D — Items 1, 3)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 * @spec docs/build/session-briefs/bu-ticket-view-fixes.md
 *
 * Originally a single side-by-side pair (Assign me / Follow). Sub-build D
 * splits the pair into two independently-mountable buttons so the page
 * can render Assign-self inside the Assignees panel and Follow-self
 * elsewhere — separating them in the layout removes the misclick path
 * that produced the original "Unfollow sometimes also Unassigns" bug
 * (Item 2 regression test below still passes).
 *
 * Buttons rendered:
 *
 *   - <AssignSelfButton /> ↔ assignment.assignSelf / unassignSelf.
 *     Carries the asymmetric-coupling tooltip ("Also follows this
 *     ticket") on the assign-self path per Item 3 — the rule
 *     "Assign me also Follows" is non-obvious and silent without it.
 *   - <FollowSelfButton /> ↔ subscription.followSelf / unfollowSelf.
 *
 * <BoardActionPair /> is retained as a thin wrapper that mounts both
 * inside one row — kept for any caller that still wants the side-by-side
 * pattern, but the ticket-detail page no longer uses it (it mounts the
 * two buttons in different sections).
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

interface SelfActionInput {
  requestId: string;
  groupSlug: string;
}

type ActionFn = (input: SelfActionInput) => Promise<BoardActionResult>;

export interface AssignSelfButtonProps {
  requestId: string;
  groupSlug: string;
  /** Is the viewer currently an active assignee on this ticket? */
  assigned: boolean;
}

export interface FollowSelfButtonProps {
  requestId: string;
  groupSlug: string;
  /** Is the viewer currently subscribed (any source) to this ticket? */
  following: boolean;
}

export interface BoardActionPairProps extends AssignSelfButtonProps, FollowSelfButtonProps {}

interface SelfActionResult {
  isPending: boolean;
  error: string | null;
  run: (action: ActionFn) => void;
}

function useSelfAction(requestId: string, groupSlug: string): SelfActionResult {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: ActionFn): void {
    setError(null);
    startTransition(async () => {
      const result = await action({ requestId, groupSlug });
      if (!result.ok) setError(result.error ?? 'Could not save — try again.');
    });
  }

  return { isPending, error, run };
}

function ErrorRow({ error, testid }: { error: string | null; testid: string }) {
  if (!error) return null;
  return (
    <span
      role="alert"
      data-testid={testid}
      style={{
        color: 'var(--colour-danger)',
        fontSize: 'var(--text-xs)',
      }}
    >
      {error}
    </span>
  );
}

export function AssignSelfButton({ requestId, groupSlug, assigned }: AssignSelfButtonProps) {
  const { isPending, error, run } = useSelfAction(requestId, groupSlug);

  const label = assigned ? 'Unassign me' : 'Assign me';
  const action: ActionFn = assigned ? unassignSelfAction : assignSelfAction;
  // Item 3 — surface the asymmetric coupling on the assign-self path
  // only. Unassign / Follow / Unfollow don't need explanation.
  const tooltip = assigned ? undefined : 'Also follows this ticket';

  return (
    <div
      data-testid="board-assign-self"
      data-assigned={assigned ? 'true' : 'false'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
      }}
    >
      <button
        type="button"
        data-testid="board-action-pair-assign-btn"
        data-state={assigned ? 'assigned' : 'unassigned'}
        data-request-id={requestId}
        disabled={isPending}
        onClick={() => run(action)}
        title={tooltip}
        className={`gps-btn gps-btn--sm ${assigned ? 'gps-btn--secondary' : 'gps-btn--primary'}`}
      >
        {isPending ? '…' : label}
      </button>
      <ErrorRow error={error} testid="board-assign-self-error" />
    </div>
  );
}

export function FollowSelfButton({ requestId, groupSlug, following }: FollowSelfButtonProps) {
  const { isPending, error, run } = useSelfAction(requestId, groupSlug);

  const label = following ? 'Unfollow' : 'Follow';
  const action: ActionFn = following ? unfollowSelfAction : followSelfAction;

  return (
    <div
      data-testid="board-follow-self"
      data-following={following ? 'true' : 'false'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
      }}
    >
      <button
        type="button"
        data-testid="board-action-pair-follow-btn"
        data-state={following ? 'following' : 'unfollowed'}
        data-request-id={requestId}
        disabled={isPending}
        onClick={() => run(action)}
        className={`gps-btn gps-btn--sm ${following ? 'gps-btn--secondary' : 'gps-btn--ghost'}`}
      >
        {isPending ? '…' : label}
      </button>
      <ErrorRow error={error} testid="board-follow-self-error" />
    </div>
  );
}

/**
 * Backward-compatible side-by-side wrapper. New surfaces should mount
 * <AssignSelfButton /> + <FollowSelfButton /> separately so the two are
 * not adjacent in the layout (the misclick path Item 1 / Item 2 closes).
 */
export function BoardActionPair({
  requestId,
  groupSlug,
  assigned,
  following,
}: BoardActionPairProps) {
  return (
    <div
      data-testid="board-action-pair"
      data-assigned={assigned ? 'true' : 'false'}
      data-following={following ? 'true' : 'false'}
      style={{
        display: 'inline-flex',
        gap: 'var(--space-2)',
        flexWrap: 'wrap',
        marginBottom: 'var(--space-4)',
      }}
    >
      <AssignSelfButton requestId={requestId} groupSlug={groupSlug} assigned={assigned} />
      <FollowSelfButton requestId={requestId} groupSlug={groupSlug} following={following} />
    </div>
  );
}
