/**
 * Unit tests for the Discussion component (bu-ticket-view-fixes
 * Sub-build C, Items 8 / 9 / 10 / 11 / 12).
 *
 * Vitest env is `node`. Same pattern as `app-nav.test.tsx` — mock the
 * next/navigation hooks, mock useState / useTransition / useMemo /
 * useEffect, call the component as a plain function, walk the
 * ReactElement tree by data-testid.
 *
 * @build-unit bu-ticket-view-fixes
 * @spec docs/build/session-briefs/bu-ticket-view-fixes.md
 * @adr 0016
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const useTransitionMock = vi.fn<() => [boolean, (cb: () => void) => void]>(() => [
  false,
  (cb: () => void) => cb(),
]);

const stateRefs: Record<string, unknown> = {};
let stateIdx = 0;
const useStateMock = vi.fn(<T,>(initial: T): [T, (value: T) => void] => {
  const key = `s${stateIdx++}`;
  if (!(key in stateRefs)) stateRefs[key] = initial;
  return [stateRefs[key] as T, (v: T) => void (stateRefs[key] = v)];
});

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useTransition: () => useTransitionMock(),
    useState: <T,>(initial: T) => useStateMock(initial),
    useEffect: () => undefined,
    // Pass-through useMemo so memoised arrays are computed every call.
    useMemo: <T,>(fn: () => T) => fn(),
  };
});

const routerReplaceSpy = vi.fn();
const searchParamsValue: { value: URLSearchParams } = { value: new URLSearchParams() };

vi.mock('next/navigation', () => ({
  usePathname: () => '/board/writers/r1',
  useRouter: () => ({ replace: routerReplaceSpy, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParamsValue.value,
}));

const postCommentSpy = vi.fn(async (_input: unknown) => ({ ok: true }));
const postNoteSpy = vi.fn(async (_input: unknown) => ({ ok: true }));
const editSpy = vi.fn(async (_input: unknown) => ({ ok: true }));
const deleteSpy = vi.fn(async (_input: unknown) => ({ ok: true }));

vi.mock('@/app/board/[groupSlug]/[ticketId]/actions', () => ({
  postCommentAction: (input: unknown) => postCommentSpy(input),
  postNoteAction: (input: unknown) => postNoteSpy(input),
  editCommentAction: (input: unknown) => editSpy(input),
  deleteCommentAction: (input: unknown) => deleteSpy(input),
}));

const { Discussion } = await import('@/components/board/Discussion');

type AnyElement = ReactElement<Record<string, unknown>>;

/**
 * Resolve a React node to a fully-expanded plain-element tree by
 * eagerly invoking every function component with its props. This
 * happens ONCE per `renderTree` call so the global `stateIdx`
 * counter is consumed deterministically. Subsequent `findByTestId`
 * walks operate on the resolved tree without re-invoking components.
 */
interface ResolvedHostNode {
  type: string;
  props: Record<string, unknown>;
  children: ResolvedNode[];
}
type ResolvedNode = ResolvedHostNode | string | number | boolean | null;

function isHost(n: ResolvedNode | undefined): n is ResolvedHostNode {
  return !!n && typeof n === 'object';
}

function resolveTree(node: unknown): ResolvedNode {
  if (node == null || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return node;
  if (typeof node !== 'object' || !('props' in (node as object))) return null;
  const el = node as AnyElement;
  if (typeof el.type === 'function') {
    const Comp = el.type as (p: Record<string, unknown>) => unknown;
    try {
      const out = Comp((el.props ?? {}) as Record<string, unknown>);
      return resolveTree(out);
    } catch {
      return null;
    }
  }
  // Host element.
  const props = (el.props ?? {}) as Record<string, unknown>;
  const childList: ResolvedNode[] = [];
  const c = props.children;
  if (c != null) {
    const list = Array.isArray(c) ? c.flat(Infinity) : [c];
    for (const ch of list) childList.push(resolveTree(ch));
  }
  return { type: el.type as string, props, children: childList };
}

function findByTestId(tree: ResolvedNode, testid: string): ResolvedHostNode | undefined {
  if (!isHost(tree)) return undefined;
  if (tree.props['data-testid'] === testid) return tree;
  for (const child of tree.children) {
    const found = findByTestId(child, testid);
    if (found) return found;
  }
  return undefined;
}

function findAllByTestId(tree: ResolvedNode, testid: string): ResolvedHostNode[] {
  const acc: ResolvedHostNode[] = [];
  function walk(n: ResolvedNode): void {
    if (!isHost(n)) return;
    if (n.props['data-testid'] === testid) acc.push(n);
    for (const child of n.children) walk(child);
  }
  walk(tree);
  return acc;
}

function renderTree(
  component: (props: Record<string, unknown>) => unknown,
  props: Record<string, unknown>,
): ResolvedNode {
  // Reset state index so a fresh render consumes useState slots
  // deterministically — independent of any earlier render in the same
  // test (each test does an exclusive call to renderTree before
  // assertions).
  stateIdx = 0;
  return resolveTree(component(props));
}

const baseProps = {
  requestId: 'r1',
  groupSlug: 'writers',
  viewerId: 'u1',
  canPostNote: true,
};

const sharon = { id: 'u1', displayName: 'Sharon Cohen', avatarUrl: null };
const bette = { id: 'u2', displayName: 'Bette', avatarUrl: 'https://x/a.png' };

const commentRow = {
  id: 'c1',
  body: 'Hello team',
  kind: 'comment' as const,
  source: 'human' as const,
  createdAt: new Date('2026-05-05T10:00:00Z'),
  updatedAt: new Date('2026-05-05T10:00:00Z'),
  author: sharon,
};

const editedRow = {
  id: 'c2',
  body: 'I edited this',
  kind: 'comment' as const,
  source: 'human' as const,
  createdAt: new Date('2026-05-05T10:00:00Z'),
  updatedAt: new Date('2026-05-05T10:30:00Z'),
  author: sharon,
};

const olderRow = {
  id: 'c0',
  body: 'older comment',
  kind: 'comment' as const,
  source: 'human' as const,
  createdAt: new Date('2026-05-04T10:00:00Z'),
  updatedAt: new Date('2026-05-04T10:00:00Z'),
  author: sharon,
};

const someoneElsesRow = {
  id: 'c3',
  body: 'Bette wrote this',
  kind: 'comment' as const,
  source: 'human' as const,
  createdAt: new Date('2026-05-05T10:00:00Z'),
  updatedAt: new Date('2026-05-05T10:00:00Z'),
  author: bette,
};

const noteRow = {
  id: 'n1',
  body: 'Internal note',
  kind: 'note' as const,
  source: 'human' as const,
  createdAt: new Date('2026-05-05T10:05:00Z'),
  updatedAt: new Date('2026-05-05T10:05:00Z'),
  author: sharon,
};

const systemRow = {
  id: 's1',
  body: 'Card moved to Review',
  kind: 'comment' as const,
  source: 'system' as const,
  createdAt: new Date('2026-05-05T10:10:00Z'),
  updatedAt: new Date('2026-05-05T10:10:00Z'),
  author: { id: 'system', displayName: 'System', avatarUrl: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  stateIdx = 0;
  for (const key of Object.keys(stateRefs)) delete stateRefs[key];
  useTransitionMock.mockReturnValue([false, (cb: () => void) => cb()]);
  searchParamsValue.value = new URLSearchParams();
});

describe('Discussion — tabs (Items 8, 12)', () => {
  it('renders Comments + Log tabs with count badges', () => {
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [commentRow, noteRow, systemRow],
    });
    expect(findByTestId(tree, 'board-discussion-tablist')).toBeDefined();
    expect(findByTestId(tree, 'board-discussion-tab-comments')).toBeDefined();
    expect(findByTestId(tree, 'board-discussion-tab-log')).toBeDefined();
    const commentsCount = findByTestId(tree, 'board-discussion-tab-comments-count');
    expect(JSON.stringify(commentsCount?.props.children)).toContain('2');
    const logCount = findByTestId(tree, 'board-discussion-tab-log-count');
    expect(JSON.stringify(logCount?.props.children)).toContain('1');
  });

  it('Comments tab is the default when no ?tab= search-param', () => {
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [commentRow],
    });
    expect(findByTestId(tree, 'board-discussion-panel-comments')).toBeDefined();
    expect(findByTestId(tree, 'board-discussion-panel-log')).toBeUndefined();
  });

  it('Log tab is active when ?tab=log is present', () => {
    searchParamsValue.value = new URLSearchParams('tab=log');
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [systemRow],
    });
    expect(findByTestId(tree, 'board-discussion-panel-log')).toBeDefined();
    expect(findByTestId(tree, 'board-discussion-panel-comments')).toBeUndefined();
  });

  it('Comments tab orders newest-first (Item 12)', () => {
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [olderRow, commentRow],
    });
    const rows = findAllByTestId(tree, 'board-ticket-thread-row');
    // Newest commentRow (10:00 today) should appear before olderRow (yesterday).
    expect(rows[0]?.props['data-kind']).toBe('comment');
    // Body content check via deep walk — commentRow body should sort first.
    const firstBody = JSON.stringify(rows[0]?.props.children);
    expect(firstBody).toContain('Hello team');
  });

  it('System rows route to the Log tab; Comments tab excludes them', () => {
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [commentRow, systemRow],
    });
    const rows = findAllByTestId(tree, 'board-ticket-thread-row');
    // We're on Comments tab by default — only the human row is shown.
    expect(rows.length).toBe(1);
    expect(rows[0]?.props['data-kind']).toBe('comment');
  });
});

describe('Discussion — compose at top, collapsed (Item 11)', () => {
  it('renders the collapsed toggle by default', () => {
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [],
    });
    expect(findByTestId(tree, 'board-ticket-thread-compose-toggle')).toBeDefined();
    expect(findByTestId(tree, 'board-ticket-thread-compose')).toBeUndefined();
  });

  it('expanded compose state shows mode tabs + textarea + Post + Cancel', () => {
    // expanded=true is `s0` of CommentCompose. Component-tree state
    // ordering is: Discussion(s0=tab) → CommentsTab → CommentCompose
    // (s1=expanded, s2=mode, s3=draft, s4=error). With one row in rows
    // → no row-level state, so we set s1=true.
    stateRefs.s1 = true;
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [],
    });
    expect(findByTestId(tree, 'board-ticket-thread-compose')).toBeDefined();
    expect(findByTestId(tree, 'board-ticket-thread-tab-tablist')).toBeDefined();
    expect(findByTestId(tree, 'board-ticket-thread-input')).toBeDefined();
    expect(findByTestId(tree, 'board-ticket-thread-submit-btn')).toBeDefined();
    expect(findByTestId(tree, 'board-ticket-thread-cancel-btn')).toBeDefined();
  });

  it('hides the Note tab when canPostNote=false (cross-team viewer)', () => {
    stateRefs.s1 = true; // expanded
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      canPostNote: false,
      rows: [],
    });
    expect(findByTestId(tree, 'board-ticket-thread-tab-tablist')).toBeUndefined();
  });
});

describe('Discussion — submit dispatch', () => {
  it('calls postCommentAction with the trimmed body in comment mode', () => {
    stateRefs.s1 = true; // expanded
    stateRefs.s2 = 'comment'; // mode
    stateRefs.s3 = '  hi team  '; // draft
    stateRefs.s4 = null; // error
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [],
    });
    const btn = findByTestId(tree, 'board-ticket-thread-submit-btn');
    (btn?.props.onClick as () => void)();
    expect(postCommentSpy).toHaveBeenCalledWith({
      requestId: 'r1',
      groupSlug: 'writers',
      body: 'hi team',
    });
    expect(postNoteSpy).not.toHaveBeenCalled();
  });

  it('calls postNoteAction in note mode', () => {
    stateRefs.s1 = true;
    stateRefs.s2 = 'note';
    stateRefs.s3 = 'team-only';
    stateRefs.s4 = null;
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [],
    });
    const btn = findByTestId(tree, 'board-ticket-thread-submit-btn');
    (btn?.props.onClick as () => void)();
    expect(postNoteSpy).toHaveBeenCalledWith({
      requestId: 'r1',
      groupSlug: 'writers',
      body: 'team-only',
    });
    expect(postCommentSpy).not.toHaveBeenCalled();
  });

  it('disables submit while a transition is pending', () => {
    useTransitionMock.mockReturnValue([true, (cb: () => void) => cb()]);
    stateRefs.s1 = true;
    stateRefs.s2 = 'comment';
    stateRefs.s3 = 'pending text';
    stateRefs.s4 = null;
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [],
    });
    const btn = findByTestId(tree, 'board-ticket-thread-submit-btn');
    expect(btn?.props.disabled).toBe(true);
  });
});

describe('Discussion — edit / delete affordances (Item 10 / ADR-0016)', () => {
  it('shows edit + delete buttons on own human comment', () => {
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [commentRow],
    });
    expect(findByTestId(tree, 'board-ticket-thread-edit-btn')).toBeDefined();
    expect(findByTestId(tree, 'board-ticket-thread-delete-btn')).toBeDefined();
  });

  it('hides affordances on someone else’s comment', () => {
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [someoneElsesRow],
    });
    expect(findByTestId(tree, 'board-ticket-thread-edit-btn')).toBeUndefined();
    expect(findByTestId(tree, 'board-ticket-thread-delete-btn')).toBeUndefined();
  });

  it('hides affordances on system rows even if ids would match', () => {
    const sharonSystemRow = { ...systemRow, author: sharon };
    searchParamsValue.value = new URLSearchParams('tab=log');
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [sharonSystemRow],
    });
    expect(findByTestId(tree, 'board-ticket-thread-edit-btn')).toBeUndefined();
    expect(findByTestId(tree, 'board-ticket-thread-delete-btn')).toBeUndefined();
  });

  it('renders an "(edited)" marker when updatedAt > createdAt + epsilon', () => {
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [editedRow],
    });
    expect(findByTestId(tree, 'board-ticket-thread-edited-marker')).toBeDefined();
  });

  it('does NOT render the "(edited)" marker on a fresh comment', () => {
    const tree = renderTree(Discussion as unknown as (p: Record<string, unknown>) => unknown, {
      ...baseProps,
      rows: [commentRow],
    });
    expect(findByTestId(tree, 'board-ticket-thread-edited-marker')).toBeUndefined();
  });
});
