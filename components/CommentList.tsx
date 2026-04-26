'use client';

/**
 * @build-unit BU-comments
 * @spec architecture/decision-log.md (D052)
 * @spec product/scenarios.md (SCN-20)
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
 */

import { useState } from 'react';
import type { FC } from 'react';
import { CommentItem, type CommentForView } from '@/components/CommentItem';
import { CommentComposer } from '@/components/CommentComposer';
import type { FeedReactionEmoji } from '@/components/PostCard';

type Filter = 'discussion' | 'activity' | 'all';

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

  function handleCommit(optimisticId: string, realId: string): void {
    setOptimistic((prev) => prev.filter((c) => c.id !== optimisticId));
    setCommitted((prev) => {
      const placeholder = optimistic.find((c) => c.id === optimisticId);
      if (!placeholder) return prev;
      return [...prev, { ...placeholder, id: realId }];
    });
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
        {(['discussion', 'activity', 'all'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={filter === tab}
            onClick={() => setFilter(tab)}
            data-testid="comment-filter-tab"
            data-filter-name={tab}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              background: 'transparent',
              border: 'none',
              borderBottom:
                filter === tab ? '2px solid var(--colour-text-link)' : '2px solid transparent',
              color: filter === tab ? 'var(--colour-text-primary)' : 'var(--colour-text-secondary)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Thread body */}
      {visibleComments.length === 0 && filter === 'discussion' && (
        <p
          data-testid="comment-thread-empty"
          style={{
            color: 'var(--colour-text-secondary)',
            fontSize: 'var(--text-sm)',
            padding: 'var(--space-4) 0',
            textAlign: 'center',
          }}
        >
          No replies yet. Add the first.
        </p>
      )}

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
              reactionsEnabled={reactionsEnabled}
              canReact={canReact}
              onAddReaction={onAddReactionToComment}
              onRemoveReaction={onRemoveReactionFromComment}
            />
          ))}
        </div>
      )}

      {/* Composer at the bottom */}
      {canComment && (
        <CommentComposer
          postId={postId}
          onSubmit={onAddComment}
          onOptimisticInsert={handleOptimisticInsert}
          onCommit={handleCommit}
          onRollback={handleRollback}
        />
      )}
    </div>
  );
};

export type { CommentForView };
