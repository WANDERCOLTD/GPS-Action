/**
 * @build-unit BU-link-first-composer
 * @spec build/session-briefs/bu-link-first-composer.md
 *
 * Vitest env is `node`, no RTL. We mock React's `useState` so a
 * stateful component can be invoked as a plain function and we can
 * drive successive renders by writing into the slot array. The
 * pattern is local to this test (and the FAB test); other unit tests
 * in this repo cover stateless or transition-only components.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement } from 'react';

const stateSlots: unknown[] = [];
let slotIdx = 0;
const refSlots: { current: unknown }[] = [];
let refIdx = 0;

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
    // No-op useEffect — these tests only inspect the rendered tree,
    // not the side-effect behaviour. The ghost-click guard's effect
    // is exercised by manual smoke-test on iPhone, not by these unit
    // assertions.
    useEffect: () => undefined,
  };
});

const { IntentFabStarter } = await import('@/components/IntentFabStarter');

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

function findByTestId(el: AnyElement | null, testId: string): AnyElement | undefined {
  if (!el) return undefined;
  return flatChildren(el).find((e) => e.props['data-testid'] === testId);
}

function resetState(): void {
  stateSlots.length = 0;
  slotIdx = 0;
  refSlots.length = 0;
  refIdx = 0;
}

function render(props: Parameters<typeof IntentFabStarter>[0]): AnyElement | null {
  slotIdx = 0;
  refIdx = 0;
  return IntentFabStarter(props) as AnyElement | null;
}

describe('IntentFabStarter', () => {
  beforeEach(() => {
    resetState();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when open is false', () => {
    const tree = render({
      open: false,
      onClose: () => {},
      onContinue: () => {},
      onPickKind: () => {},
    });
    expect(tree).toBeNull();
  });

  it('renders the input, paste button, continue, and pick-a-kind link with canonical testids', () => {
    const tree = render({
      open: true,
      onClose: () => {},
      onContinue: () => {},
      onPickKind: () => {},
    });
    expect(findByTestId(tree, 'intent-fab-starter-sheet')).toBeDefined();
    expect(findByTestId(tree, 'intent-fab-starter-input')).toBeDefined();
    expect(findByTestId(tree, 'intent-fab-starter-paste')).toBeDefined();
    expect(findByTestId(tree, 'intent-fab-starter-continue')).toBeDefined();
    expect(findByTestId(tree, 'intent-fab-starter-pick-kind')).toBeDefined();
    expect(findByTestId(tree, 'intent-fab-starter-close')).toBeDefined();
  });

  it('disables Continue when the input is empty', () => {
    const tree = render({
      open: true,
      onClose: () => {},
      onContinue: () => {},
      onPickKind: () => {},
    });
    const cont = findByTestId(tree, 'intent-fab-starter-continue');
    expect(cont?.props.disabled).toBe(true);
  });

  it('shows the URL hint when the input looks like a link', () => {
    stateSlots[0] = 'www.example.com';
    const tree = render({
      open: true,
      onClose: () => {},
      onContinue: () => {},
      onPickKind: () => {},
    });
    const hint = findByTestId(tree, 'intent-fab-starter-hint');
    expect(hint?.props['data-hint-kind']).toBe('url');
    const cont = findByTestId(tree, 'intent-fab-starter-continue');
    expect(cont?.props.disabled).toBe(false);
  });

  it('shows the text hint when the input is free-form prose', () => {
    stateSlots[0] = 'Park Royal walkout tonight';
    const tree = render({
      open: true,
      onClose: () => {},
      onContinue: () => {},
      onPickKind: () => {},
    });
    const hint = findByTestId(tree, 'intent-fab-starter-hint');
    expect(hint?.props['data-hint-kind']).toBe('text');
  });

  it('Continue fires onContinue with a normalized URL payload when input is a URL', () => {
    stateSlots[0] = 'www.example.com';
    const onContinue = vi.fn();
    const tree = render({
      open: true,
      onClose: () => {},
      onContinue,
      onPickKind: () => {},
    });
    const cont = findByTestId(tree, 'intent-fab-starter-continue');
    (cont?.props.onClick as () => void)();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith({ kind: 'url', value: 'https://www.example.com' });
  });

  it('Continue fires onContinue with a text payload when input is prose', () => {
    stateSlots[0] = 'Park Royal walkout tonight';
    const onContinue = vi.fn();
    const tree = render({
      open: true,
      onClose: () => {},
      onContinue,
      onPickKind: () => {},
    });
    const cont = findByTestId(tree, 'intent-fab-starter-continue');
    (cont?.props.onClick as () => void)();
    expect(onContinue).toHaveBeenCalledWith({ kind: 'text', value: 'Park Royal walkout tonight' });
  });

  it('Pick-a-kind link calls onPickKind', () => {
    const onPickKind = vi.fn();
    const tree = render({
      open: true,
      onClose: () => {},
      onContinue: () => {},
      onPickKind,
    });
    const link = findByTestId(tree, 'intent-fab-starter-pick-kind');
    (link?.props.onClick as () => void)();
    expect(onPickKind).toHaveBeenCalledTimes(1);
  });

  it('paste button reads clipboard and writes the result into state', async () => {
    const readText = vi.fn().mockResolvedValue('www.example.com');
    vi.stubGlobal('navigator', { clipboard: { readText } } as unknown as Navigator);
    const tree = render({
      open: true,
      onClose: () => {},
      onContinue: () => {},
      onPickKind: () => {},
    });
    const paste = findByTestId(tree, 'intent-fab-starter-paste');
    await (paste?.props.onClick as () => Promise<void>)();
    expect(readText).toHaveBeenCalledTimes(1);
    expect(stateSlots[0]).toBe('www.example.com');
  });

  it('paste button shows a quiet inline note when clipboard read is denied', async () => {
    const readText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { readText } } as unknown as Navigator);
    const tree = render({
      open: true,
      onClose: () => {},
      onContinue: () => {},
      onPickKind: () => {},
    });
    const paste = findByTestId(tree, 'intent-fab-starter-paste');
    await (paste?.props.onClick as () => Promise<void>)();
    // pasteNote is the second useState slot
    expect(stateSlots[1]).toMatch(/couldn't read your clipboard/);
    // re-render to verify the note surfaces
    const tree2 = render({
      open: true,
      onClose: () => {},
      onContinue: () => {},
      onPickKind: () => {},
    });
    expect(findByTestId(tree2, 'intent-fab-starter-paste-note')).toBeDefined();
  });

  it('close button fires onClose', () => {
    const onClose = vi.fn();
    const tree = render({
      open: true,
      onClose,
      onContinue: () => {},
      onPickKind: () => {},
    });
    const close = findByTestId(tree, 'intent-fab-starter-close');
    (close?.props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
