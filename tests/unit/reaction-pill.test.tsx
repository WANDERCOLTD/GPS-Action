/**
 * @build-unit BU-comments-card-lift
 *
 * Style-invariant tests for ReactionPill. Vitest env is `node`, no
 * RTL — and `ReactionPill` itself uses React hooks plus a Radix
 * Popover, so we don't render it. Instead we import the exported
 * style objects and assert their layout shape directly. That
 * suffices because the brief's invariants are entirely about
 * geometry: both the empty-state quick-rail and the populated stack
 * must lay out horizontally, and the picker emoji must default to a
 * ghost (low-opacity) treatment.
 */

import { describe, it, expect } from 'vitest';
import {
  containerStyle,
  populatedContainerStyle,
  quickRailButtonDefaultOpacity,
  quickRailButtonStyle,
  quickRailContainerStyle,
} from '@/components/ReactionPill';

describe('ReactionPill layout (BU-comments-card-lift)', () => {
  it('outer container lays out as a horizontal wrapping row', () => {
    expect(containerStyle.flexDirection).toBe('row');
    expect(containerStyle.flexWrap).toBe('wrap');
  });

  it('empty-state quick-rail container is a horizontal wrapping row', () => {
    expect(quickRailContainerStyle.flexDirection).toBe('row');
    expect(quickRailContainerStyle.flexWrap).toBe('wrap');
    expect(quickRailContainerStyle.alignItems).toBe('center');
  });

  it('populated-state container is a horizontal wrapping row', () => {
    expect(populatedContainerStyle.flexDirection).toBe('row');
    expect(populatedContainerStyle.flexWrap).toBe('wrap');
    expect(populatedContainerStyle.alignItems).toBe('center');
  });

  it('picker emoji default to ghost styling (opacity ≤ 0.6, transparent ground)', () => {
    expect(quickRailButtonDefaultOpacity).toBeLessThanOrEqual(0.6);
    expect(quickRailButtonStyle.opacity).toBe(quickRailButtonDefaultOpacity);
    expect(quickRailButtonStyle.background).toBe('transparent');
    expect(quickRailButtonStyle.border).toBe('1px solid transparent');
  });

  it('picker emoji include a transition so the lift animates', () => {
    expect(typeof quickRailButtonStyle.transition).toBe('string');
    expect(quickRailButtonStyle.transition).toContain('opacity');
  });
});
