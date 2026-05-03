/**
 * Unit tests for HistoryBackButton.
 *
 * @build-unit BU-search-result-cards
 * @spec build/session-briefs/bu-search-result-cards.md
 *
 * Asserts: returns to history when one exists, falls back to the
 * configured href when there isn't one (direct deep-link visits).
 * Same plain-function-as-component walker pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const backSpy = vi.fn();
const pushSpy = vi.fn<(href: string) => void>();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backSpy, push: pushSpy }),
}));

const { HistoryBackButton } = await import('@/components/HistoryBackButton');

type AnyElement = ReactElement<Record<string, unknown>>;

beforeEach(() => {
  backSpy.mockReset();
  pushSpy.mockReset();
  // Reset window.history.length between tests via a fresh mock window.
  (globalThis as { window?: unknown }).window = { history: { length: 1 } };
});

describe('HistoryBackButton', () => {
  it('renders a button with the canonical testid + aria-label + fallback attribute', () => {
    const tree = HistoryBackButton({ fallbackHref: '/feed' }) as AnyElement;
    expect(tree.props['data-testid']).toBe('nav-history-back-button');
    expect(tree.props['aria-label']).toBe('Back');
    expect(tree.props['data-fallback']).toBe('/feed');
    expect(tree.props.type).toBe('button');
  });

  it('honours a custom aria-label', () => {
    const tree = HistoryBackButton({
      fallbackHref: '/feed',
      ariaLabel: 'Back to results',
    }) as AnyElement;
    expect(tree.props['aria-label']).toBe('Back to results');
  });

  it('navigates to the fallback href when there is no history (length 1)', () => {
    (globalThis as { window: { history: { length: number } } }).window = {
      history: { length: 1 },
    };
    const tree = HistoryBackButton({ fallbackHref: '/feed' }) as AnyElement;
    (tree.props.onClick as () => void)();
    expect(pushSpy).toHaveBeenCalledWith('/feed');
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('returns to previous page when history is non-empty (length > 1)', () => {
    (globalThis as { window: { history: { length: number } } }).window = {
      history: { length: 4 },
    };
    const tree = HistoryBackButton({ fallbackHref: '/feed' }) as AnyElement;
    (tree.props.onClick as () => void)();
    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('uses the fallback when window is undefined (SSR safety)', () => {
    delete (globalThis as { window?: unknown }).window;
    const tree = HistoryBackButton({ fallbackHref: '/feed' }) as AnyElement;
    (tree.props.onClick as () => void)();
    expect(pushSpy).toHaveBeenCalledWith('/feed');
  });
});
