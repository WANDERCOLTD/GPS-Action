/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Pattern A render correctness per ReviewMode × canSelfPublish ×
 * actionSlugs presence. Plus the disabled-card path for unknown
 * action slugs and the "Did you send it?" confirm-step hand-off.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const stateSlots: unknown[] = [];
let slotIdx = 0;

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: <T,>(init: T | (() => T)) => {
      const idx = slotIdx++;
      const setter = (next: T | ((prev: T) => T)) => {
        const prev = (idx in stateSlots ? stateSlots[idx] : init) as T;
        stateSlots[idx] = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      };
      const initial = typeof init === 'function' ? (init as () => T)() : init;
      const value = (idx in stateSlots ? stateSlots[idx] : initial) as T;
      return [value, setter] as const;
    },
  };
});

const { PostPublishModal } = await import('@/components/PostPublishModal');
type ModalProps = Parameters<typeof PostPublishModal>[0];

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
  return flatChildren(el).find((e) => e.props['data-testid'] === id || e.props.testId === id);
}

function findActionCard(el: AnyElement, slug: string): AnyElement | undefined {
  return flatChildren(el).find(
    (e) =>
      (e.props.testId === 'compose-publish-modal-action' ||
        e.props['data-testid'] === 'compose-publish-modal-action') &&
      (e.props.actionSlug === slug || e.props['data-action-slug'] === slug),
  );
}

function reset(): void {
  stateSlots.length = 0;
  slotIdx = 0;
}

function basePost(overrides: Partial<ModalProps['post']> = {}): ModalProps['post'] {
  return {
    id: 'post-1',
    title: 'Sky News op-ed',
    body: 'Please amplify the rebuttal thread.',
    signal: 'promote',
    kindSlug: 'tick_or_cross',
    ...overrides,
  };
}

function render(overrides: Partial<ModalProps> = {}): AnyElement {
  slotIdx = 0;
  const props: ModalProps = {
    post: basePost(),
    kindConfig: {
      actionSlugs: ['share_to_gps_whatsapp'],
      reviewMode: 'either_with_default_review_first',
      canSelfPublish: true,
    },
    actionContext: {
      originUrl: 'https://gps-action.example',
      channelUrl: 'https://wa.me/channel',
    },
    onPublish: vi.fn(),
    onSendForReview: vi.fn(),
    onSaveDraft: vi.fn(),
    onDiscard: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return PostPublishModal(props) as AnyElement;
}

beforeEach(reset);

describe('PostPublishModal Pattern A layout', () => {
  it('renders the modal container with the kind-slug data attribute', () => {
    const tree = render();
    const root = findByTestId(tree, 'compose-publish-modal');
    expect(root).toBeDefined();
    expect(root?.props['data-kind-slug']).toBe('tick_or_cross');
  });

  it('renders the kind-specific primary action when its slug is registered', () => {
    const tree = render();
    const card = findActionCard(tree, 'share_to_gps_whatsapp');
    expect(card).toBeDefined();
    expect(card?.props['data-card-primary']).toBe('true');
  });

  it('renders an unregistered slug as a disabled "Coming soon" card', () => {
    const tree = render({
      kindConfig: {
        actionSlugs: ['schedule_for_sundown'],
        reviewMode: 'review_first',
        canSelfPublish: false,
      },
      post: basePost({ signal: null, kindSlug: 'cultural' }),
    });
    const card = findActionCard(tree, 'schedule_for_sundown');
    expect(card).toBeDefined();
    expect(card?.props.disabled).toBe(true);
  });

  it('hides "Post to feed only" when canSelfPublish=false', () => {
    const tree = render({
      kindConfig: {
        actionSlugs: ['schedule_for_sundown'],
        reviewMode: 'review_first',
        canSelfPublish: false,
      },
      post: basePost({ kindSlug: 'cultural', signal: null }),
    });
    expect(findByTestId(tree, 'compose-publish-modal-publish')).toBeUndefined();
  });

  it('hides "Post to feed only" when reviewMode=review_first regardless of canSelfPublish', () => {
    const tree = render({
      kindConfig: {
        actionSlugs: [],
        reviewMode: 'review_first',
        canSelfPublish: true,
      },
      post: basePost({ signal: null, kindSlug: 'cultural' }),
    });
    expect(findByTestId(tree, 'compose-publish-modal-publish')).toBeUndefined();
  });

  it('always renders Send-to-reviewers, Save-as-draft, and Discard', () => {
    const tree = render();
    expect(findByTestId(tree, 'compose-publish-modal-send-for-review')).toBeDefined();
    expect(findByTestId(tree, 'compose-publish-modal-save-draft')).toBeDefined();
    expect(findByTestId(tree, 'compose-publish-modal-discard')).toBeDefined();
  });

  it('renders the close button with an aria-label', () => {
    const tree = render();
    const close = findByTestId(tree, 'compose-publish-modal-close');
    expect(close?.props['aria-label']).toBe('Close');
  });
});

describe('PostPublishModal — also-publish checkbox per ReviewMode', () => {
  it('defaults the checkbox to UNchecked for either_with_default_review_first', () => {
    const tree = render({
      kindConfig: {
        actionSlugs: [],
        reviewMode: 'either_with_default_review_first',
        canSelfPublish: true,
      },
    });
    const cb = findByTestId(tree, 'compose-publish-modal-also-publish');
    expect(cb?.props.checked).toBe(false);
  });

  it('defaults the checkbox to CHECKED for review_after_publish', () => {
    reset();
    const tree = render({
      kindConfig: {
        actionSlugs: [],
        reviewMode: 'review_after_publish',
        canSelfPublish: true,
      },
    });
    const cb = findByTestId(tree, 'compose-publish-modal-also-publish');
    expect(cb?.props.checked).toBe(true);
  });

  it('defaults the checkbox to UNchecked for either_with_default_publish', () => {
    reset();
    const tree = render({
      kindConfig: {
        actionSlugs: [],
        reviewMode: 'either_with_default_publish',
        canSelfPublish: true,
      },
    });
    const cb = findByTestId(tree, 'compose-publish-modal-also-publish');
    expect(cb?.props.checked).toBe(false);
  });

  it('hides the checkbox entirely for review_first', () => {
    reset();
    const tree = render({
      kindConfig: {
        actionSlugs: [],
        reviewMode: 'review_first',
        canSelfPublish: false,
      },
      post: basePost({ kindSlug: 'cultural', signal: null }),
    });
    expect(findByTestId(tree, 'compose-publish-modal-also-publish')).toBeUndefined();
  });
});

describe('PostPublishModal — verb dispatch', () => {
  it('fires onSendForReview with the current also-publish state', async () => {
    reset();
    const onSendForReview = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    let tree = render({
      onSendForReview,
      onClose,
      kindConfig: {
        actionSlugs: [],
        reviewMode: 'either_with_default_review_first',
        canSelfPublish: true,
      },
    });

    const sendBtn = findByTestId(tree, 'compose-publish-modal-send-for-review');
    await (sendBtn?.props.onClick as () => Promise<void>)();
    expect(onSendForReview).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledTimes(1);

    // With the checkbox flipped to true:
    onSendForReview.mockClear();
    onClose.mockClear();
    reset();
    tree = render({
      onSendForReview,
      onClose,
      kindConfig: {
        actionSlugs: [],
        reviewMode: 'review_after_publish',
        canSelfPublish: true,
      },
    });
    await (
      findByTestId(tree, 'compose-publish-modal-send-for-review')?.props
        .onClick as () => Promise<void>
    )();
    expect(onSendForReview).toHaveBeenCalledWith(true);
  });

  it('fires onPublish + closes when "Post to feed only" is tapped', async () => {
    reset();
    const onPublish = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const tree = render({
      onPublish,
      onClose,
      kindConfig: {
        actionSlugs: [],
        reviewMode: 'either_with_default_publish',
        canSelfPublish: true,
      },
    });
    await (
      findByTestId(tree, 'compose-publish-modal-publish')?.props.onClick as () => Promise<void>
    )();
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onSaveDraft + closes when Save-as-draft is tapped', async () => {
    reset();
    const onSaveDraft = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const tree = render({ onSaveDraft, onClose });
    await (
      findByTestId(tree, 'compose-publish-modal-save-draft')?.props.onClick as () => Promise<void>
    )();
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Discard delegates to the parent (no in-modal confirm)', () => {
    reset();
    const onDiscard = vi.fn();
    const onClose = vi.fn();
    const tree = render({ onDiscard, onClose });
    (findByTestId(tree, 'compose-publish-modal-discard')?.props.onClick as () => void)();
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Close fires onClose', () => {
    reset();
    const onClose = vi.fn();
    const tree = render({ onClose });
    (findByTestId(tree, 'compose-publish-modal-close')?.props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
