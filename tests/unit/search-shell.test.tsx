/**
 * Unit tests for SearchShell — typeahead + full-results + recently-viewed.
 *
 * @build-unit BU-search-surface
 * @spec architecture/decision-log.md (D078)
 * @spec build/session-briefs/bu-search-surface.md
 *
 * Same plain-function-as-component pattern as the IntentFabSheet tests:
 * we mock React's stateful hooks (useState) so the component can be
 * invoked directly. Asserts the contract of the shell — autofocused
 * input, optional scope chip, empty-state placeholders, back button
 * wired to router.back(), grouped result rendering, See-all links,
 * honest no-results copy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import type {
  SearchResults,
  PostSearchHit,
  PersonSearchHit,
  RegionSearchHit,
} from '@/server/routers/search';

// ── Hit factories — minimum-fields helpers for the new per-entity shapes
//    (BU-search-result-cards). Keep tests terse.

function makePostHit(overrides: Partial<PostSearchHit> = {}): PostSearchHit {
  return {
    id: 'p1',
    href: '/post/p1',
    title: 'A post',
    kindSlug: 'thought',
    kindDisplayName: 'Thought',
    urgency: false,
    signal: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    author: { id: 'u1', displayName: 'Author', roles: [] },
    ...overrides,
  };
}

function makePersonHit(overrides: Partial<PersonSearchHit> = {}): PersonSearchHit {
  return {
    id: 'u1',
    href: '/profile/u1',
    displayName: 'Person',
    roles: [],
    ...overrides,
  };
}

function makeRegionHit(overrides: Partial<RegionSearchHit> = {}): RegionSearchHit {
  return {
    id: 'r1',
    href: '/regions/foo',
    displayName: 'Foo',
    slug: 'foo',
    ...overrides,
  };
}

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
      const setter = (next: T): void => {
        stateSlots[idx] = next;
      };
      const value = (idx in stateSlots ? stateSlots[idx] : init) as T;
      return [value, setter] as const;
    },
    useEffect: () => undefined,
    useTransition: () => [false, (cb: () => void) => cb()] as const,
    useRef: <T,>(init: T) => {
      const idx = refIdx++;
      if (!refSlots[idx]) refSlots[idx] = { current: init };
      return refSlots[idx] as { current: T };
    },
    useMemo: <T,>(factory: () => T) => factory(),
  };
});

const backSpy = vi.fn();
const refreshSpy = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backSpy, refresh: refreshSpy, push: vi.fn() }),
}));

const { SearchShell } = await import('@/components/SearchShell');

const noopRunSearch = vi.fn(async () => emptyResults());

function emptyResults(): SearchResults {
  return { posts: [], people: [], regions: [], partnerOrgs: [], tickets: [], comments: [] };
}

function makeResults(overrides: Partial<SearchResults> = {}): SearchResults {
  return { ...emptyResults(), ...overrides };
}

type AnyElement = ReactElement<Record<string, unknown>>;

function flatChildren(el: AnyElement): AnyElement[] {
  const acc: AnyElement[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const e = node as AnyElement;
    acc.push(e);
    // Expand function components — SearchShell delegates to ZeroState
    // and ResultsView sub-components and the walker would otherwise
    // stop at the boundary. Hook calls inside expanded components
    // resolve via the mocks declared above.
    if (typeof e.type === 'function') {
      try {
        const rendered = (e.type as (props: unknown) => unknown)(e.props);
        walk(rendered);
      } catch {
        // Children rendering may reach an unmocked boundary; skip.
      }
      return;
    }
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

function findAllByTestId(el: AnyElement, testId: string): AnyElement[] {
  return flatChildren(el).filter((e) => e.props['data-testid'] === testId);
}

function resetSlots(): void {
  stateSlots.length = 0;
  slotIdx = 0;
  refSlots.length = 0;
  refIdx = 0;
}

beforeEach(() => {
  resetSlots();
  backSpy.mockReset();
  refreshSpy.mockReset();
  noopRunSearch.mockClear();
});

describe('SearchShell — shell basics', () => {
  it('renders the canonical shell testids in zero-state', () => {
    const tree = SearchShell({ runSearch: noopRunSearch }) as AnyElement;
    expect(findByTestId(tree, 'search-shell')).toBeDefined();
    expect(findByTestId(tree, 'search-header')).toBeDefined();
    expect(findByTestId(tree, 'nav-history-back-button')).toBeDefined();
    expect(findByTestId(tree, 'search-title')).toBeDefined();
    expect(findByTestId(tree, 'search-input-form')).toBeDefined();
    expect(findByTestId(tree, 'search-input-query')).toBeDefined();
    expect(findByTestId(tree, 'search-empty-recently-viewed')).toBeDefined();
    expect(findByTestId(tree, 'search-empty-your-regions')).toBeDefined();
  });

  it('renders the search input with the right keyboard hints', () => {
    const tree = SearchShell({ runSearch: noopRunSearch }) as AnyElement;
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
    const tree = SearchShell({
      runSearch: noopRunSearch,
      initialQuery: 'hendon',
    }) as AnyElement;
    const input = findByTestId(tree, 'search-input-query');
    expect(input?.props.value).toBe('hendon');
  });

  it('omits the scope chip when no filter is inherited', () => {
    const tree = SearchShell({ runSearch: noopRunSearch }) as AnyElement;
    expect(findByTestId(tree, 'search-scope-chip')).toBeUndefined();
  });

  it('renders the scope chip with the filter label when filter is inherited', () => {
    const tree = SearchShell({
      runSearch: noopRunSearch,
      initialFilter: 'urgent',
    }) as AnyElement;
    const chip = findByTestId(tree, 'search-scope-chip');
    expect(chip).toBeDefined();
    expect(chip?.props['data-filter']).toBe('urgent');
    expect(chip?.props['aria-label']).toBe('Remove Urgent scope');
  });

  it('renders the history back button in the header with the /feed fallback', () => {
    const tree = SearchShell({ runSearch: noopRunSearch }) as AnyElement;
    const button = findByTestId(tree, 'nav-history-back-button');
    expect(button).toBeDefined();
    expect(button?.props['aria-label']).toBe('Back');
    expect(button?.props['data-fallback']).toBe('/feed');
  });
});

describe('SearchShell — typeahead results', () => {
  it('renders grouped results when initialResults is populated and a query is set', () => {
    const initialResults = makeResults({
      posts: [makePostHit({ id: 'p1', title: 'Hendon march tomorrow', href: '/post/p1' })],
      people: [makePersonHit({ id: 'u1', displayName: 'Sharon Cohen', href: '/profile/u1' })],
      regions: [
        makeRegionHit({ id: 'r1', displayName: 'Hendon', href: '/regions/hendon', slug: 'hendon' }),
      ],
    });
    const tree = SearchShell({
      runSearch: noopRunSearch,
      initialQuery: 'hendon',
      initialResults,
    }) as AnyElement;
    const sections = findAllByTestId(tree, 'search-results-section');
    expect(sections.map((s) => s.props['data-entity-type'])).toEqual([
      'posts',
      'people',
      'regions',
    ]);
  });

  it('renders See-all link with q + type + filter on each non-empty group', () => {
    const initialResults = makeResults({
      posts: [makePostHit()],
    });
    const tree = SearchShell({
      runSearch: noopRunSearch,
      initialQuery: 'hendon',
      initialFilter: 'urgent',
      initialResults,
    }) as AnyElement;
    const link = findByTestId(tree, 'search-see-all-link');
    expect(link?.props['data-entity-type']).toBe('posts');
    expect(link?.props.href).toBe('/search?q=hendon&type=posts&filter=urgent');
  });

  it('omits empty groups in typeahead mode', () => {
    const initialResults = makeResults({
      posts: [makePostHit()],
      // people, regions, partnerOrgs all empty
    });
    const tree = SearchShell({
      runSearch: noopRunSearch,
      initialQuery: 'hendon',
      initialResults,
    }) as AnyElement;
    const sections = findAllByTestId(tree, 'search-results-section');
    expect(sections.length).toBe(1);
    expect(sections[0]?.props['data-entity-type']).toBe('posts');
  });

  it('shows honest no-results copy when query is set but all groups empty', () => {
    const tree = SearchShell({
      runSearch: noopRunSearch,
      initialQuery: 'xyzqwerty',
      initialResults: emptyResults(),
    }) as AnyElement;
    const noResults = findByTestId(tree, 'search-no-results');
    expect(noResults).toBeDefined();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Nothing matching that yet');
    expect(treeStr).not.toContain('No results found');
  });

  it('renders result-item testids with entity_type + position', () => {
    const initialResults = makeResults({
      posts: [
        makePostHit({ id: 'p1', title: 'A', href: '/post/p1' }),
        makePostHit({ id: 'p2', title: 'B', href: '/post/p2' }),
      ],
    });
    const tree = SearchShell({
      runSearch: noopRunSearch,
      initialQuery: 'ab',
      initialResults,
    }) as AnyElement;
    const items = findAllByTestId(tree, 'search-result-item');
    expect(items.length).toBe(2);
    expect(items[0]?.props['data-entity-type']).toBe('posts');
    expect(items[0]?.props['data-position']).toBe(0);
    expect(items[1]?.props['data-position']).toBe(1);
  });
});

describe('SearchShell — full mode', () => {
  it('renders only the selected group in full mode', () => {
    const initialResults = makeResults({
      posts: [makePostHit()],
      people: [makePersonHit({ displayName: 'Sharon' })],
    });
    const tree = SearchShell({
      runSearch: noopRunSearch,
      mode: 'full',
      selectedType: 'posts',
      initialQuery: 'hendon',
      initialResults,
    }) as AnyElement;
    const sections = findAllByTestId(tree, 'search-results-section');
    expect(sections.length).toBe(1);
    expect(sections[0]?.props['data-entity-type']).toBe('posts');
  });

  it('shows the empty-group copy in full mode when the selected group is empty', () => {
    const tree = SearchShell({
      runSearch: noopRunSearch,
      mode: 'full',
      selectedType: 'people',
      initialQuery: 'noresult',
      initialResults: emptyResults(),
    }) as AnyElement;
    expect(findByTestId(tree, 'search-results-empty-group')).toBeDefined();
  });

  it('renders the limit notice when full mode returns exactly 50 hits', () => {
    const fifty = Array.from({ length: 50 }, (_, i) =>
      makePostHit({ id: `p${i}`, title: `Post ${i}`, href: `/post/p${i}` }),
    );
    const tree = SearchShell({
      runSearch: noopRunSearch,
      mode: 'full',
      selectedType: 'posts',
      initialQuery: 'hendon',
      initialResults: makeResults({ posts: fifty }),
    }) as AnyElement;
    expect(findByTestId(tree, 'search-results-limit-notice')).toBeDefined();
  });

  it('does not render the See-all link in full mode', () => {
    const initialResults = makeResults({
      posts: [makePostHit()],
    });
    const tree = SearchShell({
      runSearch: noopRunSearch,
      mode: 'full',
      selectedType: 'posts',
      initialQuery: 'hendon',
      initialResults,
    }) as AnyElement;
    expect(findByTestId(tree, 'search-see-all-link')).toBeUndefined();
  });

  it('reflects the selected group in the page title', () => {
    const tree = SearchShell({
      runSearch: noopRunSearch,
      mode: 'full',
      selectedType: 'people',
      initialQuery: 'sharon',
      initialResults: emptyResults(),
    }) as AnyElement;
    const title = findByTestId(tree, 'search-title');
    const titleStr = JSON.stringify(title);
    expect(titleStr).toContain('People');
  });
});

describe('SearchShell — copy guards', () => {
  it('renders honest zero-state copy (not "No results found")', () => {
    const tree = SearchShell({ runSearch: noopRunSearch }) as AnyElement;
    const treeStr = JSON.stringify(tree);
    expect(treeStr).not.toContain('No results found');
  });

  it('section headings are not "Trending" or "Hot now" (anxiety-amplification rule)', () => {
    const tree = SearchShell({ runSearch: noopRunSearch }) as AnyElement;
    const treeStr = JSON.stringify(tree);
    expect(treeStr).not.toContain('Trending');
    expect(treeStr).not.toContain('Hot now');
  });
});
