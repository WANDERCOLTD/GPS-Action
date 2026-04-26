'use client';

/**
 * @build-unit BU-requests-vetting
 * @spec architecture/decision-log.md (D056, D057, D061)
 * @spec product/scenarios.md (SCN-21, SCN-22)
 *
 * Client wrapper for the Request detail panel — comment thread render +
 * comment composer with audience toggle. Per D061: composer's submit
 * button is the only thing that posts; the audience radio is its own
 * tap target; the body textarea is plain.
 */

import { useState, useTransition, type FormEvent } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { CommentAudience } from '@prisma/client';
import { addCommentToRequestAction, type ActionResult } from '@/app/requests/[id]/actions';

export interface DetailComment {
  id: string;
  body: string;
  createdAt: string; // ISO
  authorDisplayName: string;
  authorIsSystem: boolean;
  authorRoles: string[];
  audience: CommentAudience | null;
}

interface RequestDetailPanelProps {
  requestId: string;
  comments: DetailComment[];
  /** Caller's permission to post audience='reviewers' comments. */
  isReviewer: boolean;
}

export function RequestDetailPanel({ requestId, comments, isReviewer }: RequestDetailPanelProps) {
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<CommentAudience>('all');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await addCommentToRequestAction({
        requestId,
        body,
        audience,
      });
      if (!result.ok) {
        setError(result.error ?? 'Could not add comment');
        return;
      }
      setBody('');
    });
  }

  return (
    <div data-testid="requests-detail-panel" data-request-id={requestId}>
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
        data-testid="requests-comment-thread"
      >
        {comments.map((c) => (
          <li
            key={c.id}
            data-testid="requests-comment-row"
            data-comment-id={c.id}
            data-audience={c.audience ?? 'all'}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              background: c.authorIsSystem
                ? 'var(--colour-surface-sunken)'
                : c.audience === 'reviewers'
                  ? 'var(--colour-warning-subtle)'
                  : 'var(--colour-surface-raised)',
              border: '1px solid var(--colour-border-subtle)',
              fontStyle: c.authorIsSystem ? 'italic' : 'normal',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-1)',
                fontSize: 'var(--text-xs)',
                color: 'var(--colour-text-secondary)',
              }}
            >
              <strong style={{ color: 'var(--colour-text-primary)' }}>
                {c.authorIsSystem ? 'system' : c.authorDisplayName}
              </strong>
              {c.audience === 'reviewers' && (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--colour-warning)',
                    color: 'var(--colour-warning-contrast)',
                    fontSize: 'var(--text-2xs)',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  Internal note
                </span>
              )}
              <time dateTime={c.createdAt} style={{ marginLeft: 'auto' }} suppressHydrationWarning>
                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
              </time>
            </div>
            <div style={{ fontSize: 'var(--text-sm)' }}>{c.body}</div>
          </li>
        ))}
      </ol>

      <form
        onSubmit={handleSubmit}
        data-testid="requests-comment-composer"
        data-request-id={requestId}
        style={{
          marginTop: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder={
            isReviewer ? 'Reply to the team — use @name to escalate' : 'Reply to the reviewer team…'
          }
          maxLength={10000}
          required
          data-testid="requests-comment-input"
          className="gps-input"
          style={{ width: '100%', resize: 'vertical' }}
        />
        {isReviewer && (
          <fieldset
            style={{ border: 'none', padding: 0, margin: 0 }}
            data-testid="requests-audience-fieldset"
          >
            <legend
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--colour-text-secondary)',
                marginBottom: 'var(--space-1)',
              }}
            >
              Visible to
            </legend>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <label
                data-testid="requests-audience-all-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="audience"
                  value="all"
                  checked={audience === 'all'}
                  onChange={() => setAudience('all')}
                  data-testid="requests-audience-all-input"
                />
                Submitter + reviewers
              </label>
              <label
                data-testid="requests-audience-reviewers-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="audience"
                  value="reviewers"
                  checked={audience === 'reviewers'}
                  onChange={() => setAudience('reviewers')}
                  data-testid="requests-audience-reviewers-input"
                />
                Reviewers only (internal note)
              </label>
            </div>
          </fieldset>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="submit"
            disabled={isPending || !body.trim()}
            data-testid="requests-comment-submit"
            className="gps-btn gps-btn--primary gps-btn--sm"
          >
            {isPending ? 'Posting…' : 'Post'}
          </button>
          {error && (
            <span
              role="alert"
              data-testid="requests-comment-error"
              style={{ color: 'var(--colour-danger)', fontSize: 'var(--text-xs)' }}
            >
              {error}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
