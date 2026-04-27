/**
 * Unit tests for the HeaderRefreshButton primitive.
 *
 * @build-unit BU-sticky-nav
 * @spec architecture/decision-log.md (D065)
 *
 * Vitest env is `node` and no RTL is installed (same precedent as
 * `error-boundary.test.tsx`). We mock `next/navigation` and React's
 * `useTransition` so the component can be invoked as a plain function;
 * we then walk the returned ReactElement tree to assert the contract.
 */

import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

const refreshSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshSpy }),
}));

const useTransitionMock = vi.fn<() => [boolean, (cb: () => void) => void]>(() => [
  false,
  (cb: () => void) => cb(),
]);

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useTransition: () => useTransitionMock(),
  };
});

const { HeaderRefreshButton } = await import('@/components/HeaderRefreshButton');

type AnyElement = ReactElement<Record<string, unknown>>;

function findChild(el: AnyElement, predicate: (e: AnyElement) => boolean): AnyElement | undefined {
  if (predicate(el)) return el;
  const children = (el.props.children ?? []) as unknown;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child && typeof child === 'object' && 'props' in child) {
      const found = findChild(child as AnyElement, predicate);
      if (found) return found;
    }
  }
  return undefined;
}

function findByTestId(el: AnyElement, testId: string): AnyElement | undefined {
  return findChild(el, (e) => e.props['data-testid'] === testId);
}

describe('HeaderRefreshButton', () => {
  it('renders a button with the canonical testid and aria-label', () => {
    const tree = HeaderRefreshButton() as AnyElement;
    const button = findByTestId(tree, 'header-refresh-button');
    expect(button).toBeDefined();
    expect(button?.type).toBe('button');
    expect(button?.props['aria-label']).toBe('Refresh page');
  });

  it('invokes router.refresh() when the click handler runs', () => {
    refreshSpy.mockClear();
    const tree = HeaderRefreshButton() as AnyElement;
    const button = findByTestId(tree, 'header-refresh-button');
    expect(button).toBeDefined();

    const onClick = button?.props.onClick as () => void;
    onClick();

    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('renders the resting (non-pending) state by default', () => {
    useTransitionMock.mockReturnValueOnce([false, (cb: () => void) => cb()]);
    const tree = HeaderRefreshButton() as AnyElement;
    const button = findByTestId(tree, 'header-refresh-button');
    expect(button?.props.disabled).toBe(false);
  });

  it('renders the pending state (disabled) when a transition is in flight', () => {
    useTransitionMock.mockReturnValueOnce([true, (cb: () => void) => cb()]);
    const tree = HeaderRefreshButton() as AnyElement;
    const button = findByTestId(tree, 'header-refresh-button');
    expect(button?.props.disabled).toBe(true);
  });
});
