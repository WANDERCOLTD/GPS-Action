/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const stateSlots: unknown[] = [];
let slotIdx = 0;
const refSlots: { current: unknown }[] = [];
let refIdx = 0;
const effects: Array<() => void | (() => void)> = [];

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: <T,>(init: T) => {
      const idx = slotIdx++;
      const setter = (next: T) => {
        stateSlots[idx] = next;
      };
      const value = (idx in stateSlots ? stateSlots[idx] : init) as T;
      return [value, setter] as const;
    },
    useRef: <T,>(init: T) => {
      const idx = refIdx++;
      const slot = refSlots[idx] ?? { current: init };
      refSlots[idx] = slot;
      return slot;
    },
    useEffect: (fn: () => void | (() => void)) => {
      effects.push(fn);
    },
  };
});

const { UndoSnackbar } = await import('@/components/UndoSnackbar');

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
  refSlots.length = 0;
  refIdx = 0;
  effects.length = 0;
}

beforeEach(() => {
  reset();
  vi.useFakeTimers();
});

describe('UndoSnackbar', () => {
  it('renders the message and an Undo button under the default testid', () => {
    const tree = UndoSnackbar({
      message: 'Discarded',
      durationMs: 10000,
      onUndo: vi.fn(),
      onTimeout: vi.fn(),
    }) as AnyElement;

    expect(tree.props['data-testid']).toBe('compose-undo-snackbar');
    expect(tree.props.role).toBe('status');
    expect(tree.props['aria-live']).toBe('polite');

    const undoBtn = findByTestId(tree, 'compose-undo-snackbar-undo');
    expect(undoBtn).toBeDefined();

    const messages = flatChildren(tree).filter((e) => typeof e.props.children === 'string');
    const messageText = messages.map((e) => e.props.children as string).join('');
    expect(messageText).toContain('Discarded');
  });

  it('exposes a `purpose` data attribute so callers can distinguish flows', () => {
    const tree = UndoSnackbar({
      message: 'x',
      durationMs: 1000,
      onUndo: vi.fn(),
      onTimeout: vi.fn(),
      purpose: 'discard-post',
    }) as AnyElement;
    expect(tree.props['data-testid']).toBe('compose-undo-snackbar');
    expect(tree.props['data-purpose']).toBe('discard-post');
  });

  it('fires onTimeout once the configured duration elapses', () => {
    const onUndo = vi.fn();
    const onTimeout = vi.fn();

    UndoSnackbar({
      message: 'Discarded',
      durationMs: 10000,
      onUndo,
      onTimeout,
    });

    // Run the queued useEffect — schedules the setTimeout.
    effects.forEach((fn) => fn());
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('fires onUndo (and not onTimeout) when the Undo button is clicked', async () => {
    const onUndo = vi.fn().mockResolvedValue(undefined);
    const onTimeout = vi.fn();

    const tree = UndoSnackbar({
      message: 'Discarded',
      durationMs: 10000,
      onUndo,
      onTimeout,
    }) as AnyElement;

    effects.forEach((fn) => fn());

    const undoBtn = findByTestId(tree, 'compose-undo-snackbar-undo');
    const onClick = undoBtn?.props.onClick as () => Promise<void>;
    await onClick();

    expect(onUndo).toHaveBeenCalledTimes(1);

    // After undo, the timeout shouldn't fire even if we run the timer.
    vi.advanceTimersByTime(10000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
