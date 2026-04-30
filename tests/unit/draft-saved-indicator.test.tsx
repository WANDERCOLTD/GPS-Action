/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const stateSlots: unknown[] = [];
let slotIdx = 0;

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: <T,>(init: T | (() => T)) => {
      const idx = slotIdx++;
      const setter = (next: T | ((prev: T) => T)) => {
        const prev = (idx in stateSlots ? stateSlots[idx] : init) as T;
        stateSlots[idx] = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      };
      const initial = typeof init === 'function' ? (init as () => T)() : init;
      const value = (idx in stateSlots ? stateSlots[idx] : initial) as T;
      return [value, setter] as const;
    },
  };
});

const { DraftSavedIndicator } = await import('@/components/DraftSavedIndicator');

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

function findByTestId(el: AnyElement, id: string): AnyElement | undefined {
  return flatChildren(el).find((e) => e.props['data-testid'] === id);
}

function reset(): void {
  stateSlots.length = 0;
  slotIdx = 0;
}

function renderIndicator(props: Parameters<typeof DraftSavedIndicator>[0]): AnyElement {
  slotIdx = 0;
  return DraftSavedIndicator(props) as AnyElement;
}

beforeEach(reset);

describe('DraftSavedIndicator labels', () => {
  it('reads "Editing…" when state is editing', () => {
    const tree = renderIndicator({
      state: 'editing',
      onDiscardClick: vi.fn(),
    });
    const label = findByTestId(tree, 'compose-draft-saved-indicator-label');
    expect(label?.props.children).toBe('Editing…');
  });

  it('reads "Saved · 2s ago" when state is saved with a recent timestamp', () => {
    const now = new Date('2026-04-28T12:00:02Z');
    const lastSavedAt = new Date('2026-04-28T12:00:00Z');
    const tree = renderIndicator({
      state: 'saved',
      lastSavedAt,
      now,
      onDiscardClick: vi.fn(),
    });
    const label = findByTestId(tree, 'compose-draft-saved-indicator-label');
    expect(label?.props.children).toBe('Saved · 2s ago');
  });

  it('reads "Saved · 5m ago" when the save was minutes ago', () => {
    const now = new Date('2026-04-28T12:05:00Z');
    const lastSavedAt = new Date('2026-04-28T12:00:00Z');
    const tree = renderIndicator({
      state: 'saved',
      lastSavedAt,
      now,
      onDiscardClick: vi.fn(),
    });
    const label = findByTestId(tree, 'compose-draft-saved-indicator-label');
    expect(label?.props.children).toBe('Saved · 5m ago');
  });

  it('reads "Couldn\'t save" when state is failed', () => {
    const tree = renderIndicator({
      state: 'failed',
      onDiscardClick: vi.fn(),
    });
    const label = findByTestId(tree, 'compose-draft-saved-indicator-label');
    expect(label?.props.children).toBe("Couldn't save");
  });

  it('marks data-state on the wrapper to enable styling without colour-only signal', () => {
    const editing = renderIndicator({ state: 'editing', onDiscardClick: vi.fn() });
    const saved = renderIndicator({ state: 'saved', onDiscardClick: vi.fn() });
    const failed = renderIndicator({ state: 'failed', onDiscardClick: vi.fn() });
    expect(editing.props['data-state']).toBe('editing');
    expect(saved.props['data-state']).toBe('saved');
    expect(failed.props['data-state']).toBe('failed');
  });
});

describe('DraftSavedIndicator menu', () => {
  it('does not render the menu by default', () => {
    const tree = renderIndicator({ state: 'saved', onDiscardClick: vi.fn() });
    expect(findByTestId(tree, 'compose-draft-saved-indicator-menu')).toBeUndefined();
  });

  it('opens the menu after the toggle is clicked', () => {
    reset();
    const onDiscardClick = vi.fn();
    let tree = renderIndicator({ state: 'saved', onDiscardClick });

    const toggle = findByTestId(tree, 'compose-draft-saved-indicator-toggle');
    (toggle?.props.onClick as () => void)();

    tree = renderIndicator({ state: 'saved', onDiscardClick });
    expect(findByTestId(tree, 'compose-draft-saved-indicator-menu')).toBeDefined();
  });

  it('renders View-all-drafts as disabled when no href is provided (Phase 2 placeholder)', () => {
    reset();
    const tree = (() => {
      let t = renderIndicator({ state: 'saved', onDiscardClick: vi.fn() });
      const toggle = findByTestId(t, 'compose-draft-saved-indicator-toggle');
      (toggle?.props.onClick as () => void)();
      return renderIndicator({ state: 'saved', onDiscardClick: vi.fn() });
    })();

    const viewAll = findByTestId(tree, 'compose-draft-saved-indicator-view-all');
    expect(viewAll?.props['aria-disabled']).toBe('true');
    expect(viewAll?.props['data-disabled']).toBe('true');
  });

  it('enables View-all-drafts once viewDraftsHref is supplied', () => {
    reset();
    const tree = (() => {
      let t = renderIndicator({
        state: 'saved',
        onDiscardClick: vi.fn(),
        viewDraftsHref: '/drafts',
      });
      const toggle = findByTestId(t, 'compose-draft-saved-indicator-toggle');
      (toggle?.props.onClick as () => void)();
      return renderIndicator({
        state: 'saved',
        onDiscardClick: vi.fn(),
        viewDraftsHref: '/drafts',
      });
    })();

    const viewAll = findByTestId(tree, 'compose-draft-saved-indicator-view-all');
    expect(viewAll?.props['aria-disabled']).toBeUndefined();
    expect(viewAll?.props.href).toBe('/drafts');
  });

  it('fires onDiscardClick when the menu Discard item is clicked', () => {
    reset();
    const onDiscardClick = vi.fn();
    let tree = renderIndicator({ state: 'saved', onDiscardClick });
    const toggle = findByTestId(tree, 'compose-draft-saved-indicator-toggle');
    (toggle?.props.onClick as () => void)();

    tree = renderIndicator({ state: 'saved', onDiscardClick });
    const discard = findByTestId(tree, 'compose-draft-saved-indicator-discard');
    (discard?.props.onClick as () => void)();

    expect(onDiscardClick).toHaveBeenCalledTimes(1);
  });
});

describe('DraftSavedIndicator retry', () => {
  it('renders a Retry button only when state=failed and onRetry is supplied', () => {
    const onRetry = vi.fn();
    const failed = renderIndicator({
      state: 'failed',
      onDiscardClick: vi.fn(),
      onRetry,
    });
    expect(findByTestId(failed, 'compose-draft-saved-indicator-retry')).toBeDefined();

    const saved = renderIndicator({
      state: 'saved',
      onDiscardClick: vi.fn(),
      onRetry,
    });
    expect(findByTestId(saved, 'compose-draft-saved-indicator-retry')).toBeUndefined();
  });

  it('fires onRetry when Retry is clicked', () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    const tree = renderIndicator({
      state: 'failed',
      onDiscardClick: vi.fn(),
      onRetry,
    });
    const retry = findByTestId(tree, 'compose-draft-saved-indicator-retry');
    (retry?.props.onClick as (e: { stopPropagation: () => void }) => void)({
      stopPropagation: () => undefined,
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
