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
 * Layout (BU-feed-card-affordances): vertical for the feed card's
 * right rail. The 🙂+ "add" button is the anchor — tapping it opens
 * the 8-emoji picker tray. Beneath, top-3 reactions stack one-per-
 * row as small `emoji <count>` quick-toggle buttons; tapping a row
 * toggles the member's reaction for that emoji directly without
 * going through the picker. A `+M` expander appears when more than
 * three emojis have reactions; tapping reveals the rest inline.
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

const TOP_N = 3;

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
  const [trayOpen, setTrayOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();
  // Local state — committed truth for this client. Initialised from
  // server-rendered props; updated on successful mutation. Prop drift
  // (e.g. after refresh) re-mounts the component and resets state.
  const [committed, setCommitted] = useState<FeedReaction[]>(reactions);
  const [optimistic, setOptimistic] = useOptimistic(committed, applyOptimistic);

  function toggle(emoji: FeedReactionEmoji): void {
    const isOn = optimistic.find((r) => r.emoji === emoji)?.mine === true;
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
      } catch (e) {
        // Failure: optimistic rolls back to `committed`. Log so the
        // demo / production console at least surfaces a trail when a
        // tap doesn't stick — silent rollback was previously
        // indistinguishable from "tap didn't register".

        console.error('[ReactionPill] toggle failed', { emoji, kind: action.kind, error: e });
      }
    });
  }

  const hasAny = optimistic.length > 0;
  const visible = expanded ? optimistic : optimistic.slice(0, TOP_N);
  const overflow = Math.max(0, optimistic.length - TOP_N);

  return (
    <Popover.Root open={trayOpen} onOpenChange={setTrayOpen}>
      <div
        data-testid="reaction-pill-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={!canReact}
            aria-label="Add a reaction"
            title="Add a reaction"
            data-testid="reaction-pill-toggle"
            style={triggerStyle(canReact)}
          >
            <span data-testid="reaction-pill-add" aria-hidden="true">
              🙂+
            </span>
          </button>
        </Popover.Trigger>

        {hasAny && (
          <div data-testid="reaction-pill-stack" style={stackStyle}>
            {visible.map((r) => (
              <button
                key={r.emoji}
                type="button"
                disabled={!canReact}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canReact) toggle(r.emoji);
                }}
                aria-label={`${r.count} ${r.emoji} — tap to toggle yours`}
                data-testid="reaction-pill-emoji"
                data-emoji={r.emoji}
                style={emojiRowStyle(r.mine)}
              >
                <span aria-hidden="true">{REACTION_GLYPH[r.emoji]}</span>
                <span style={countTextStyle}>{r.count}</span>
              </button>
            ))}
            {!expanded && overflow > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(true);
                }}
                data-testid="reaction-pill-expand"
                aria-label={`Show ${overflow} more reactions`}
                style={expanderStyle}
              >
                +{overflow}
              </button>
            )}
            {expanded && overflow > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(false);
                }}
                data-testid="reaction-pill-collapse"
                aria-label="Hide extra reactions"
                style={expanderStyle}
              >
                −
              </button>
            )}
          </div>
        )}
      </div>
      {canReact && (
        <Popover.Portal>
          <Popover.Content
            side="left"
            align="start"
            sideOffset={6}
            collisionPadding={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
            style={{ zIndex: 220 }}
          >
            <ReactionTray
              selected={new Set(optimistic.filter((r) => r.mine).map((r) => r.emoji))}
              onToggle={toggle}
            />
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
    justifyContent: 'center',
    padding: '4px 6px',
    background: 'transparent',
    border: 0,
    borderRadius: 'var(--radius-pill)',
    cursor: canReact ? 'pointer' : 'default',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--text-sm)',
    color: 'var(--colour-text-secondary)',
    opacity: canReact ? 1 : 0.7,
    minWidth: 32,
    minHeight: 32,
  };
}

const stackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
};

function emojiRowStyle(mine: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    padding: '1px 6px',
    borderRadius: 'var(--radius-pill)',
    background: mine ? 'var(--colour-surface-selected)' : 'transparent',
    border: mine ? '1px solid var(--colour-text-link)' : '1px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1.1,
    color: 'var(--colour-text-secondary)',
    minHeight: 22,
  };
}

const countTextStyle: CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
};

const expanderStyle: CSSProperties = {
  background: 'transparent',
  border: 0,
  padding: '1px 6px',
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
  cursor: 'pointer',
  borderRadius: 'var(--radius-pill)',
};
