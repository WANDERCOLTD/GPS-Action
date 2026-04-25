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
        gap: 'var(--space-1)',
        padding: 'var(--space-2)',
        background: 'var(--colour-surface-raised)',
        border: '1px solid var(--colour-border-subtle)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
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
            }}
          >
            <span aria-hidden="true">{e.glyph}</span>
          </button>
        );
      })}
    </div>
  );
};
