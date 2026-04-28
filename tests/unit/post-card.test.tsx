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
  kindSlug: null,
  kindDisplayName: null,
  urgency: false,
  heroImageUrl: 'https://example.com/hero.jpg',
  signal: null,
  sharedToNetworkAt: null,
  createdAt: '2026-04-28T11:00:00.000Z',
  author: { displayName: 'Sharon', roles: [] },
  reactions: [],
  commentCount: 0,
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
    it('navs to /post/[id] on tap (D061 contract) for both variants', () => {
      for (const variant of ['compact', 'full'] as const) {
        pushSpy.mockReset();
        const tree = renderCard({ variant });
        const article = findByTestId(tree, 'post-card-article');
        expect(article).toBeDefined();
        const onClick = article!.props.onClick as (e: {
          target: { closest: (sel: string) => null };
        }) => void;
        onClick({ target: { closest: () => null } });
        expect(pushSpy).toHaveBeenCalledTimes(1);
        expect(pushSpy).toHaveBeenCalledWith('/post/post-1');
      }
    });
  });
});
