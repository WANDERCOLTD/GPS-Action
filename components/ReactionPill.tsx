'use client';

/**
 * @build-unit BU-reactions BU-feed-card-affordances
 * @spec architecture/decision-log.md (D050, D052)
 * @spec product/scenarios.md (SCN-3, SCN-20)
 * @spec product/design-philosophy.md
 *
 * Quiet reactions pill — target-agnostic. Renders on posts and
 * comments. The caller wraps the targetId in the onAdd/onRemove
 * callbacks; this component just calls (emoji) => Promise<void>.
 *
 * Optimistic UI via React 19 useOptimistic with the committed-
 * state pattern from PR #47. Per design-philosophy.md principle 3
 * — no celebration, no streaks, no "+1 reaction" toast.
 *
 * Built on `@radix-ui/react-popover` for the tray. Radix gives us
 * positioning across viewport widths (Floating UI under the hood,
 * with built-in collision detection), focus trap, ESC-to-close, and
 * ARIA semantics for free.
 */

import { useOptimistic, useState, useTransition } from 'react';
import type { CSSProperties, FC } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { FeedReaction, FeedReactionEmoji } from '@/components/PostCard';
import { REACTION_GLYPH, ReactionTray } from '@/components/ReactionTray';

interface ReactionPillProps {
  reactions: FeedReaction[];
  /** Caller wraps the targetId — pill just calls these with the emoji. */
  onAdd: (emoji: FeedReactionEmoji) => Promise<void>;
  onRemove: (emoji: FeedReactionEmoji) => Promise<void>;
  /** When false, the pill renders read-only (no tray, no toggling). */
  canReact: boolean;
  /** Optional — for testid disambiguation when many pills render side-by-side. */
  testIdSuffix?: string;
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

export const ReactionPill: FC<ReactionPillProps> = ({ reactions, onAdd, onRemove, canReact }) => {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  // Local state — committed truth for this client. Initialised from
  // server-rendered props; updated on successful mutation. Prop drift
  // (e.g. after refresh) re-mounts the component and resets state.
  const [committed, setCommitted] = useState<FeedReaction[]>(reactions);
  const [optimistic, setOptimistic] = useOptimistic(committed, applyOptimistic);

  const myEmoji = new Set(optimistic.filter((r) => r.mine).map((r) => r.emoji));
  const hasAny = optimistic.length > 0;
  const totalCount = optimistic.reduce((sum, r) => sum + r.count, 0);
  const top3 = optimistic.slice(0, 3);

  function toggle(emoji: FeedReactionEmoji): void {
    const isOn = myEmoji.has(emoji);
    const action: OptimisticAction = { emoji, kind: isOn ? 'remove' : 'add' };
    startTransition(async () => {
      setOptimistic(action);
      try {
        if (isOn) {
          await onRemove(emoji);
        } else {
          await onAdd(emoji);
        }
        setCommitted((prev) => applyOptimistic(prev, action));
      } catch {
        // Failure: optimistic rolls back to `committed`.
      }
    });
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div
        data-testid="reaction-pill-container"
        style={{ display: 'inline-flex', alignItems: 'center' }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={!canReact}
            aria-label={hasAny ? `${totalCount} reactions, add a reaction` : 'Add a reaction'}
            title={hasAny ? `${totalCount} reactions — add yours` : 'Add a reaction'}
            data-testid="reaction-pill-toggle"
            style={triggerStyle(canReact)}
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
                      border: r.mine
                        ? '1px solid var(--colour-text-link)'
                        : '1px solid transparent',
                    }}
                  >
                    <span>{REACTION_GLYPH[r.emoji]}</span>
                    <span style={{ fontSize: 'var(--text-xs)', marginLeft: 2 }}>{r.count}</span>
                  </span>
                ))}
                {totalCount > top3.reduce((s, r) => s + r.count, 0) && (
                  <span style={{ fontSize: 'var(--text-xs)' }}>· {totalCount}</span>
                )}
                <span
                  aria-hidden="true"
                  data-testid="reaction-pill-add"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    marginLeft: 'var(--space-1)',
                    paddingLeft: 'var(--space-1)',
                    borderLeft: '1px solid var(--colour-border-subtle)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--colour-text-tertiary)',
                  }}
                >
                  <span>🙂</span>
                  <span style={{ marginLeft: 1 }}>+</span>
                </span>
              </>
            ) : (
              <span
                data-testid="reaction-pill-add"
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <span>🙂</span>
                <span style={{ marginLeft: 1 }}>+</span>
              </span>
            )}
          </button>
        </Popover.Trigger>
      </div>
      {canReact && (
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="end"
            sideOffset={6}
            collisionPadding={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
            style={{ zIndex: 220 }}
          >
            <ReactionTray selected={myEmoji} onToggle={toggle} />
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
};

function triggerStyle(canReact: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    padding: 'var(--space-1) var(--space-2)',
    background: 'transparent',
    border: 0,
    borderRadius: 'var(--radius-pill)',
    cursor: canReact ? 'pointer' : 'default',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--text-sm)',
    color: 'var(--colour-text-secondary)',
    opacity: canReact ? 1 : 0.7,
  };
}
