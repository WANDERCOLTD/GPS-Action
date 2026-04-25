'use client';

/**
 * @build-unit BU-feed
 * @spec product/design-philosophy.md
 *
 * Feed list with cursor-based "Load more" pagination.
 * Client component — manages the append-only post list state.
 *
 * The loadMore callback is a server action passed from the page;
 * this component doesn't import from /app (boundary-safe).
 */

import { useState } from 'react';
import type { FeedPost, FeedCursor, FeedReactionEmoji } from '@/components/PostCard';
import { PostCard } from '@/components/PostCard';

export interface LoadMoreResult {
  posts: FeedPost[];
  nextCursor: FeedCursor | null;
}

interface FeedListProps {
  initialPosts: FeedPost[];
  initialCursor: FeedCursor | null;
  loadMore: (cursor: FeedCursor) => Promise<LoadMoreResult>;
  onAddReaction: (postId: string, emoji: FeedReactionEmoji) => Promise<void>;
  onRemoveReaction: (postId: string, emoji: FeedReactionEmoji) => Promise<void>;
  canReact: boolean;
  reactionsEnabled: boolean;
}

export function FeedList({
  initialPosts,
  initialCursor,
  loadMore,
  onAddReaction,
  onRemoveReaction,
  canReact,
  reactionsEnabled,
}: FeedListProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  async function handleLoadMore(): Promise<void> {
    if (!cursor) return;
    setLoading(true);
    try {
      const result = await loadMore(cursor);
      setPosts((prev) => [...prev, ...result.posts]);
      setCursor(result.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  if (posts.length === 0) {
    return (
      <p
        style={{
          color: 'var(--colour-text-secondary)',
          textAlign: 'center',
          padding: 'var(--space-8) 0',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-base)',
        }}
      >
        Nothing here yet.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onAddReaction={onAddReaction}
          onRemoveReaction={onRemoveReaction}
          canReact={canReact}
          reactionsEnabled={reactionsEnabled}
        />
      ))}
      {cursor && (
        <button
          className="gps-btn gps-btn--secondary"
          onClick={handleLoadMore}
          disabled={loading}
          data-testid="feed-loadmore-button"
          style={{ alignSelf: 'center', marginTop: 'var(--space-2)' }}
        >
          {loading ? 'Loading\u2026' : 'Load more'}
        </button>
      )}
    </div>
  );
}
