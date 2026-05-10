'use client';

/**
 * @build-unit bu-ticket-view-fixes (Sub-build C — Items 8, 9, 10, 11, 12)
 * @spec docs/build/session-briefs/bu-ticket-view-fixes.md
 * @adr 0016
 *
 * Discussion area on the kanban ticket-detail surface. Replaces the
 * stacked `CommentNoteThread` from BU-coordination-board with:
 *
 *   - Comments / Log tabs at the top (Item 8). Active tab is mirrored
 *     into `?tab=comments|log` so deep links work.
 *   - Compose-at-top, collapsed by default (Item 11). Single button
 *     "Add a comment or note" expands to the full editor. Cancel
 *     collapses back.
 *   - Compose mode picker styled as tabs (Item 9), reusing the same
 *     `TabStrip` primitive as Item 8.
 *   - Author-only edit + hard-delete on own human comments (Item 10
 *     + ADR-0016 / D082). Edited rows render an "(edited)" marker
 *     derived from `updatedAt > createdAt + 1s`.
 *   - Newest-first ordering on the Comments tab (Item 12). The Log
 *     tab keeps its newest-first ordering for symmetry.
 *
 * Permission gates on edit / delete are server-side (router + service);
 * the UI gate just hides the affordance for non-authors / system rows.
 */

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Info, Pencil, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  postCommentAction,
  postNoteAction,
  editCommentAction,
  deleteCommentAction,
  type BoardActionResult,
} from '@/app/board/[groupSlug]/[ticketId]/actions';
import { TabStrip } from '@/components/board/TabStrip';

const COMMENT_BODY_MAX = 5000;
/** Tolerance for the auto `updatedAt` bump on row creation. */
const EDITED_MARKER_EPSILON_MS = 1000;

export interface DiscussionAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface DiscussionRow {
  id: string;
  body: string;
  kind: 'comment' | 'note';
  source: 'human' | 'system';
  createdAt: Date;
  updatedAt: Date;
  author: DiscussionAuthor;
}

export interface DiscussionProps {
  rows: DiscussionRow[];
  requestId: string;
  groupSlug: string;
  /** Viewer's userId — drives edit/delete affordance visibility. */
  viewerId: string;
  /** When false, the Note tab is hidden — viewer is on a shared team. */
  canPostNote: boolean;
}

type DiscussionTab = 'comments' | 'log';
type ComposeMode = 'comment' | 'note';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

function isEdited(row: DiscussionRow): boolean {
  return row.updatedAt.getTime() - row.createdAt.getTime() > EDITED_MARKER_EPSILON_MS;
}

export function Discussion({ rows, requestId, groupSlug, viewerId, canPostNote }: DiscussionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabFromUrl = searchParams.get('tab');
  const initialTab: DiscussionTab = tabFromUrl === 'log' ? 'log' : 'comments';
  const [tab, setTab] = useState<DiscussionTab>(initialTab);

  // Keep state in sync if the URL search-param changes externally
  // (e.g. browser back / a deep link click).
  useEffect(() => {
    const next = searchParams.get('tab') === 'log' ? 'log' : 'comments';
    setTab(next);
  }, [searchParams]);

  function changeTab(next: DiscussionTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'comments') {
      params.delete('tab');
    } else {
      params.set('tab', next);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  const commentsRows = useMemo(
    () =>
      [...rows]
        .filter((r) => r.source === 'human')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [rows],
  );
  const logRows = useMemo(
    () =>
      [...rows]
        .filter((r) => r.source === 'system')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [rows],
  );

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

      <TabStrip<DiscussionTab>
        ariaLabel="Discussion view"
        tabListTestId="board-discussion-tablist"
        active={tab}
        onChange={changeTab}
        options={[
          {
            value: 'comments',
            label: 'Comments',
            count: commentsRows.length,
            testId: 'board-discussion-tab-comments',
            countTestId: 'board-discussion-tab-comments-count',
          },
          {
            value: 'log',
            label: 'Log',
            count: logRows.length,
            testId: 'board-discussion-tab-log',
            countTestId: 'board-discussion-tab-log-count',
          },
        ]}
      />

      <div style={{ marginTop: 'var(--space-3)' }}>
        {tab === 'comments' ? (
          <CommentsTab
            rows={commentsRows}
            requestId={requestId}
            groupSlug={groupSlug}
            viewerId={viewerId}
            canPostNote={canPostNote}
          />
        ) : (
          <LogTab rows={logRows} />
        )}
      </div>
    </section>
  );
}

interface CommentsTabProps {
  rows: DiscussionRow[];
  requestId: string;
  groupSlug: string;
  viewerId: string;
  canPostNote: boolean;
}

function CommentsTab({ rows, requestId, groupSlug, viewerId, canPostNote }: CommentsTabProps) {
  return (
    <div
      data-testid="board-discussion-panel-comments"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      <CommentCompose requestId={requestId} groupSlug={groupSlug} canPostNote={canPostNote} />

      {rows.length === 0 ? (
        <p
          data-testid="board-ticket-thread-empty"
          style={{
            margin: 0,
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
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          {rows.map((row) => (
            <CommentItem
              key={row.id}
              row={row}
              requestId={requestId}
              groupSlug={groupSlug}
              viewerId={viewerId}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

interface LogTabProps {
  rows: DiscussionRow[];
}

function LogTab({ rows }: LogTabProps) {
  if (rows.length === 0) {
    return (
      <p
        data-testid="board-discussion-panel-log-empty"
        style={{
          margin: 0,
          fontSize: 'var(--text-sm)',
          color: 'var(--colour-text-secondary)',
          fontStyle: 'italic',
        }}
      >
        No system events yet.
      </p>
    );
  }
  return (
    <ol
      data-testid="board-discussion-panel-log"
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      {rows.map((row) => (
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
      ))}
    </ol>
  );
}

// ── Compose-at-top (Item 11) ────────────────────────────────────────────

interface CommentComposeProps {
  requestId: string;
  groupSlug: string;
  canPostNote: boolean;
}

function CommentCompose({ requestId, groupSlug, canPostNote }: CommentComposeProps) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<ComposeMode>('comment');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function collapse() {
    setExpanded(false);
    setDraft('');
    setError(null);
    setMode('comment');
  }

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
        collapse();
      } else {
        setError(result.error ?? 'Could not post — try again.');
      }
    });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        data-testid="board-ticket-thread-compose-toggle"
        onClick={() => setExpanded(true)}
        className="gps-btn gps-btn--ghost"
        style={{
          width: '100%',
          padding: 'var(--space-3)',
          textAlign: 'left',
          fontSize: 'var(--text-sm)',
          color: 'var(--colour-text-secondary)',
          background: 'var(--colour-surface-sunken)',
          border: '1px solid var(--colour-border-subtle)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
        }}
      >
        Add a comment or note
      </button>
    );
  }

  return (
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
        <TabStrip<ComposeMode>
          ariaLabel="Compose mode"
          tabListTestId="board-ticket-thread-tab-tablist"
          active={mode}
          onChange={setMode}
          disabled={isPending}
          options={[
            {
              value: 'comment',
              label: 'Comment',
              testId: 'board-ticket-thread-tab-comment',
            },
            {
              value: 'note',
              label: 'Note',
              testId: 'board-ticket-thread-tab-note',
            },
          ]}
        />
      )}

      <textarea
        data-testid="board-ticket-thread-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={COMMENT_BODY_MAX}
        rows={3}
        disabled={isPending}
        autoFocus
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
        <button
          type="button"
          data-testid="board-ticket-thread-cancel-btn"
          onClick={collapse}
          disabled={isPending}
          className="gps-btn gps-btn--ghost gps-btn--sm"
        >
          Cancel
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
  );
}

// ── CommentItem with edit / delete affordances (Item 10) ────────────────

interface CommentItemProps {
  row: DiscussionRow;
  requestId: string;
  groupSlug: string;
  viewerId: string;
}

type CommentItemMode = 'idle' | 'editing' | 'confirm-delete';

function CommentItem({ row, requestId, groupSlug, viewerId }: CommentItemProps) {
  const [mode, setMode] = useState<CommentItemMode>('idle');
  const [draft, setDraft] = useState(row.body);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ADR-0016 §5: edit / delete affordance shown only when caller is
  // the human author of a Request comment row. The server-side gate
  // is independent — this is just UI tidying.
  const canMutate = row.author.id === viewerId && row.source === 'human';
  const isNote = row.kind === 'note';
  const edited = isEdited(row);

  function startEdit() {
    setDraft(row.body);
    setError(null);
    setMode('editing');
  }

  function cancel() {
    setDraft(row.body);
    setError(null);
    setMode('idle');
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setError('Write something first.');
      return;
    }
    if (trimmed === row.body) {
      // No-op — exit cleanly without a server roundtrip.
      setMode('idle');
      setError(null);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await editCommentAction({
        requestId,
        groupSlug,
        commentId: row.id,
        body: trimmed,
      });
      if (result.ok) {
        setMode('idle');
      } else {
        setError(result.error ?? 'Could not save — try again.');
      }
    });
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCommentAction({
        requestId,
        groupSlug,
        commentId: row.id,
      });
      if (!result.ok) {
        setError(result.error ?? 'Could not delete — try again.');
        setMode('idle');
      }
      // On success the page revalidates and the row drops from the
      // server-rendered list; nothing else to do here.
    });
  }

  return (
    <li
      data-testid="board-ticket-thread-row"
      data-kind={row.kind}
      data-edited={edited}
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
            flexWrap: 'wrap',
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
          {edited && (
            <span
              data-testid="board-ticket-thread-edited-marker"
              title={`Edited ${formatDistanceToNow(row.updatedAt, { addSuffix: true })}`}
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--colour-text-secondary)',
                fontStyle: 'italic',
              }}
            >
              (edited)
            </span>
          )}
          {canMutate && mode === 'idle' && (
            <span
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                gap: 'var(--space-1)',
              }}
            >
              <button
                type="button"
                data-testid="board-ticket-thread-edit-btn"
                onClick={startEdit}
                aria-label="Edit"
                title="Edit"
                className="gps-btn gps-btn--ghost gps-btn--sm"
                style={{ padding: 'var(--space-1)' }}
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                data-testid="board-ticket-thread-delete-btn"
                onClick={() => setMode('confirm-delete')}
                aria-label="Delete"
                title="Delete"
                className="gps-btn gps-btn--ghost gps-btn--sm"
                style={{ padding: 'var(--space-1)' }}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </span>
          )}
        </div>

        {mode === 'editing' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <textarea
              data-testid="board-ticket-thread-edit-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  save();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancel();
                }
              }}
              maxLength={COMMENT_BODY_MAX}
              rows={3}
              disabled={isPending}
              autoFocus
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
                data-testid="board-ticket-thread-edit-save"
                onClick={save}
                disabled={isPending}
                className="gps-btn gps-btn--primary gps-btn--sm"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                data-testid="board-ticket-thread-edit-cancel"
                onClick={cancel}
                disabled={isPending}
                className="gps-btn gps-btn--ghost gps-btn--sm"
              >
                Cancel
              </button>
              {error && (
                <span
                  role="alert"
                  data-testid="board-ticket-thread-edit-error"
                  style={{ color: 'var(--colour-danger)', fontSize: 'var(--text-xs)' }}
                >
                  {error}
                </span>
              )}
            </div>
          </div>
        ) : (
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
        )}

        {mode === 'confirm-delete' && (
          <div
            data-testid="board-ticket-thread-delete-confirm"
            style={{
              marginTop: 'var(--space-2)',
              padding: 'var(--space-2)',
              border: '1px solid var(--colour-border-subtle)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--colour-surface-raised)',
              fontSize: 'var(--text-xs)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <span>Delete this comment? This can&rsquo;t be undone.</span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                data-testid="board-ticket-thread-delete-cancel"
                onClick={() => setMode('idle')}
                disabled={isPending}
                className="gps-btn gps-btn--ghost gps-btn--sm"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="board-ticket-thread-delete-confirm-btn"
                onClick={confirmDelete}
                disabled={isPending}
                className="gps-btn gps-btn--danger gps-btn--sm"
              >
                {isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
            {error && (
              <span
                role="alert"
                data-testid="board-ticket-thread-delete-error"
                style={{ color: 'var(--colour-danger)' }}
              >
                {error}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
