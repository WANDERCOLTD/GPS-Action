/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { ReviewedByBadge } from '@/components/ReviewedByBadge';
import { UserAvatar } from '@/components/UserAvatar';

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
  return flatChildren(el).find((e) => e.props['data-testid'] === id);
}

describe('ReviewedByBadge', () => {
  const baseProps = {
    postId: 'post-1',
    reviewerId: 'reviewer-1',
    reviewerDisplayName: 'Sharon Cohen',
  } as const;

  it('renders an anchor pointing to the post-anchored review comment', () => {
    const tree = ReviewedByBadge(baseProps) as AnyElement;
    expect(tree.type).toBe('a');
    expect(tree.props.href).toBe('#post-post-1-review-comment');
  });

  it('exposes a "Reviewed by Sharon Cohen" tooltip + aria-label', () => {
    const tree = ReviewedByBadge(baseProps) as AnyElement;
    expect(tree.props.title).toBe('Reviewed by Sharon Cohen');
    expect(tree.props['aria-label']).toBe('Reviewed by Sharon Cohen');
  });

  it('honours the size prop for the outer wrapper', () => {
    const tree = ReviewedByBadge({ ...baseProps, size: 22 }) as AnyElement;
    const style = tree.props.style as { width?: string; height?: string };
    expect(style.width).toBe('22px');
    expect(style.height).toBe('22px');
  });

  it('defaults size to 18 when not supplied', () => {
    const tree = ReviewedByBadge(baseProps) as AnyElement;
    const style = tree.props.style as { width?: string };
    expect(style.width).toBe('18px');
  });

  it('renders the ✓ overlay by default and omits it when showCheckmark=false', () => {
    const withCheck = ReviewedByBadge(baseProps) as AnyElement;
    expect(findByTestId(withCheck, 'post-reviewed-by-badge-check')).toBeDefined();

    const noCheck = ReviewedByBadge({ ...baseProps, showCheckmark: false }) as AnyElement;
    expect(findByTestId(noCheck, 'post-reviewed-by-badge-check')).toBeUndefined();
  });

  it('uses a colour-mix() ring not a hex opacity', () => {
    const tree = ReviewedByBadge(baseProps) as AnyElement;
    const style = tree.props.style as { border?: string };
    expect(style.border).toContain('color-mix(');
  });

  it('passes the reviewer info through to UserAvatar', () => {
    const tree = ReviewedByBadge({
      ...baseProps,
      reviewerAvatarUrl: 'https://cdn.example/avatars/sharon.jpg',
      size: 18,
    }) as AnyElement;
    const avatar = flatChildren(tree).find((e) => e.type === UserAvatar);
    expect(avatar).toBeDefined();
    expect(avatar?.props.userId).toBe('reviewer-1');
    expect(avatar?.props.displayName).toBe('Sharon Cohen');
    expect(avatar?.props.avatarUrl).toBe('https://cdn.example/avatars/sharon.jpg');
    // Inner avatar size is the wrapper size minus the 1.5px ring × 2.
    expect(avatar?.props.size).toBe(15);
  });
});
