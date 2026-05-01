'use client';

/**
 * @build-unit BU-comments BU-icon-strips
 * @spec architecture/decision-log.md (D052)
 * @spec product/scenarios.md (SCN-20)
 * @spec docs/build/session-briefs/bu-icon-strips.md
 * @spec docs/product/design-philosophy.md (Glyph register)
 *
 * Discussion thread on a post detail page. Filter tabs (Discussion
 * default, Activity, All — the latter two empty in MVP until system
 * comments ship). Renders the list. Renders the composer at the
 * bottom when canComment.
 *
 * Optimistic insert via local state with the committed-state pattern
 * from PR #47: optimistic comments live in `optimistic`, server-
 * confirmed comments live in `committed`. On success the optimistic
 * row is replaced by the real one (id swap); on failure it's removed.
 *
 * BU-icon-strips: filter tabs render lucide icons (Discussion =
 * `MessageSquare`, re-using the PostCard "Comment count" glyph;
 * Activity = `Activity`) within the existing underline-tab geometry.
 * "All" stays as text — same outlier rule as Feed/All. Each tab is
 * wrapped in IconChipTooltip so the human-readable name is revealed
 * on hover (300ms) / long-press (600ms).
 */

import { useState } from 'react';
import type { FC, ReactNode } from 'react';
import { Activity, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CommentItem, type CommentForView } from '@/components/CommentItem';
import { CommentComposer } from '@/components/CommentComposer';
import { IconChipTooltip } from '@/components/IconChipTooltip';
import type { FeedReactionEmoji } from '@/components/PostCard';

type Filter = 'discussion' | 'activity' | 'all';

const TAB_ICONS: Partial<Record<Filter, LucideIcon>> = {
  discussion: MessageSquare,
  activity: Activity,
};

const TAB_LABELS: Record<Filter, string> = {
  discussion: 'Discussion',
  activity: 'Activity',
  all: 'All',
};

const TAB_ICON_SIZE = 16;
const TAB_ICON_STROKE = 2;

function renderTabContent(filter: Filter, label: string): ReactNode {
  const Icon = TAB_ICONS[filter];
  if (Icon) {
    return <Icon size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden="true" />;
  }
  return label;
}

interface CommentListProps {
  postId: string;
  initialComments: CommentForView[];
  canComment: boolean;
  onAddComment: (postId: string, body: string) => Promise<{ id: string }>;
  reactionsEnabled: boolean;
  canReact: boolean;
  onAddReactionToComment: (commentId: string, emoji: FeedReactionEmoji) => Promise<void>;
  onRemoveReactionFromComment: (commentId: string, emoji: FeedReactionEmoji) => Promise<void>;
}

export const CommentList: FC<CommentListProps> = ({
  postId,
  initialComments,
  canComment,
  onAddComment,
  reactionsEnabled,
  canReact,
  onAddReactionToComment,
  onRemoveReactionFromComment,
}) => {
  const [committed, setCommitted] = useState<CommentForView[]>(initialComments);
  const [optimistic, setOptimistic] = useState<CommentForView[]>([]);
  const [filter, setFilter] = useState<Filter>('discussion');

  const all = [...committed, ...optimistic];

  const visibleComments = filter === 'discussion' || filter === 'all' ? all : [];

  function handleOptimisticInsert(comment: CommentForView): void {
    setOptimistic((prev) => [...prev, comment]);
  }

  function handleCommit(optimistic: CommentForView, realId: string): void {
    // The composer hands the placeholder back to us so neither setter
    // has to reach across renders. Avoids two traps that previous
    // versions hit:
    //   1) closure: handleCommit runs after an `await`, so any reference
    //      to the `optimistic` state variable was stale.
    //   2) StrictMode: calling setCommitted from inside the setOptimistic
    //      updater is a side effect, and StrictMode double-invokes
    //      updaters in dev — committing the row twice and producing
    //      duplicate React keys.
    // Both setters are now plain updaters with no cross-talk.
    setOptimistic((prev) => prev.filter((c) => c.id !== optimistic.id));
    setCommitted((prev) => [...prev, { ...optimistic, id: realId }]);
  }

  function handleRollback(optimisticId: string): void {
    setOptimistic((prev) => prev.filter((c) => c.id !== optimisticId));
  }

  return (
    <div data-testid="comment-thread-container">
      {/* Filter tabs (per SCN-20) */}
      <div
        role="tablist"
        aria-label="Filter comments"
        data-testid="comment-filter-tabs"
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
          borderBottom: '1px solid var(--colour-border-subtle)',
        }}
      >
        {(['discussion', 'activity', 'all'] as const).map((tab) => {
          const label = TAB_LABELS[tab];
          return (
            <IconChipTooltip key={tab} label={label}>
              <button
                type="button"
                role="tab"
                aria-selected={filter === tab}
                aria-label={label}
                onClick={() => setFilter(tab)}
                data-testid="comment-filter-tab"
                data-filter-name={tab}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom:
                    filter === tab ? '2px solid var(--colour-text-link)' : '2px solid transparent',
                  color:
                    filter === tab ? 'var(--colour-text-primary)' : 'var(--colour-text-secondary)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {renderTabContent(tab, label)}
              </button>
            </IconChipTooltip>
          );
        })}
      </div>

      {/* Thread body — BU-one-click-polish removed the "No replies yet"
          paragraph for the discussion filter. The composer's inline-empty
          mode (rendered below) is the empty state now. The activity
          filter keeps its empty-state copy because there is no parallel
          inline affordance for system events. */}

      {visibleComments.length === 0 && filter === 'activity' && (
        <p
          data-testid="comment-activity-empty"
          style={{
            color: 'var(--colour-text-secondary)',
            fontSize: 'var(--text-sm)',
            padding: 'var(--space-4) 0',
            textAlign: 'center',
          }}
        >
          No system events on this post yet.
        </p>
      )}

      {visibleComments.length > 0 && (
        <div data-testid="comment-thread-list">
          {visibleComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              reactionsEnabled={reactionsEnabled}
              canReact={canReact}
              onAddReaction={onAddReactionToComment}
              onRemoveReaction={onRemoveReactionFromComment}
            />
          ))}
        </div>
      )}

      {/* Composer at the bottom. BU-one-click-polish — when there are no
          comments yet, render the composer in inline-empty mode so the
          input is always present and tap-to-focus opens the keyboard
          without an intermediate "Add a comment…" button. */}
      {canComment && (
        <CommentComposer
          postId={postId}
          onSubmit={onAddComment}
          onOptimisticInsert={handleOptimisticInsert}
          onCommit={handleCommit}
          onRollback={handleRollback}
          inlineEmptyState={all.length === 0}
        />
      )}
    </div>
  );
};

export type { CommentForView };
