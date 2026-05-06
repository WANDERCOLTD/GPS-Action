/**
 * Unit tests for EditableTicketTitle + EditableTicketBody after the
 * click-to-edit refactor — the title/body text itself is the trigger,
 * with a faint pencil icon as a hint and Enter / blur to save.
 *
 * Same plain-function-as-component pattern. Mocks useState +
 * useTransition + useEffect + the server actions; walks the tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const useTransitionMock = vi.fn<() => [boolean, (cb: () => void) => void]>(() => [
  false,
  (cb: () => void) => cb(),
]);

const stateValues = new Map<unknown, unknown>();
const useStateMock = vi.fn(<T,>(initial: T): [T, (value: T) => void] => {
  if (!stateValues.has(initial)) stateValues.set(initial, initial);
  return [stateValues.get(initial) as T, (v: T) => stateValues.set(initial, v)];
});

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useTransition: () => useTransitionMock(),
    useState: <T,>(initial: T) => useStateMock(initial),
    useEffect: () => undefined,
    useRef: () => ({ current: null }),
  };
});

const editTitleSpy = vi.fn(async (_input: unknown) => ({ ok: true }));
const editBodySpy = vi.fn(async (_input: unknown) => ({ ok: true }));

vi.mock('@/app/board/[groupSlug]/[ticketId]/actions', () => ({
  editTitleAction: (input: unknown) => editTitleSpy(input),
  editBodyAction: (input: unknown) => editBodySpy(input),
}));

const { EditableTicketTitle } = await import('@/components/board/EditableTicketTitle');
const { EditableTicketBody } = await import('@/components/board/EditableTicketBody');

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

const titleProps = {
  requestId: 'r1',
  groupSlug: 'writers',
  groupId: 'g1',
  initial: 'Original title',
  urgent: false,
};

const bodyProps = {
  requestId: 'r1',
  groupSlug: 'writers',
  groupId: 'g1',
  initial: 'Original body' as string | null,
};

beforeEach(() => {
  vi.clearAllMocks();
  stateValues.clear();
  useTransitionMock.mockReturnValue([false, (cb: () => void) => cb()]);
});

describe('EditableTicketTitle — idle mode', () => {
  it('renders the title as the click target with a pencil icon hint', () => {
    const tree = EditableTicketTitle(titleProps) as AnyElement;
    const row = findByTestId(tree, 'board-ticket-title-row');
    expect(row?.props['data-mode']).toBe('idle');
    expect(findByTestId(tree, 'board-ticket-title-trigger')).toBeDefined();
    expect(findByTestId(tree, 'board-ticket-title-pencil')).toBeDefined();
  });

  it('renders the urgent dot when urgent is true', () => {
    const tree = EditableTicketTitle({ ...titleProps, urgent: true }) as AnyElement;
    expect(findByTestId(tree, 'board-ticket-urgent-dot')).toBeDefined();
  });

  it('omits the urgent dot when urgent is false', () => {
    const tree = EditableTicketTitle({ ...titleProps, urgent: false }) as AnyElement;
    expect(findByTestId(tree, 'board-ticket-urgent-dot')).toBeUndefined();
  });

  it('switches to editing mode when the title trigger is clicked', () => {
    const tree = EditableTicketTitle(titleProps) as AnyElement;
    const trigger = findByTestId(tree, 'board-ticket-title-trigger');
    (trigger?.props.onClick as () => void)();
    const next = EditableTicketTitle(titleProps) as AnyElement;
    expect(findByTestId(next, 'board-ticket-title-row')?.props['data-mode']).toBe('editing');
    expect(findByTestId(next, 'board-ticket-title-input')).toBeDefined();
  });
});

describe('EditableTicketTitle — save flow', () => {
  it('calls editTitleAction with the trimmed title on Enter', () => {
    EditableTicketTitle(titleProps) as AnyElement;
    const tree = EditableTicketTitle(titleProps) as AnyElement;
    const trigger = findByTestId(tree, 'board-ticket-title-trigger');
    (trigger?.props.onClick as () => void)();
    const editing = EditableTicketTitle(titleProps) as AnyElement;
    const input = findByTestId(editing, 'board-ticket-title-input');
    (input?.props.onChange as (e: { target: { value: string } }) => void)({
      target: { value: '  New title  ' },
    });
    const final = EditableTicketTitle(titleProps) as AnyElement;
    const finalInput = findByTestId(final, 'board-ticket-title-input');
    (finalInput?.props.onKeyDown as (e: { key: string; preventDefault: () => void }) => void)({
      key: 'Enter',
      preventDefault: () => undefined,
    });
    expect(editTitleSpy).toHaveBeenCalledWith({
      requestId: 'r1',
      groupSlug: 'writers',
      groupId: 'g1',
      title: 'New title',
    });
  });
});

describe('EditableTicketBody — idle mode', () => {
  it('renders the body and pencil hint when initial is non-empty', () => {
    const tree = EditableTicketBody(bodyProps) as AnyElement;
    expect(findByTestId(tree, 'board-ticket-description-body')).toBeDefined();
    expect(findByTestId(tree, 'board-ticket-body-trigger')).toBeDefined();
    expect(findByTestId(tree, 'board-ticket-body-pencil')).toBeDefined();
  });

  it('renders the empty placeholder when initial is null', () => {
    const tree = EditableTicketBody({ ...bodyProps, initial: null }) as AnyElement;
    expect(findByTestId(tree, 'board-ticket-description-empty')).toBeDefined();
    expect(findByTestId(tree, 'board-ticket-body-trigger')).toBeDefined();
  });

  it('switches to editing mode on body trigger click', () => {
    const tree = EditableTicketBody(bodyProps) as AnyElement;
    const trigger = findByTestId(tree, 'board-ticket-body-trigger');
    (trigger?.props.onClick as () => void)();
    const next = EditableTicketBody(bodyProps) as AnyElement;
    expect(findByTestId(next, 'board-ticket-body-row')?.props['data-mode']).toBe('editing');
    expect(findByTestId(next, 'board-ticket-body-input')).toBeDefined();
  });
});

describe('EditableTicketBody — save flow', () => {
  it('passes null to editBodyAction when textarea is whitespace-only and saved on blur', () => {
    EditableTicketBody({ ...bodyProps, initial: 'something' }) as AnyElement;
    const tree = EditableTicketBody({ ...bodyProps, initial: 'something' }) as AnyElement;
    const trigger = findByTestId(tree, 'board-ticket-body-trigger');
    (trigger?.props.onClick as () => void)();
    const editing = EditableTicketBody({
      ...bodyProps,
      initial: 'something',
    }) as AnyElement;
    const input = findByTestId(editing, 'board-ticket-body-input');
    (input?.props.onChange as (e: { target: { value: string } }) => void)({
      target: { value: '  \n  ' },
    });
    const final = EditableTicketBody({ ...bodyProps, initial: 'something' }) as AnyElement;
    const finalInput = findByTestId(final, 'board-ticket-body-input');
    (finalInput?.props.onBlur as () => void)();
    expect(editBodySpy).toHaveBeenCalledWith({
      requestId: 'r1',
      groupSlug: 'writers',
      groupId: 'g1',
      body: null,
    });
  });

  it('passes the literal string to editBodyAction when content is provided', () => {
    EditableTicketBody({ ...bodyProps, initial: null }) as AnyElement;
    const tree = EditableTicketBody({ ...bodyProps, initial: null }) as AnyElement;
    const trigger = findByTestId(tree, 'board-ticket-body-trigger');
    (trigger?.props.onClick as () => void)();
    const editing = EditableTicketBody({ ...bodyProps, initial: null }) as AnyElement;
    const input = findByTestId(editing, 'board-ticket-body-input');
    (input?.props.onChange as (e: { target: { value: string } }) => void)({
      target: { value: 'Hello world' },
    });
    const final = EditableTicketBody({ ...bodyProps, initial: null }) as AnyElement;
    const finalInput = findByTestId(final, 'board-ticket-body-input');
    (finalInput?.props.onBlur as () => void)();
    expect(editBodySpy).toHaveBeenCalledWith(expect.objectContaining({ body: 'Hello world' }));
  });
});
