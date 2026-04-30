/**
 * @build-unit BU-feed-card-clamp
 * @spec build/session-briefs/bu-feed-card-clamp.md
 *
 * Variant-rendering tests for `PostCard`. Vitest env is `node`, no RTL —
 * we mock the heavy children (LinkPreviewCard / PostShareGroup /
 * ReactionPill) and `next/navigation` so we can invoke the component
 * as a plain function and walk the React element tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const pushSpy = vi.fn<(href: string) => void>();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

vi.mock('@/components/LinkPreviewCard', () => ({
  LinkPreviewCard: () => null,
}));

vi.mock('@/components/PostShareGroup', () => ({
  PostShareGroup: () => null,
}));

vi.mock('@/components/ReactionPill', () => ({
  ReactionPill: () => null,
}));

const { PostCard } = (await import('@/components/PostCard')) as unknown as {
  PostCard: (props: Record<string, unknown>) => ReactElement;
};

type AnyElement = ReactElement<Record<string, unknown>>;

function flatChildren(el: AnyElement | null | undefined): AnyElement[] {
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

function findByPropValue(
  el: AnyElement,
  propName: string,
  propValue: unknown,
): AnyElement | undefined {
  return flatChildren(el).find((e) => e.props[propName] === propValue);
}

const basePost = {
  id: 'post-1',
  title: 'A long-running march on Saturday',
  body:
    'First paragraph of a substantive post. It runs for several lines, ' +
    'easily more than three on most viewport widths, so the clamp will ' +
    'take effect.\n\nSecond paragraph adds more context.\n\nThird closes it out.',
  activistMailerUrl: null,
  linkUrl: null,
  linkTitle: null,
  linkDescription: null,
  linkImageUrl: null,
  linkSiteName: null,
  isActivistMailer: false,
  kindSlug: null,
  kindDisplayName: null,
  urgency: false,
  heroImageUrl: 'https://example.com/hero.jpg',
  signal: null,
  sharedToNetworkAt: null,
  // BU-event-time / D073 — defaults: not a time-bearing post.
  eventAt: null,
  eventEndsAt: null,
  locationText: null,
  createdAt: '2026-04-28T11:00:00.000Z',
  author: { displayName: 'Sharon', roles: [] },
  reactions: [],
  commentCount: 0,
  feedCommentPeekEnabled: true,
  topComment: null,
  reviewedByUserId: null,
  reviewedBy: null,
};

const noopHandler = async () => {};

function renderCard(overrides: Record<string, unknown> = {}): AnyElement {
  return PostCard({
    post: { ...basePost, ...(overrides.post as object | undefined) },
    onAddReaction: noopHandler,
    onRemoveReaction: noopHandler,
    canReact: false,
    reactionsEnabled: false,
    variant: overrides.variant,
  }) as AnyElement;
}

describe('PostCard variant', () => {
  beforeEach(() => {
    pushSpy.mockReset();
  });

  describe('default (compact)', () => {
    it('marks the body wrapper with data-variant="compact"', () => {
      const tree = renderCard();
      const body = findByTestId(tree, 'post-card-body');
      expect(body).toBeDefined();
      expect(body?.props['data-variant']).toBe('compact');
    });

    it('applies the -webkit-line-clamp clamp on the inner body', () => {
      const tree = renderCard();
      const body = findByTestId(tree, 'post-card-body');
      const inner = flatChildren(body!).find(
        (e) => (e.props.style as Record<string, unknown> | undefined)?.WebkitLineClamp === 3,
      );
      expect(inner).toBeDefined();
      const style = inner!.props.style as Record<string, unknown>;
      expect(style.display).toBe('-webkit-box');
      expect(style.WebkitBoxOrient).toBe('vertical');
      expect(style.overflow).toBe('hidden');
    });

    it('renders a 96×96 right thumbnail when heroImageUrl is present', () => {
      const tree = renderCard();
      const thumb = findByTestId(tree, 'post-card-thumb');
      expect(thumb).toBeDefined();
      const style = thumb!.props.style as Record<string, unknown>;
      expect(style.width).toBe(96);
      expect(style.height).toBe(96);
      expect(style.objectFit).toBe('cover');
    });

    it('omits the thumbnail when heroImageUrl is null', () => {
      const tree = renderCard({ post: { heroImageUrl: null } });
      expect(findByTestId(tree, 'post-card-thumb')).toBeUndefined();
    });

    it('does NOT render the full-width hero image element', () => {
      const tree = renderCard();
      expect(findByTestId(tree, 'post-card-hero-image')).toBeUndefined();
    });

    it('collapses \\n\\n paragraph breaks into a single inline string', () => {
      const tree = renderCard();
      const body = findByTestId(tree, 'post-card-body');
      const inner = flatChildren(body!).find(
        (e) => (e.props.style as Record<string, unknown> | undefined)?.WebkitLineClamp === 3,
      );
      const text = inner!.props.children as string;
      expect(typeof text).toBe('string');
      expect(text).not.toContain('\n');
      expect(text.startsWith('First paragraph')).toBe(true);
      expect(text).toContain('Third closes it out.');
    });
  });

  describe('full', () => {
    it('marks the body wrapper with data-variant="full"', () => {
      const tree = renderCard({ variant: 'full' });
      const body = findByTestId(tree, 'post-card-body');
      expect(body).toBeDefined();
      expect(body?.props['data-variant']).toBe('full');
    });

    it('renders one <p> per \\n\\n paragraph (no clamp)', () => {
      const tree = renderCard({ variant: 'full' });
      const body = findByTestId(tree, 'post-card-body');
      const paragraphs = flatChildren(body!).filter((e) => e.type === 'p');
      expect(paragraphs.length).toBe(3);
    });

    it('renders the full-width hero image element when heroImageUrl is present', () => {
      const tree = renderCard({ variant: 'full' });
      const hero = findByTestId(tree, 'post-card-hero-image');
      expect(hero).toBeDefined();
      const style = hero!.props.style as Record<string, unknown>;
      expect(style.width).toBe('100%');
      expect(style.aspectRatio).toBe('16 / 9');
    });

    it('does NOT render the right thumbnail', () => {
      const tree = renderCard({ variant: 'full' });
      expect(findByTestId(tree, 'post-card-thumb')).toBeUndefined();
    });
  });

  describe('shared behaviour', () => {
    it('renders the title as a real <Link> to /post/[id] for both variants (BU-feed-card-affordances)', () => {
      for (const variant of ['compact', 'full'] as const) {
        const tree = renderCard({ variant });
        const titleLink = findByTestId(tree, 'feed-card-title-link');
        expect(titleLink).toBeDefined();
        expect(titleLink?.props.href).toBe('/post/post-1');
      }
    });

    it('renders the comment-peek empty CTA in the compact variant when no top comment exists', () => {
      const tree = renderCard({ variant: 'compact' });
      // D074 — the old `Read post →` ArrowLink is gone; the comment-peek
      // row replaces it as the visible nav affordance, so its testid is
      // what we now assert. With no comments seeded by the test, the
      // empty CTA renders.
      const peek = findByTestId(tree, 'post-card-comment-peek-empty');
      expect(peek).toBeDefined();
      expect(peek?.props.href).toBe('/post/post-1#comments');
    });

    it('does not attach an article-level onClick (the inner Links carry navigation)', () => {
      const tree = renderCard({ variant: 'compact' });
      const article = findByTestId(tree, 'post-card-article');
      expect(article?.props.onClick).toBeUndefined();
      expect(article?.props.role).toBeUndefined();
    });
  });

  // BU-event-time / D073 — absolute date+time row above the title.
  describe('event-time row', () => {
    it('does NOT render when eventAt is null', () => {
      const tree = renderCard();
      expect(findByTestId(tree, 'post-card-event-time')).toBeUndefined();
    });

    it('renders an absolute date+time row when eventAt is set', () => {
      // 2026-05-03 18:00 Europe/London (BST → UTC+1) → 17:00 UTC
      const tree = renderCard({
        post: {
          eventAt: '2026-05-03T17:00:00.000Z',
          eventEndsAt: null,
          locationText: null,
        },
      });
      const row = findByTestId(tree, 'post-card-event-time');
      expect(row).toBeDefined();
      expect(row?.props['data-event-at']).toBe('2026-05-03T17:00:00.000Z');
    });

    it('renders the locationText line when set', () => {
      const tree = renderCard({
        post: {
          eventAt: '2026-05-03T17:00:00.000Z',
          eventEndsAt: null,
          locationText: 'Albert Square, Manchester',
        },
      });
      const loc = findByTestId(tree, 'post-card-event-location');
      expect(loc).toBeDefined();
      const text = flatChildren(loc!)
        .map((e) => (typeof e.props.children === 'string' ? e.props.children : ''))
        .join(' ');
      expect(text).toContain('Albert Square, Manchester');
    });

    it('omits the location line when locationText is null or empty', () => {
      const tree = renderCard({
        post: {
          eventAt: '2026-05-03T17:00:00.000Z',
          eventEndsAt: null,
          locationText: '',
        },
      });
      expect(findByTestId(tree, 'post-card-event-location')).toBeUndefined();
    });
  });
});
