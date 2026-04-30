/**
 * @build-unit BU-link-first-composer BU-feed-card-affordances
 * @spec build/session-briefs/bu-link-first-composer.md
 * @spec build/session-briefs/bu-feed-card-affordances.md
 *
 * Two halves to the FAB pill: a primary "+" that opens the unified
 * IntentFabSheet (paste/type + kind tiles in one screen), and a "📋"
 * shortcut that reads the clipboard and routes straight to /compose.
 * Both must carry distinct testids and aria labels (so screen readers
 * can tell them apart) and both must funnel through the shared paste
 * handler.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement } from 'react';

const stateSlots: unknown[] = [];
let slotIdx = 0;

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
  };
});

const pushSpy = vi.fn<(href: string) => void>();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

// IntentFabSheet imports Radix + JSX modules that don't survive this test's
// transform; stub it and inspect the React element IntentFab renders for it
// (open prop) directly.
vi.mock('@/components/IntentFabSheet', () => ({
  IntentFabSheet: () => null,
}));

const { IntentFabSheet: MockedSheet } = await import('@/components/IntentFabSheet');

const { IntentFab } = await import('@/components/IntentFab');

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

function findByType(el: AnyElement, type: unknown): AnyElement | undefined {
  return flatChildren(el).find((e) => e.type === type);
}

function sheetIsOpen(tree: AnyElement): boolean {
  const el = findByType(tree, MockedSheet);
  return Boolean(el?.props.open);
}

function resetState(): void {
  stateSlots.length = 0;
  slotIdx = 0;
}

function render(): AnyElement {
  slotIdx = 0;
  return IntentFab() as AnyElement;
}

describe('IntentFab — split pill', () => {
  beforeEach(() => {
    resetState();
    pushSpy.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders two distinct tap targets with distinct testids and aria labels', () => {
    const tree = render();
    const primary = findByTestId(tree, 'intent-fab-button-primary');
    const paste = findByTestId(tree, 'intent-fab-button-paste');
    expect(primary).toBeDefined();
    expect(paste).toBeDefined();
    expect(primary?.props['aria-label']).toBe('Create a post');
    expect(paste?.props['aria-label']).toBe('Paste from clipboard');
  });

  it('each half meets the 44px minimum tap target', () => {
    const tree = render();
    const primary = findByTestId(tree, 'intent-fab-button-primary');
    const paste = findByTestId(tree, 'intent-fab-button-paste');
    const primaryStyle = primary?.props.style as { minWidth?: number; minHeight?: number };
    const pasteStyle = paste?.props.style as { minWidth?: number; minHeight?: number };
    expect(primaryStyle.minWidth).toBeGreaterThanOrEqual(44);
    expect(primaryStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(pasteStyle.minWidth).toBeGreaterThanOrEqual(44);
    expect(pasteStyle.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('sheet is closed on first render and opens after the primary tap', () => {
    const tree1 = render();
    expect(sheetIsOpen(tree1)).toBe(false);

    const primary = findByTestId(tree1, 'intent-fab-button-primary');
    (primary?.props.onClick as () => void)();

    const tree2 = render();
    expect(sheetIsOpen(tree2)).toBe(true);
  });

  it('paste tap routes to /compose with the right query when clipboard contains a URL', async () => {
    const readText = vi.fn().mockResolvedValue('www.example.com/path');
    vi.stubGlobal('navigator', { clipboard: { readText } } as unknown as Navigator);

    const tree = render();
    const paste = findByTestId(tree, 'intent-fab-button-paste');
    await (paste?.props.onClick as () => Promise<void>)();

    expect(readText).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    const href = pushSpy.mock.calls[0]?.[0] as string;
    expect(href).toBe('/compose?linkUrl=https%3A%2F%2Fwww.example.com%2Fpath');
  });

  it('paste tap routes to /compose with title= when clipboard contains free text', async () => {
    const readText = vi.fn().mockResolvedValue('Park Royal walkout tonight');
    vi.stubGlobal('navigator', { clipboard: { readText } } as unknown as Navigator);

    const tree = render();
    const paste = findByTestId(tree, 'intent-fab-button-paste');
    await (paste?.props.onClick as () => Promise<void>)();

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const href = pushSpy.mock.calls[0]?.[0] as string;
    expect(href).toMatch(/^\/compose\?title=Park%20Royal%20walkout%20tonight$/);
  });

  it('paste tap falls back to opening the sheet when the clipboard is empty', async () => {
    const readText = vi.fn().mockResolvedValue('');
    vi.stubGlobal('navigator', { clipboard: { readText } } as unknown as Navigator);

    const tree = render();
    const paste = findByTestId(tree, 'intent-fab-button-paste');
    await (paste?.props.onClick as () => Promise<void>)();

    expect(pushSpy).not.toHaveBeenCalled();
    const tree2 = render();
    expect(sheetIsOpen(tree2)).toBe(true);
  });

  it('paste tap falls back to opening the sheet when clipboard read is denied', async () => {
    const readText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { readText } } as unknown as Navigator);

    const tree = render();
    const paste = findByTestId(tree, 'intent-fab-button-paste');
    await (paste?.props.onClick as () => Promise<void>)();

    expect(pushSpy).not.toHaveBeenCalled();
    const tree2 = render();
    expect(sheetIsOpen(tree2)).toBe(true);
  });
});
