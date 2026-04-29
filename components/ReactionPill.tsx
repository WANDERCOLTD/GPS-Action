'use client';

/**
 * @build-unit BU-reactions
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
 */

import { useOptimistic, useState, useTransition, useRef, useEffect } from 'react';
import type { FC } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside closes the tray.
  //
  // Two iOS-PWA gotchas the implementation guards against:
  //   1. Defer listener attachment by 250ms. On iOS Safari the same
  //      touch that fired `setOpen(true)` synthesises a click whose
  //      coordinates land outside this container (because the touch
  //      ends ~100-200ms after the click handler runs). Without a
  //      delay, that synth click closes the tray we just opened (the
  //      "flash" bug). 250ms covers iOS's synth-click window.
  //   2. Use `pointerdown` instead of `mousedown`. `pointerdown` fires
  //      cleanly once per touch on iOS without the synthesised-mouse
  //      double-fire that `mousedown` is prone to.
  useEffect(() => {
    if (!open) return;
    function handler(event: PointerEvent): void {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    const t = setTimeout(() => {
      document.addEventListener('pointerdown', handler);
    }, 250);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', handler);
    };
  }, [open]);

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
    <div
      ref={containerRef}
      data-testid="reaction-pill-container"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          // Defensive: stop the click bubbling so any future ancestor-
          // level click handler doesn't fire while the member is
          // reacting. PostCard no longer carries one but this protects
          // the reaction surface across all caller sites.
          e.stopPropagation();
          if (canReact) setOpen((v) => !v);
        }}
        disabled={!canReact}
        aria-expanded={open}
        aria-label={hasAny ? `${totalCount} reactions, add a reaction` : 'Add a reaction'}
        title={hasAny ? `${totalCount} reactions — add yours` : 'Add a reaction'}
        data-testid="reaction-pill-toggle"
        style={{
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
            {/* Add-reaction affordance — tail of the cluster.
                Slack-pattern smiley+plus, never the word "React". */}
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
          /* No reactions yet — single smiley+plus icon as the only
              affordance. No "React" word. Slack/Discord pattern. */
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

      {open && canReact && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            // Open leftward — the pill commonly sits at the right edge
            // of a row (e.g. PostCard's bottom row), so anchoring the
            // tray's right edge to the pill's right edge keeps it on
            // screen on narrow phones. Falls back gracefully on wide
            // surfaces because the tray is its natural width either way.
            right: 0,
            zIndex: 10,
            marginTop: 'var(--space-1)',
            // Width must be set or the absolute wrapper shrinks to fit
            // a single child, which combined with the tray's
            // `flex-wrap: wrap` collapses the 8 emoji into a vertical
            // column. `max-content` sizes to the unwrapped natural
            // width on wide screens; `max-width: calc(100vw - …)`
            // clamps to viewport on narrow ones so the tray wraps to
            // two rows instead of clipping off the left edge of the
            // page (iPhone Pro 402px width caused this — the natural
            // 8-emoji row is ~460px and was overflowing the page).
            width: 'max-content',
            maxWidth: 'calc(100vw - var(--space-4))',
          }}
        >
          <ReactionTray selected={myEmoji} onToggle={toggle} />
        </div>
      )}
    </div>
  );
};
