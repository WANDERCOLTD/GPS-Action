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
    // No-op effect — diagnostic hydrate probe doesn't need to fire in
    // tree-walk tests.
    useEffect: () => undefined,
  };
});

const pushSpy = vi.fn<(href: string) => void>();
let pathnameValue: string = '/feed';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
  usePathname: () => pathnameValue,
}));

// IntentFabSheet imports Radix + JSX modules that don't survive this test's
// transform; stub it. The sheet's open/close lives on Dialog.Root now, so
// we check Dialog.Root's `open` prop on the rendered tree.
vi.mock('@/components/IntentFabSheet', () => ({
  IntentFabSheet: () => null,
}));

// Radix Dialog primitives — pass-throughs so flatChildren can walk into them.
vi.mock('@radix-ui/react-dialog', () => {
  const Root = ({ children }: { children?: ReactElement }) => children as ReactElement;
  const Trigger = ({ children }: { children?: ReactElement }) => children as ReactElement;
  return { Root, Trigger };
});

const Dialog = await import('@radix-ui/react-dialog');

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
  const root = findByType(tree, Dialog.Root);
  return Boolean(root?.props.open);
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
    pathnameValue = '/feed';
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

  // Sub-build D Item 15 — clarity affordances: title attrs (desktop
  // hover tooltips), visible captions (mobile/PWA where there's no
  // hover), and a stronger divider so the pill reads as two buttons.
  it('Item 15: each half carries a desktop title attribute', () => {
    const tree = render();
    const primary = findByTestId(tree, 'intent-fab-button-primary');
    const paste = findByTestId(tree, 'intent-fab-button-paste');
    expect(primary?.props.title).toBe('Create a post');
    expect(paste?.props.title).toBe('Paste a link');
  });

  it('Item 15: each half renders a visible caption ("Post" / "Paste") for mobile', () => {
    const tree = render();
    const primaryCaption = findByTestId(tree, 'intent-fab-caption-primary');
    const pasteCaption = findByTestId(tree, 'intent-fab-caption-paste');
    expect(primaryCaption?.props.children).toBe('Post');
    expect(pasteCaption?.props.children).toBe('Paste');
  });

  it('Item 15: paste-half divider uses ~50% opacity (was 25%)', () => {
    const tree = render();
    const paste = findByTestId(tree, 'intent-fab-button-paste');
    const style = paste?.props.style as { borderLeft?: string };
    // The divider is the only border-left on the paste half. Bumped
    // from 25% to 50% so the two halves no longer blend visually.
    expect(style?.borderLeft).toBeDefined();
    expect(style?.borderLeft).toMatch(/50%/);
    expect(style?.borderLeft).not.toMatch(/25%/);
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

    // Primary button is a Dialog.Trigger child — clicking it dispatches
    // through Radix, which calls Dialog.Root's onOpenChange. Simulate that
    // directly so the test doesn't need a DOM + the real Radix runtime.
    const root = findByType(tree1, Dialog.Root);
    (root?.props.onOpenChange as (o: boolean) => void)(true);

    const tree2 = render();
    expect(sheetIsOpen(tree2)).toBe(true);
  });

  it('primary button is wrapped in Dialog.Trigger (Radix handles open click, dodges iOS ghost-click race)', () => {
    const tree = render();
    const trigger = findByType(tree, Dialog.Trigger);
    expect(trigger).toBeDefined();
    // The Trigger contains the primary button (asChild forwards props onto it).
    const primaryUnderTrigger = trigger && findByTestId(trigger, 'intent-fab-button-primary');
    expect(primaryUnderTrigger).toBeDefined();
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

  it('returns null on /network (FAB suppressed on read-only inbound surface)', () => {
    pathnameValue = '/network';
    const tree = render();
    expect(tree).toBeNull();
  });

  it('returns null on /network/* sub-routes', () => {
    pathnameValue = '/network/some-subroute';
    const tree = render();
    expect(tree).toBeNull();
  });

  it('still renders on /feed', () => {
    pathnameValue = '/feed';
    const tree = render();
    expect(tree).not.toBeNull();
    expect(findByTestId(tree, 'intent-fab')).toBeDefined();
  });
});
