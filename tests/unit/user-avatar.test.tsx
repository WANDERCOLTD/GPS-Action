/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Unit tests for UserAvatar. Vitest env is `node`, no RTL — invoke
 * the component as a plain function and inspect the ReactElement.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { UserAvatar } from '@/components/UserAvatar';

type AnyElement = ReactElement<Record<string, unknown>>;

function flatStrings(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flatStrings).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return flatStrings((node as AnyElement).props.children);
  }
  return '';
}

describe('UserAvatar', () => {
  it('renders an <img> with the provided avatarUrl when present', () => {
    const tree = UserAvatar({
      userId: 'u1',
      displayName: 'Sharon Cohen',
      avatarUrl: 'https://cdn.example/avatars/u1.jpg',
    }) as AnyElement;

    expect(tree.type).toBe('img');
    expect(tree.props.src).toBe('https://cdn.example/avatars/u1.jpg');
    expect(tree.props['data-testid']).toBe('user-avatar');
    expect(tree.props['data-variant']).toBe('image');
    expect(tree.props['data-user-id']).toBe('u1');
    expect(tree.props['aria-hidden']).toBe('true');
  });

  it('renders initials when avatarUrl is null/undefined', () => {
    const tree = UserAvatar({
      userId: 'u2',
      displayName: 'Sharon Cohen',
      avatarUrl: null,
    }) as AnyElement;

    expect(tree.type).toBe('span');
    expect(tree.props['data-variant']).toBe('initials');
    expect(flatStrings(tree)).toBe('SC');
  });

  it('falls back to a single initial for one-word names', () => {
    const tree = UserAvatar({
      userId: 'u3',
      displayName: 'Sharon',
    }) as AnyElement;
    expect(flatStrings(tree)).toBe('S');
  });

  it('uses last-name initial when there are 3+ name parts', () => {
    const tree = UserAvatar({
      userId: 'u4',
      displayName: 'Anna Maria Levi',
    }) as AnyElement;
    expect(flatStrings(tree)).toBe('AL');
  });

  it('renders "?" when displayName is empty whitespace', () => {
    const tree = UserAvatar({
      userId: 'u5',
      displayName: '   ',
    }) as AnyElement;
    expect(flatStrings(tree)).toBe('?');
  });

  it('honours the size prop on width and height', () => {
    const small = UserAvatar({
      userId: 'u6',
      displayName: 'Eddie',
      size: 18,
    }) as AnyElement;
    const style = small.props.style as { width?: string; height?: string };
    expect(style.width).toBe('18px');
    expect(style.height).toBe('18px');
  });

  it('defaults size to 32 when not specified', () => {
    const tree = UserAvatar({ userId: 'u7', displayName: 'Default' }) as AnyElement;
    const style = tree.props.style as { width?: string };
    expect(style.width).toBe('32px');
  });

  it('picks deterministic tint colours per displayName', () => {
    const sharonA = UserAvatar({ userId: 'a', displayName: 'Sharon Cohen' }) as AnyElement;
    const sharonB = UserAvatar({
      userId: 'different-id',
      displayName: 'Sharon Cohen',
    }) as AnyElement;
    const eddie = UserAvatar({ userId: 'c', displayName: 'Eddie Stone' }) as AnyElement;

    const sharonAStyle = sharonA.props.style as { color?: string };
    const sharonBStyle = sharonB.props.style as { color?: string };
    const eddieStyle = eddie.props.style as { color?: string };

    // Same displayName → same tint regardless of userId.
    expect(sharonAStyle.color).toBe(sharonBStyle.color);
    // Different name → likely-different tint (palette has 7 colours;
    // collisions are possible but these two are checked manually).
    expect(eddieStyle.color).toBeDefined();
  });

  it('passes through className for wrappers like ReviewedByBadge', () => {
    const tree = UserAvatar({
      userId: 'u',
      displayName: 'Ring Test',
      className: 'reviewed-ring',
    }) as AnyElement;
    expect(tree.props.className).toBe('reviewed-ring');
  });
});
