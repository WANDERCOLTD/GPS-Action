/**
 * Unit tests for ReactionTray — the 8-emoji picker.
 *
 * @build-unit BU-reactions
 *
 * Vitest env is `node`, no RTL. Invoke the component as a plain
 * function and walk the ReactElement tree.
 *
 * Asserts the picker stays viewport-safe on narrow screens:
 *   - container wraps to multiple rows (`flexWrap: 'wrap'`)
 *   - container is capped to a viewport-safe max-width
 *   - every emoji button preserves a ≥36×36 px touch target
 *   - no emoji button is hidden (`display: none`) or off-canvas
 *   - canonical testids on emoji buttons are preserved (F14)
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement, CSSProperties } from 'react';
import { ReactionTray } from '@/components/ReactionTray';
import type { FeedReactionEmoji } from '@/components/PostCard';

type AnyElement = ReactElement<Record<string, unknown>>;

function flatChildren(el: AnyElement): AnyElement[] {
  const acc: AnyElement[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const e = node as AnyElement;
    acc.push(e);
    const c = e.props.children;
    if (Array.isArray(c)) c.forEach(walk);
    else walk(c);
  };
  walk(el);
  return acc;
}

function findByTestId(el: AnyElement, testId: string): AnyElement | undefined {
  return flatChildren(el).find((e) => e.props['data-testid'] === testId);
}

function findAllByTestId(el: AnyElement, testId: string): AnyElement[] {
  return flatChildren(el).filter((e) => e.props['data-testid'] === testId);
}

function styleOf(el: AnyElement | undefined): CSSProperties {
  return (el?.props.style as CSSProperties | undefined) ?? {};
}

describe('ReactionTray', () => {
  const noop = (): void => {
    /* no-op */
  };
  const empty = new Set<FeedReactionEmoji>();

  it('wraps to multiple rows on narrow viewports (flex-wrap: wrap)', () => {
    const tree = ReactionTray({ selected: empty, onToggle: noop }) as AnyElement;
    const container = findByTestId(tree, 'reaction-tray');
    expect(container).toBeDefined();
    expect(styleOf(container).flexWrap).toBe('wrap');
    expect(styleOf(container).display).toBe('flex');
  });

  it('caps the container width to the viewport minus a safe gutter', () => {
    const tree = ReactionTray({ selected: empty, onToggle: noop }) as AnyElement;
    const container = findByTestId(tree, 'reaction-tray');
    // Must constrain max-width so the picker never overflows the
    // viewport. The exact value uses a CSS var token; we just assert
    // it's a viewport-relative `calc()` so the constraint is real.
    const maxWidth = styleOf(container).maxWidth;
    expect(typeof maxWidth).toBe('string');
    expect(maxWidth).toMatch(/100vw/);
    expect(maxWidth).toMatch(/calc\(/);
  });

  it('renders all 8 emoji buttons with canonical testids preserved', () => {
    const tree = ReactionTray({ selected: empty, onToggle: noop }) as AnyElement;
    const buttons = findAllByTestId(tree, 'reaction-tray-emoji-button');
    expect(buttons).toHaveLength(8);
    // Each button carries a `data-emoji` for selector targeting.
    for (const btn of buttons) {
      expect(typeof btn.props['data-emoji']).toBe('string');
    }
  });

  it('every emoji button preserves a ≥36×36 px touch target', () => {
    const tree = ReactionTray({ selected: empty, onToggle: noop }) as AnyElement;
    const buttons = findAllByTestId(tree, 'reaction-tray-emoji-button');
    for (const btn of buttons) {
      const s = styleOf(btn);
      expect(typeof s.minWidth === 'number' ? s.minWidth : 0).toBeGreaterThanOrEqual(36);
      expect(typeof s.minHeight === 'number' ? s.minHeight : 0).toBeGreaterThanOrEqual(36);
    }
  });

  it('does not hide or off-canvas any emoji button', () => {
    const tree = ReactionTray({ selected: empty, onToggle: noop }) as AnyElement;
    const buttons = findAllByTestId(tree, 'reaction-tray-emoji-button');
    for (const btn of buttons) {
      const s = styleOf(btn);
      // No `display: none`.
      expect(s.display).not.toBe('none');
      // No off-canvas absolute positioning. The tray uses normal flex
      // flow — no button should set `position: absolute` with negative
      // offsets, nor `visibility: hidden`.
      expect(s.position).not.toBe('absolute');
      expect(s.visibility).not.toBe('hidden');
    }
  });

  it('marks selected emoji with aria-pressed=true', () => {
    const selected = new Set<FeedReactionEmoji>(['heart', 'thumbsup']);
    const tree = ReactionTray({ selected, onToggle: noop }) as AnyElement;
    const buttons = findAllByTestId(tree, 'reaction-tray-emoji-button');
    for (const btn of buttons) {
      const emoji = btn.props['data-emoji'] as FeedReactionEmoji;
      const expected = selected.has(emoji);
      expect(btn.props['aria-pressed']).toBe(expected);
    }
  });
});
