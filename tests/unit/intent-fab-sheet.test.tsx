/**
 * @build-unit BU-feed-card-affordances BU-link-first-composer
 * @spec build/session-briefs/bu-feed-card-affordances.md
 *
 * Same plain-function-as-component pattern as the FAB / paste-handler
 * unit tests: we mock React's stateful hooks so a stateful component
 * can be invoked directly and the resulting JSX tree walked. Radix's
 * components are stubbed too so the test doesn't depend on the live
 * Dialog primitives.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

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
    // The IntentFabSheet's clipboard-feature-detection effect is a
    // post-mount side effect; the tree-walk tests don't need it to run.
    useEffect: () => undefined,
    // useRef stub — the iOS ghost-click guard refs `openedAt`, but
    // tree-walking tests don't exercise pointer events.
    useRef: <T,>(initial: T) => ({ current: initial }),
  };
});

const pushSpy = vi.fn<(href: string) => void>();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

// Pass-through stubs for the Radix Dialog primitives so flatChildren
// can walk into them and find our testid'd elements.
vi.mock('@radix-ui/react-dialog', () => {
  const passThrough = ({ children }: { children?: ReactNode }) => children as ReactElement;
  return {
    Root: passThrough,
    Portal: passThrough,
    Overlay: passThrough,
    Content: passThrough,
    Title: passThrough,
  };
});

const { IntentFabSheet } = await import('@/components/IntentFabSheet');

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

function findAllByTestId(el: AnyElement, testId: string): AnyElement[] {
  return flatChildren(el).filter((e) => e.props['data-testid'] === testId);
}

function resetState(): void {
  stateSlots.length = 0;
  slotIdx = 0;
}

function render(props: Parameters<typeof IntentFabSheet>[0]): AnyElement | null {
  slotIdx = 0;
  return IntentFabSheet(props) as AnyElement | null;
}

describe('IntentFabSheet', () => {
  beforeEach(() => {
    resetState();
    pushSpy.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when open is false', () => {
    const tree = render({ open: false, onClose: () => {} });
    expect(tree).toBeNull();
  });

  it('renders the input, hint, and tile grid with canonical testids (paste button gated on clipboard support)', () => {
    const tree = render({ open: true, onClose: () => {} });
    expect(findByTestId(tree, 'intent-fab-sheet')).toBeDefined();
    expect(findByTestId(tree, 'intent-fab-input')).toBeDefined();
    expect(findByTestId(tree, 'intent-fab-hint')).toBeDefined();
    expect(findByTestId(tree, 'intent-fab-tile-grid')).toBeDefined();
    expect(findByTestId(tree, 'intent-fab-close')).toBeDefined();
  });

  it('renders the paste button when clipboardSupported state is true', () => {
    // clipboardSupported is the third useState slot (after input + pasteNote)
    stateSlots[2] = true;
    const tree = render({ open: true, onClose: () => {} });
    expect(findByTestId(tree, 'intent-fab-paste')).toBeDefined();
  });

  it('does not render the paste button when clipboardSupported is false', () => {
    const tree = render({ open: true, onClose: () => {} });
    expect(findByTestId(tree, 'intent-fab-paste')).toBeUndefined();
  });

  it('textarea placeholder includes the long-press hint when clipboardSupported is false', () => {
    const tree = render({ open: true, onClose: () => {} });
    const input = findByTestId(tree, 'intent-fab-input');
    expect(input?.props.placeholder).toMatch(/tap and hold/i);
  });

  it('textarea placeholder is plain when clipboardSupported is true', () => {
    stateSlots[2] = true;
    const tree = render({ open: true, onClose: () => {} });
    const input = findByTestId(tree, 'intent-fab-input');
    expect(input?.props.placeholder).not.toMatch(/tap and hold/i);
    expect(input?.props.placeholder).toMatch(/paste a link/i);
  });

  it('renders enabled and disabled tiles distinctly', () => {
    const tree = render({ open: true, onClose: () => {} });
    const enabled = findAllByTestId(tree as AnyElement, 'intent-tile-pick');
    const disabled = findAllByTestId(tree as AnyElement, 'intent-tile-disabled');
    expect(enabled.length).toBeGreaterThan(0);
    expect(disabled.length).toBeGreaterThan(0);
  });

  it('hint kind is `none` when input is empty', () => {
    const tree = render({ open: true, onClose: () => {} });
    const hint = findByTestId(tree, 'intent-fab-hint');
    expect(hint?.props['data-hint-kind']).toBe('none');
  });

  it('hint kind is `url` when input looks like a link', () => {
    stateSlots[0] = 'www.example.com';
    const tree = render({ open: true, onClose: () => {} });
    expect(findByTestId(tree, 'intent-fab-hint')?.props['data-hint-kind']).toBe('url');
  });

  it('hint kind is `text` when input is free-form prose', () => {
    stateSlots[0] = 'Park Royal walkout tonight';
    const tree = render({ open: true, onClose: () => {} });
    expect(findByTestId(tree, 'intent-fab-hint')?.props['data-hint-kind']).toBe('text');
  });

  it('tapping a tile with no input routes to /compose with just the intent', () => {
    const onClose = vi.fn();
    const tree = render({ open: true, onClose });
    const tile = findAllByTestId(tree as AnyElement, 'intent-tile-pick')[0];
    (tile?.props.onClick as () => void)();
    expect(pushSpy).toHaveBeenCalledTimes(1);
    const href = pushSpy.mock.calls[0]?.[0] as string;
    expect(href).toMatch(/^\/compose\?intent=[a-z_]+$/);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tapping a tile with a URL in the input routes to /compose with intent + linkUrl', () => {
    stateSlots[0] = 'www.example.com';
    const tree = render({ open: true, onClose: () => {} });
    const tile = findAllByTestId(tree as AnyElement, 'intent-tile-pick')[0];
    (tile?.props.onClick as () => void)();
    const href = pushSpy.mock.calls[0]?.[0] as string;
    expect(href).toMatch(/intent=/);
    expect(href).toMatch(/linkUrl=https%3A%2F%2Fwww\.example\.com/);
  });

  it('tapping a tile with text in the input routes to /compose with intent + title', () => {
    stateSlots[0] = 'Park Royal walkout tonight';
    const tree = render({ open: true, onClose: () => {} });
    const tile = findAllByTestId(tree as AnyElement, 'intent-tile-pick')[0];
    (tile?.props.onClick as () => void)();
    const href = pushSpy.mock.calls[0]?.[0] as string;
    expect(href).toMatch(/intent=/);
    expect(href).toMatch(/title=Park\+Royal\+walkout\+tonight/);
  });

  it('disabled tiles have no onClick handler and render the disabled attribute', () => {
    const tree = render({ open: true, onClose: () => {} });
    const tile = findAllByTestId(tree as AnyElement, 'intent-tile-disabled')[0];
    expect(tile?.props.disabled).toBe(true);
    expect(tile?.props.onClick).toBeUndefined();
  });

  it('paste button reads clipboard and writes the result into state', async () => {
    const readText = vi.fn().mockResolvedValue('www.example.com');
    vi.stubGlobal('navigator', { clipboard: { readText } } as unknown as Navigator);
    stateSlots[2] = true; // clipboardSupported
    const tree = render({ open: true, onClose: () => {} });
    const paste = findByTestId(tree, 'intent-fab-paste');
    await (paste?.props.onClick as () => Promise<void>)();
    expect(readText).toHaveBeenCalledTimes(1);
    expect(stateSlots[0]).toBe('www.example.com');
  });

  it('paste shows a quiet inline note when clipboard read is denied', async () => {
    const readText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { readText } } as unknown as Navigator);
    stateSlots[2] = true; // clipboardSupported
    const tree = render({ open: true, onClose: () => {} });
    const paste = findByTestId(tree, 'intent-fab-paste');
    await (paste?.props.onClick as () => Promise<void>)();
    // pasteNote is the second useState slot
    expect(stateSlots[1]).toMatch(/long-press|paste/i);
    stateSlots[2] = true;
    const tree2 = render({ open: true, onClose: () => {} });
    expect(findByTestId(tree2, 'intent-fab-paste-note')).toBeDefined();
  });

  it('close button fires onClose', () => {
    const onClose = vi.fn();
    const tree = render({ open: true, onClose });
    const close = findByTestId(tree, 'intent-fab-close');
    (close?.props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
