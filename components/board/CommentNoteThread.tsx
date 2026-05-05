'use client';

/**
 * @build-unit bu-coordination-board (atom 5d-4)
 * @spec docs/build/session-handoffs/parallel-stream-b-comment-thread-2026-05-05.md
 * @adr 0007
 *
 * Interleaved Comment + Note + System-event thread for the kanban
 * ticket-detail surface. Three row branches:
 *
 *   - source === 'system' → smaller, italic, no avatar, prefix Info
 *     glyph. (System-event hook lands in atom 5d-3.)
 *   - kind === 'note'      → yellow-tint background (warning-subtle),
 *     small "Note" label. Originating-team only.
 *   - kind === 'comment'   → standard avatar + name + body.
 *
 * Compose box at the bottom switches between Comment / Note tabs.
 * Note tab is hidden when `canPostNote` is false (cross-team viewer).
 * Submit returns `{ ok, error? }`; the inline error renders on failure.
 */

import { useState, useTransition } from 'react';
import { Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  postCommentAction,
  postNoteAction,
  type BoardActionResult,
} from '@/app/board/[groupSlug]/[ticketId]/actions';

const COMMENT_BODY_MAX = 5000;

export interface CommentNoteThreadAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CommentNoteThreadRow {
  id: string;
  body: string;
  kind: 'comment' | 'note';
  source: 'human' | 'system';
  createdAt: Date;
  author: CommentNoteThreadAuthor;
}

export interface CommentNoteThreadProps {
  rows: CommentNoteThreadRow[];
  requestId: string;
  groupSlug: string;
  /** When false, the Note tab is hidden — viewer is on a shared team. */
  canPostNote: boolean;
}

type ComposeMode = 'comment' | 'note';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

export function CommentNoteThread({
  rows,
  requestId,
  groupSlug,
  canPostNote,
}: CommentNoteThreadProps) {
  const [mode, setMode] = useState<ComposeMode>('comment');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setError('Write something first.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const action = mode === 'note' ? postNoteAction : postCommentAction;
      const result: BoardActionResult = await action({
        requestId,
        groupSlug,
        body: trimmed,
      });
      if (result.ok) {
        setDraft('');
      } else {
        setError(result.error ?? 'Could not post — try again.');
      }
    });
  }

  return (
    <section
      data-testid="board-ticket-thread"
      aria-label="Discussion"
      style={{ marginBottom: 'var(--space-4)' }}
    >
      <h2
        style={{
          margin: '0 0 var(--space-2) 0',
          fontSize: 'var(--text-xs)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--colour-text-secondary)',
        }}
      >
        Discussion
      </h2>

      {rows.length === 0 ? (
        <p
          data-testid="board-ticket-thread-empty"
          style={{
            margin: '0 0 var(--space-3) 0',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-secondary)',
            fontStyle: 'italic',
          }}
        >
          No comments yet.
        </p>
      ) : (
        <ol
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 0 var(--space-3) 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          {rows.map((row) => renderRow(row))}
        </ol>
      )}

      <div
        data-testid="board-ticket-thread-compose"
        data-mode={mode}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          padding: 'var(--space-3)',
          border: '1px solid var(--colour-border-subtle)',
          borderRadius: 'var(--radius-md)',
          background:
            mode === 'note' ? 'var(--colour-warning-subtle)' : 'var(--colour-surface-sunken)',
        }}
      >
        {canPostNote && (
          <div
            role="tablist"
            aria-label="Compose mode"
            style={{ display: 'flex', gap: 'var(--space-1)' }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'comment'}
              data-testid="board-ticket-thread-tab-comment"
              onClick={() => setMode('comment')}
              disabled={isPending}
              className={`gps-btn gps-btn--sm ${
                mode === 'comment' ? 'gps-btn--primary' : 'gps-btn--ghost'
              }`}
            >
              Comment
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'note'}
              data-testid="board-ticket-thread-tab-note"
              onClick={() => setMode('note')}
              disabled={isPending}
              className={`gps-btn gps-btn--sm ${
                mode === 'note' ? 'gps-btn--primary' : 'gps-btn--ghost'
              }`}
            >
              Note
            </button>
          </div>
        )}

        <textarea
          data-testid="board-ticket-thread-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={COMMENT_BODY_MAX}
          rows={3}
          disabled={isPending}
          placeholder={
            mode === 'note'
              ? 'Write a note for your team only…'
              : 'Add a comment for everyone on this ticket…'
          }
          className="gps-input"
          style={{
            fontSize: 'var(--text-sm)',
            width: '100%',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <button
            type="button"
            data-testid="board-ticket-thread-submit-btn"
            onClick={submit}
            disabled={isPending}
            className="gps-btn gps-btn--primary gps-btn--sm"
          >
            {isPending ? 'Posting…' : mode === 'note' ? 'Post note' : 'Post comment'}
          </button>
          {error && (
            <span
              role="alert"
              data-testid="board-ticket-thread-error"
              style={{ color: 'var(--colour-danger)', fontSize: 'var(--text-xs)' }}
            >
              {error}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function renderRow(row: CommentNoteThreadRow) {
  if (row.source === 'system') {
    return (
      <li
        key={row.id}
        data-testid="board-ticket-thread-row"
        data-kind="system"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-1) var(--space-2)',
          fontSize: 'var(--text-xs)',
          fontStyle: 'italic',
          color: 'var(--colour-text-secondary)',
        }}
      >
        <Info size={14} aria-hidden="true" />
        <span style={{ whiteSpace: 'pre-wrap' }}>{row.body}</span>
        <time
          dateTime={row.createdAt.toISOString()}
          style={{ marginLeft: 'auto', fontStyle: 'normal' }}
        >
          {formatDistanceToNow(row.createdAt, { addSuffix: true })}
        </time>
      </li>
    );
  }

  const isNote = row.kind === 'note';
  return (
    <li
      key={row.id}
      data-testid="board-ticket-thread-row"
      data-kind={row.kind}
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-3)',
        background: isNote ? 'var(--colour-warning-subtle)' : 'var(--colour-surface-sunken)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <span
        title={row.author.displayName}
        aria-hidden="true"
        style={{
          flex: '0 0 auto',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: row.author.avatarUrl
            ? `center / cover no-repeat url(${row.author.avatarUrl})`
            : 'var(--colour-surface-raised)',
          color: 'var(--colour-text-secondary)',
          fontSize: 11,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--colour-border-subtle)',
        }}
      >
        {row.author.avatarUrl ? '' : initials(row.author.displayName)}
      </span>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-1)',
          }}
        >
          <strong style={{ fontSize: 'var(--text-sm)' }}>{row.author.displayName}</strong>
          {isNote && (
            <span
              data-testid="board-ticket-thread-note-label"
              style={{
                fontSize: 'var(--text-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--colour-warning)',
                fontWeight: 600,
              }}
            >
              Note
            </span>
          )}
          <time
            dateTime={row.createdAt.toISOString()}
            style={{ fontSize: 'var(--text-xs)', color: 'var(--colour-text-secondary)' }}
          >
            {formatDistanceToNow(row.createdAt, { addSuffix: true })}
          </time>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {row.body}
        </p>
      </div>
    </li>
  );
}
