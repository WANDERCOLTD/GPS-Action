/**
 * Unit tests for SearchShell — PR C of bu-search-surface.
 *
 * @build-unit BU-search-surface
 * @spec architecture/decision-log.md (D078)
 * @spec build/session-briefs/bu-search-surface.md
 *
 * Same plain-function-as-component pattern as the IntentFabSheet tests:
 * we mock React's stateful hooks (useState) so the component can be
 * invoked directly. Asserts the contract of the shell — autofocused
 * input, optional scope chip, empty-state placeholders, back button
 * wired to router.back().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const stateSlots: unknown[] = [];
let slotIdx = 0;

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: <T,>(init: T) => {
      const idx = slotIdx++;
      const setter = (next: T): void => {
        stateSlots[idx] = next;
      };
      const value = (idx in stateSlots ? stateSlots[idx] : init) as T;
      return [value, setter] as const;
    },
    // HeaderRefreshButton mounts a useTransition + a stylesheet effect;
    // tree walks don't need either to fire.
    useEffect: () => undefined,
    useTransition: () => [false, (cb: () => void) => cb()] as const,
  };
});

const backSpy = vi.fn();
const refreshSpy = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backSpy, refresh: refreshSpy, push: vi.fn() }),
}));

const { SearchShell } = await import('@/components/SearchShell');

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

function resetSlots(): void {
  stateSlots.length = 0;
  slotIdx = 0;
}

beforeEach(() => {
  resetSlots();
  backSpy.mockReset();
  refreshSpy.mockReset();
});

describe('SearchShell', () => {
  it('renders the canonical shell testids', () => {
    const tree = SearchShell({}) as AnyElement;
    expect(findByTestId(tree, 'search-shell')).toBeDefined();
    expect(findByTestId(tree, 'search-header')).toBeDefined();
    expect(findByTestId(tree, 'search-back-button')).toBeDefined();
    expect(findByTestId(tree, 'search-title')).toBeDefined();
    expect(findByTestId(tree, 'search-input-form')).toBeDefined();
    expect(findByTestId(tree, 'search-input-query')).toBeDefined();
    expect(findByTestId(tree, 'search-empty-recently-viewed')).toBeDefined();
    expect(findByTestId(tree, 'search-empty-your-regions')).toBeDefined();
  });

  it('renders the search input with the right keyboard hints', () => {
    const tree = SearchShell({}) as AnyElement;
    const input = findByTestId(tree, 'search-input-query');
    expect(input?.type).toBe('input');
    expect(input?.props.type).toBe('search');
    expect(input?.props.inputMode).toBe('search');
    expect(input?.props.enterKeyHint).toBe('search');
    expect(input?.props.autoComplete).toBe('off');
    expect(input?.props.autoFocus).toBe(true);
    expect(input?.props['aria-label']).toBe('Search query');
  });

  it('hydrates the input from initialQuery', () => {
    const tree = SearchShell({ initialQuery: 'hendon' }) as AnyElement;
    const input = findByTestId(tree, 'search-input-query');
    expect(input?.props.value).toBe('hendon');
  });

  it('omits the scope chip when no filter is inherited', () => {
    const tree = SearchShell({}) as AnyElement;
    expect(findByTestId(tree, 'search-scope-chip')).toBeUndefined();
  });

  it('renders the scope chip with the filter label when filter is inherited', () => {
    const tree = SearchShell({ initialFilter: 'urgent' }) as AnyElement;
    const chip = findByTestId(tree, 'search-scope-chip');
    expect(chip).toBeDefined();
    expect(chip?.props['data-filter']).toBe('urgent');
    expect(chip?.props['aria-label']).toBe('Remove Urgent scope');
  });

  it('back button calls router.back() when clicked', () => {
    const tree = SearchShell({}) as AnyElement;
    const button = findByTestId(tree, 'search-back-button');
    expect(button).toBeDefined();
    expect(button?.props['aria-label']).toBe('Back');
    const onClick = button?.props.onClick as () => void;
    onClick();
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('renders honest empty-state copy (not "No results found")', () => {
    const tree = SearchShell({}) as AnyElement;
    const recently = findByTestId(tree, 'search-empty-recently-viewed');
    const regions = findByTestId(tree, 'search-empty-your-regions');
    expect(recently).toBeDefined();
    expect(regions).toBeDefined();
    // Heading text in the section is the section name ("Recently
    // viewed" / "Your regions"). The placeholder copy is the secondary
    // body. We assert the testid presence + that the "no results"
    // anti-pattern copy is absent.
    const treeStr = JSON.stringify(tree);
    expect(treeStr).not.toContain('No results found');
  });

  it('section headings are not "Trending" or "Hot now" (anxiety-amplification rule)', () => {
    const tree = SearchShell({}) as AnyElement;
    const treeStr = JSON.stringify(tree);
    expect(treeStr).not.toContain('Trending');
    expect(treeStr).not.toContain('Hot now');
  });
});
