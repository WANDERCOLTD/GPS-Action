'use client';

/**
 * @build-unit BU-requests-urgent
 * @spec architecture/decision-log.md (D058, D061)
 *
 * Claim button and resolve form for a single Request row. Client
 * component because it manages local form state for the resolve note
 * + transition state during the server action.
 *
 * Per D061: each is an explicit interactive element with a known action.
 */

import { useState, useTransition, type FormEvent } from 'react';
import {
  claimRequestAction,
  resolveRequestAction,
  type ActionResult,
} from '@/app/requests/actions';

interface ClaimButtonProps {
  requestId: string;
}

export function ClaimButton({ requestId }: ClaimButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await claimRequestAction(requestId);
      if (!result.ok) setError(result.error ?? 'Could not claim.');
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        data-testid="requests-claim-button"
        data-request-id={requestId}
        className="gps-btn gps-btn--primary gps-btn--sm"
      >
        {isPending ? 'Claiming…' : 'Claim'}
      </button>
      {error && (
        <span
          role="alert"
          data-testid="requests-claim-error"
          style={{ color: 'var(--colour-danger)', fontSize: 'var(--text-xs)' }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

interface ResolveFormProps {
  requestId: string;
}

export function ResolveForm({ requestId }: ResolveFormProps) {
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await resolveRequestAction({ requestId, notes });
      if (!result.ok) setError(result.error ?? 'Could not resolve.');
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="requests-resolve-form"
      data-request-id={requestId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        marginTop: 'var(--space-2)',
      }}
    >
      <input
        type="text"
        name="notes"
        placeholder="Outcome — one line (optional)"
        maxLength={1000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        data-testid="requests-resolve-notes-input"
        className="gps-input"
        style={{ width: '100%' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <button
          type="submit"
          disabled={isPending}
          data-testid="requests-resolve-submit"
          className="gps-btn gps-btn--primary gps-btn--sm"
          style={{ background: 'var(--colour-success)' }}
        >
          {isPending ? 'Resolving…' : 'Mark resolved'}
        </button>
        {error && (
          <span
            role="alert"
            data-testid="requests-resolve-error"
            style={{ color: 'var(--colour-danger)', fontSize: 'var(--text-xs)' }}
          >
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
