'use client';

/**
 * @build-unit BU-reactions
 * @spec architecture/decision-log.md (D050)
 * @spec product/scenarios.md (SCN-3)
 * @spec product/design-philosophy.md
 *
 * The 8-emoji picker. Pure UI — receives current selection and a
 * toggle callback; owns no state. Used inside ReactionPill.
 */

import type { FC } from 'react';
import type { FeedReactionEmoji } from '@/components/PostCard';

const EMOJI_LIST: { value: FeedReactionEmoji; glyph: string; label: string }[] = [
  { value: 'candle', glyph: '🕯️', label: 'Vigil' },
  { value: 'pray', glyph: '🙏', label: 'Pray' },
  { value: 'heart', glyph: '❤️', label: 'Solidarity' },
  { value: 'strong', glyph: '💪', label: 'Strength' },
  { value: 'target', glyph: '🎯', label: 'Agreed' },
  { value: 'sparkle', glyph: '💕', label: 'Warmth' },
  { value: 'thumbsup', glyph: '👍', label: 'Acknowledged' },
  { value: 'sad', glyph: '😢', label: 'Grief' },
];

export const REACTION_GLYPH: Record<FeedReactionEmoji, string> = Object.fromEntries(
  EMOJI_LIST.map((e) => [e.value, e.glyph]),
) as Record<FeedReactionEmoji, string>;

interface ReactionTrayProps {
  selected: Set<FeedReactionEmoji>;
  onToggle: (emoji: FeedReactionEmoji) => void;
  disabled?: boolean;
}

export const ReactionTray: FC<ReactionTrayProps> = ({ selected, onToggle, disabled }) => {
  return (
    <div
      role="toolbar"
      aria-label="Pick a reaction"
      data-testid="reaction-tray"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 'var(--space-1)',
        padding: 'var(--space-2)',
        background: 'var(--colour-surface-raised)',
        border: '1px solid var(--colour-border-subtle)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        // Never exceed the viewport width minus a safe gutter on each
        // side. `--space-8` = 32px → 16px gutter L+R. Combined with
        // `flexWrap: wrap`, this guarantees every emoji button stays on-
        // screen at any viewport down to ~320px (iPhone SE).
        maxWidth: 'calc(100vw - var(--space-8))',
      }}
    >
      {EMOJI_LIST.map((e) => {
        const isOn = selected.has(e.value);
        return (
          <button
            key={e.value}
            type="button"
            onClick={() => onToggle(e.value)}
            disabled={disabled}
            aria-pressed={isOn}
            aria-label={e.label}
            data-testid="reaction-tray-emoji-button"
            data-emoji={e.value}
            style={{
              fontSize: 'var(--text-lg)',
              lineHeight: 1,
              padding: 'var(--space-1) var(--space-2)',
              background: isOn ? 'var(--colour-surface-selected)' : 'transparent',
              border: isOn
                ? '1px solid var(--colour-text-link)'
                : '1px solid var(--colour-border-subtle)',
              borderRadius: 'var(--radius-sm)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              fontFamily: 'var(--font-ui)',
              // Touch target: ≥36×36 px so wrapped rows stay tappable
              // on small screens. The picker may wrap to 2-3 rows on a
              // 320px viewport — each button must still be hittable.
              minWidth: 36,
              minHeight: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span aria-hidden="true">{e.glyph}</span>
          </button>
        );
      })}
    </div>
  );
};
