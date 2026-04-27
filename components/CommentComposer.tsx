'use client';

/**
 * @build-unit BU-comments
 * @spec architecture/decision-log.md (D052)
 * @spec product/scenarios.md (SCN-20)
 * @spec product/design-philosophy.md
 *
 * In-line comment composer at the bottom of a thread.
 * Single-line tap-to-expand. Optimistic insert via useOptimistic
 * with the committed-state pattern from PR #47 (so the new comment
 * survives the transition completing).
 *
 * Body capped at 5000 chars per D052; soft hint at 4000.
 */

import { useState, useTransition } from 'react';
import type { FC, FormEvent } from 'react';
import type { CommentForView } from '@/components/CommentItem';

const SOFT_HINT = 4000;
const HARD_CAP = 5000;

interface CommentComposerProps {
  postId: string;
  onSubmit: (postId: string, body: string) => Promise<{ id: string }>;
  /** Called with a temporary optimistic comment so the parent list can render it. */
  onOptimisticInsert: (optimistic: CommentForView) => void;
  /**
   * Called when the server returns. We pass back the same optimistic
   * placeholder we inserted, so the parent doesn't need to look it up
   * by id across re-renders (closure / StrictMode hazards).
   */
  onCommit: (optimistic: CommentForView, realId: string) => void;
  /** Called when the server fails; lets the parent roll back. */
  onRollback: (optimisticId: string) => void;
}

export const CommentComposer: FC<CommentComposerProps> = ({
  postId,
  onSubmit,
  onOptimisticInsert,
  onCommit,
  onRollback,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= HARD_CAP && !isPending;
  const showSoftHint = body.length >= SOFT_HINT && body.length < HARD_CAP;
  const overCap = body.length > HARD_CAP;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) return;

    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticComment: CommentForView = {
      id: optimisticId,
      body: trimmed,
      createdAt: new Date().toISOString(),
      author: {
        id: 'optimistic-self',
        displayName: 'You',
        roles: [],
        isNewMember: false,
      },
      reactions: [],
    };
    onOptimisticInsert(optimisticComment);
    setBody('');
    setExpanded(false);
    setError(null);

    startTransition(async () => {
      try {
        const result = await onSubmit(postId, trimmed);
        onCommit(optimisticComment, result.id);
      } catch (err: unknown) {
        onRollback(optimisticId);
        setError(err instanceof Error ? err.message : 'Could not post comment.');
      }
    });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        data-testid="comment-composer-expand"
        style={{
          width: '100%',
          padding: 'var(--space-3)',
          marginTop: 'var(--space-4)',
          background: 'var(--colour-surface-raised)',
          border: '1px solid var(--colour-border-subtle)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'left',
          color: 'var(--colour-text-secondary)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-sm)',
          cursor: 'pointer',
        }}
      >
        Add a comment…
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="comment-composer-form"
      style={{
        marginTop: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share a reply…"
        data-testid="comment-composer-input"
        rows={4}
        className="gps-input"
        style={{
          width: '100%',
          resize: 'vertical',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-sm)',
          padding: 'var(--space-3)',
          borderColor: overCap ? 'var(--colour-danger)' : undefined,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: 'var(--text-xs)',
          color: 'var(--colour-text-tertiary)',
        }}
      >
        {showSoftHint && <span>{HARD_CAP - body.length} characters left</span>}
        {overCap && (
          <span style={{ color: 'var(--colour-danger)' }} role="alert">
            Too long — trim by {body.length - HARD_CAP} characters
          </span>
        )}
        {error && (
          <span style={{ color: 'var(--colour-danger)' }} role="alert">
            {error}
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
          <button
            type="button"
            onClick={() => {
              setBody('');
              setExpanded(false);
              setError(null);
            }}
            disabled={isPending}
            data-testid="comment-composer-cancel"
            className="gps-btn gps-btn--secondary gps-btn--sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            data-testid="comment-composer-submit"
            className="gps-btn gps-btn--primary gps-btn--sm"
          >
            {isPending ? 'Posting…' : 'Post'}
          </button>
        </span>
      </div>
    </form>
  );
};
