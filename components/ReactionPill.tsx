'use client';

/**
 * @build-unit BU-reactions
 * @spec architecture/decision-log.md (D050)
 * @spec product/scenarios.md (SCN-3)
 * @spec product/design-philosophy.md
 *
 * Quiet reactions pill on a post card. Shows aggregate counts
 * (top emoji + total) when reactions exist; "React" affordance
 * otherwise. Tap to open the 8-emoji tray. Multi-select per user
 * per post; toggling an already-picked emoji removes it.
 *
 * Optimistic UI via React 19 useOptimistic. The server action
 * still runs; if it fails, the optimistic state rolls back via
 * a re-derive from props (next render).
 *
 * Per design-philosophy.md principle 3 — no celebration, no
 * streaks, no "+1 reaction" toast. Just acceptance.
 */

import { useOptimistic, useState, useTransition, useRef, useEffect } from 'react';
import type { FC } from 'react';
import type { FeedReaction, FeedReactionEmoji } from '@/components/PostCard';
import { REACTION_GLYPH, ReactionTray } from '@/components/ReactionTray';

interface ReactionPillProps {
  postId: string;
  reactions: FeedReaction[];
  /** Server actions injected from the page (server component). */
  onAdd: (postId: string, emoji: FeedReactionEmoji) => Promise<void>;
  onRemove: (postId: string, emoji: FeedReactionEmoji) => Promise<void>;
  /** When false, the pill renders read-only (no tray, no toggling). */
  canReact: boolean;
}

interface OptimisticAction {
  emoji: FeedReactionEmoji;
  kind: 'add' | 'remove';
}

function applyOptimistic(state: FeedReaction[], action: OptimisticAction): FeedReaction[] {
  const existing = state.find((r) => r.emoji === action.emoji);
  if (action.kind === 'add') {
    if (existing) {
      if (existing.mine) return state; // already had it — no-op
      return state.map((r) =>
        r.emoji === action.emoji ? { ...r, count: r.count + 1, mine: true } : r,
      );
    }
    return [...state, { emoji: action.emoji, count: 1, mine: true }];
  }
  // remove
  if (!existing || !existing.mine) return state;
  if (existing.count <= 1) {
    return state.filter((r) => r.emoji !== action.emoji);
  }
  return state.map((r) =>
    r.emoji === action.emoji ? { ...r, count: r.count - 1, mine: false } : r,
  );
}

export const ReactionPill: FC<ReactionPillProps> = ({
  postId,
  reactions,
  onAdd,
  onRemove,
  canReact,
}) => {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(reactions, applyOptimistic);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside closes the tray
  useEffect(() => {
    if (!open) return;
    function handler(event: MouseEvent): void {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const myEmoji = new Set(optimistic.filter((r) => r.mine).map((r) => r.emoji));
  const hasAny = optimistic.length > 0;
  const totalCount = optimistic.reduce((sum, r) => sum + r.count, 0);
  const top3 = optimistic.slice(0, 3);

  function toggle(emoji: FeedReactionEmoji): void {
    const isOn = myEmoji.has(emoji);
    startTransition(async () => {
      setOptimistic({ emoji, kind: isOn ? 'remove' : 'add' });
      try {
        if (isOn) {
          await onRemove(postId, emoji);
        } else {
          await onAdd(postId, emoji);
        }
      } catch {
        // Optimistic state rolls back on next render via prop sync.
      }
    });
  }

  return (
    <div
      ref={containerRef}
      data-testid="reaction-pill-container"
      data-post-id={postId}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        marginTop: 'var(--space-3)',
      }}
    >
      <button
        type="button"
        onClick={() => canReact && setOpen((v) => !v)}
        disabled={!canReact}
        aria-expanded={open}
        aria-label={hasAny ? `${totalCount} reactions, tap to react` : 'React to this post'}
        data-testid="reaction-pill-toggle"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          padding: 'var(--space-1) var(--space-3)',
          background: 'var(--colour-surface-raised)',
          border: '1px solid var(--colour-border-subtle)',
          borderRadius: 'var(--radius-pill)',
          cursor: canReact ? 'pointer' : 'default',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-sm)',
          color: 'var(--colour-text-secondary)',
          opacity: canReact ? 1 : 0.7,
        }}
      >
        {hasAny ? (
          <>
            {top3.map((r) => (
              <span
                key={r.emoji}
                aria-hidden="true"
                data-testid="reaction-pill-emoji"
                data-emoji={r.emoji}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-0)',
                  padding: r.mine ? '0 var(--space-1)' : '0',
                  borderRadius: 'var(--radius-sm)',
                  background: r.mine ? 'var(--colour-surface-selected)' : 'transparent',
                  border: r.mine ? '1px solid var(--colour-text-link)' : '1px solid transparent',
                }}
              >
                <span>{REACTION_GLYPH[r.emoji]}</span>
                <span style={{ fontSize: 'var(--text-xs)', marginLeft: 2 }}>{r.count}</span>
              </span>
            ))}
            {totalCount > top3.reduce((s, r) => s + r.count, 0) && (
              <span style={{ fontSize: 'var(--text-xs)' }}>· {totalCount}</span>
            )}
          </>
        ) : (
          <span>React</span>
        )}
      </button>

      {open && canReact && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 10,
            marginTop: 'var(--space-1)',
          }}
        >
          <ReactionTray selected={myEmoji} onToggle={toggle} />
        </div>
      )}
    </div>
  );
};
