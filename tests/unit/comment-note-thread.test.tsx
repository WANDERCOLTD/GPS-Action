/**
 * Unit tests for the CommentNoteThread component (atom 5d-4).
 *
 * Vitest env is `node`. Same pattern as `board-action-pair.test.tsx` —
 * mock useTransition + useState + the server actions, call the
 * component as a plain function, walk the tree by data-testid.
 *
 * @build-unit bu-coordination-board
 * @spec docs/build/session-handoffs/parallel-stream-b-comment-thread-2026-05-05.md
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
  };
});

const postCommentSpy = vi.fn(async (_input: unknown) => ({ ok: true }));
const postNoteSpy = vi.fn(async (_input: unknown) => ({ ok: true }));

vi.mock('@/app/board/[groupSlug]/[ticketId]/actions', () => ({
  postCommentAction: (input: unknown) => postCommentSpy(input),
  postNoteAction: (input: unknown) => postNoteSpy(input),
}));

const { CommentNoteThread } = await import('@/components/board/CommentNoteThread');

type AnyElement = ReactElement<Record<string, unknown>>;

function findByTestId(node: unknown, testid: string): AnyElement | undefined {
  if (!node || typeof node !== 'object' || !('props' in node)) return undefined;
  const el = node as AnyElement;
  const props = (el.props ?? {}) as Record<string, unknown>;
  if (props['data-testid'] === testid) return el;
  const children = props.children;
  if (children == null) return undefined;
  const list = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const child of list) {
    const found = findByTestId(child, testid);
    if (found) return found;
  }
  return undefined;
}

function findAllByTestId(node: unknown, testid: string): AnyElement[] {
  const acc: AnyElement[] = [];
  function walk(n: unknown): void {
    if (!n || typeof n !== 'object' || !('props' in n)) return;
    const el = n as AnyElement;
    const props = (el.props ?? {}) as Record<string, unknown>;
    if (props['data-testid'] === testid) acc.push(el);
    const children = props.children;
    if (children == null) return;
    const list = Array.isArray(children) ? children.flat(Infinity) : [children];
    for (const child of list) walk(child);
  }
  walk(node);
  return acc;
}

const baseProps = { requestId: 'r1', groupSlug: 'writers', canPostNote: true };

const commentRow = {
  id: 'c1',
  body: 'Hello team',
  kind: 'comment' as const,
  source: 'human' as const,
  createdAt: new Date('2026-05-05T10:00:00Z'),
  author: { id: 'u1', displayName: 'Sharon Cohen', avatarUrl: null },
};

const noteRow = {
  id: 'n1',
  body: 'Internal note',
  kind: 'note' as const,
  source: 'human' as const,
  createdAt: new Date('2026-05-05T10:05:00Z'),
  author: { id: 'u2', displayName: 'Bette', avatarUrl: 'https://x/a.png' },
};

const systemRow = {
  id: 's1',
  body: 'Card moved to Review',
  kind: 'comment' as const,
  source: 'system' as const,
  createdAt: new Date('2026-05-05T10:10:00Z'),
  author: { id: 'system', displayName: 'System', avatarUrl: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  stateIdx = 0;
  for (const key of Object.keys(stateRefs)) delete stateRefs[key];
  useTransitionMock.mockReturnValue([false, (cb: () => void) => cb()]);
});

describe('CommentNoteThread — render branches', () => {
  it('renders empty-state copy when rows array is empty', () => {
    const tree = CommentNoteThread({ ...baseProps, rows: [] }) as AnyElement;
    expect(findByTestId(tree, 'board-ticket-thread-empty')).toBeDefined();
  });

  it('renders comment, note, and system rows with distinct data-kind attrs', () => {
    const tree = CommentNoteThread({
      ...baseProps,
      rows: [commentRow, noteRow, systemRow],
    }) as AnyElement;

    const rows = findAllByTestId(tree, 'board-ticket-thread-row');
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.props['data-kind'])).toEqual(['comment', 'note', 'system']);
  });

  it('note row carries the warning-subtle background and a Note label', () => {
    const tree = CommentNoteThread({ ...baseProps, rows: [noteRow] }) as AnyElement;
    const row = findAllByTestId(tree, 'board-ticket-thread-row')[0];
    expect(row?.props['data-kind']).toBe('note');
    const style = (row?.props.style ?? {}) as Record<string, string>;
    expect(style.background).toContain('--colour-warning-subtle');
    expect(findByTestId(tree, 'board-ticket-thread-note-label')).toBeDefined();
  });

  it('system row uses italic, smaller font and no Note label', () => {
    const tree = CommentNoteThread({ ...baseProps, rows: [systemRow] }) as AnyElement;
    const row = findAllByTestId(tree, 'board-ticket-thread-row')[0];
    expect(row?.props['data-kind']).toBe('system');
    const style = (row?.props.style ?? {}) as Record<string, string>;
    expect(style.fontStyle).toBe('italic');
    expect(findByTestId(tree, 'board-ticket-thread-note-label')).toBeUndefined();
  });
});

describe('CommentNoteThread — compose tab', () => {
  it('shows both Comment and Note tabs when canPostNote is true', () => {
    const tree = CommentNoteThread({ ...baseProps, rows: [] }) as AnyElement;
    expect(findByTestId(tree, 'board-ticket-thread-tab-comment')).toBeDefined();
    expect(findByTestId(tree, 'board-ticket-thread-tab-note')).toBeDefined();
  });

  it('hides the Note tab when canPostNote is false (cross-team viewer)', () => {
    const tree = CommentNoteThread({
      ...baseProps,
      canPostNote: false,
      rows: [],
    }) as AnyElement;
    expect(findByTestId(tree, 'board-ticket-thread-tab-comment')).toBeUndefined();
    expect(findByTestId(tree, 'board-ticket-thread-tab-note')).toBeUndefined();
  });

  it('compose container starts in comment mode', () => {
    const tree = CommentNoteThread({ ...baseProps, rows: [] }) as AnyElement;
    const compose = findByTestId(tree, 'board-ticket-thread-compose');
    expect(compose?.props['data-mode']).toBe('comment');
  });
});

describe('CommentNoteThread — submit dispatch', () => {
  it('calls postCommentAction with trimmed body when in comment mode', () => {
    stateRefs.s0 = 'comment'; // mode
    stateRefs.s1 = '  hi team  '; // draft
    stateRefs.s2 = null; // error
    const tree = CommentNoteThread({ ...baseProps, rows: [] }) as AnyElement;
    const btn = findByTestId(tree, 'board-ticket-thread-submit-btn');
    (btn?.props.onClick as () => void)();
    expect(postCommentSpy).toHaveBeenCalledWith({
      requestId: 'r1',
      groupSlug: 'writers',
      body: 'hi team',
    });
    expect(postNoteSpy).not.toHaveBeenCalled();
  });

  it('calls postNoteAction when in note mode', () => {
    stateRefs.s0 = 'note';
    stateRefs.s1 = 'team-only';
    stateRefs.s2 = null;
    const tree = CommentNoteThread({ ...baseProps, rows: [] }) as AnyElement;
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
    stateRefs.s0 = 'comment';
    stateRefs.s1 = 'pending text';
    stateRefs.s2 = null;
    const tree = CommentNoteThread({ ...baseProps, rows: [] }) as AnyElement;
    const btn = findByTestId(tree, 'board-ticket-thread-submit-btn');
    expect(btn?.props.disabled).toBe(true);
  });
});
