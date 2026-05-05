/**
 * Unit tests for GroupBadge (bu-group-identity / ADR-0013).
 *
 * Same plain-function-as-component pattern as the rest of the unit
 * tests in this folder: vitest env is `node`, no RTL — call the
 * component as a function and walk the ReactElement tree.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import {
  GroupBadge,
  getInitials,
  type GroupBadgeGroup,
  type GroupBadgeSize,
} from '@/components/group/GroupBadge';

type AnyElement = ReactElement<Record<string, unknown>>;

function findByTestId(root: AnyElement, testid: string): AnyElement | null {
  const props = (root.props ?? {}) as Record<string, unknown>;
  if (props['data-testid'] === testid) return root;
  const children = props.children;
  if (children == null) return null;
  const list = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const child of list) {
    if (child && typeof child === 'object' && 'props' in child) {
      const found = findByTestId(child as AnyElement, testid);
      if (found) return found;
    }
  }
  return null;
}

const fixtureGroup = (overrides: Partial<GroupBadgeGroup> = {}): GroupBadgeGroup => ({
  displayName: 'Hendon Working Group',
  kind: 'workstream',
  colourKey: 'rust',
  logoUrl: null,
  ...overrides,
});

const render = (props: { group: GroupBadgeGroup; size?: GroupBadgeSize; decorative?: boolean }) =>
  GroupBadge(props) as AnyElement;

describe('GroupBadge', () => {
  describe('initials', () => {
    it('takes the first letter of the first two words, uppercased', () => {
      expect(getInitials('Hendon Working Group')).toBe('HW');
    });

    it('falls back to first 2 chars for single-word names', () => {
      expect(getInitials('Crewe')).toBe('CR');
    });

    it('strips accents (NFKD)', () => {
      expect(getInitials('Ñoño Réseau')).toBe('NR');
    });

    it('returns "?" for empty / whitespace-only input', () => {
      expect(getInitials('   ')).toBe('?');
      expect(getInitials('')).toBe('?');
    });
  });

  describe('rendering', () => {
    it('renders initials inside the chip at every size', () => {
      for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
        const tree = render({ group: fixtureGroup(), size });
        const initials = findByTestId(tree, 'group-badge-initials');
        expect(initials, `size=${size}`).not.toBeNull();
        expect((initials?.props as Record<string, unknown>).children).toBe('HW');
      }
    });

    it('applies the colourKey via data attribute (token resolution is a CSS concern)', () => {
      const tree = render({ group: fixtureGroup({ colourKey: 'plum' }) });
      expect((tree.props as Record<string, unknown>)['data-group-colour']).toBe('plum');
    });

    it('marks the kind via data attribute', () => {
      const tree = render({ group: fixtureGroup({ kind: 'region' }) });
      expect((tree.props as Record<string, unknown>)['data-group-kind']).toBe('region');
    });

    it('includes the kind-glyph corner overlay at sm/md/lg', () => {
      for (const size of ['sm', 'md', 'lg'] as const) {
        const tree = render({ group: fixtureGroup(), size });
        expect(findByTestId(tree, 'group-badge-corner'), `size=${size}`).not.toBeNull();
      }
    });

    it('omits the corner overlay at xs', () => {
      const tree = render({ group: fixtureGroup(), size: 'xs' });
      expect(findByTestId(tree, 'group-badge-corner')).toBeNull();
    });
  });

  describe('logoUrl fallback', () => {
    it('renders the logo at md when logoUrl is set', () => {
      const tree = render({
        group: fixtureGroup({ logoUrl: 'https://example.com/x.png' }),
        size: 'md',
      });
      expect(findByTestId(tree, 'group-badge-logo')).not.toBeNull();
      expect(findByTestId(tree, 'group-badge-initials')).toBeNull();
    });

    it('renders the logo at lg when logoUrl is set', () => {
      const tree = render({
        group: fixtureGroup({ logoUrl: 'https://example.com/x.png' }),
        size: 'lg',
      });
      expect(findByTestId(tree, 'group-badge-logo')).not.toBeNull();
    });

    it('falls back to initials at sm even when logoUrl is set', () => {
      const tree = render({
        group: fixtureGroup({ logoUrl: 'https://example.com/x.png' }),
        size: 'sm',
      });
      expect(findByTestId(tree, 'group-badge-logo')).toBeNull();
      expect(findByTestId(tree, 'group-badge-initials')).not.toBeNull();
    });

    it('falls back to initials at xs even when logoUrl is set', () => {
      const tree = render({
        group: fixtureGroup({ logoUrl: 'https://example.com/x.png' }),
        size: 'xs',
      });
      expect(findByTestId(tree, 'group-badge-logo')).toBeNull();
      expect(findByTestId(tree, 'group-badge-initials')).not.toBeNull();
    });

    it('falls back to initials at md when logoUrl is null', () => {
      const tree = render({ group: fixtureGroup({ logoUrl: null }), size: 'md' });
      expect(findByTestId(tree, 'group-badge-logo')).toBeNull();
      expect(findByTestId(tree, 'group-badge-initials')).not.toBeNull();
    });
  });

  describe('accessibility', () => {
    it('carries role + aria-label by default (icon-only use)', () => {
      const tree = render({ group: fixtureGroup({ kind: 'team' }) });
      const props = tree.props as Record<string, unknown>;
      expect(props['role']).toBe('img');
      expect(props['aria-label']).toBe('Hendon Working Group (Team)');
      expect(props['aria-hidden']).toBeUndefined();
    });

    it('strips role + aria-label when decorative is true', () => {
      const tree = render({ group: fixtureGroup(), decorative: true });
      const props = tree.props as Record<string, unknown>;
      expect(props['aria-hidden']).toBe(true);
      expect(props['role']).toBeUndefined();
      expect(props['aria-label']).toBeUndefined();
    });

    it('uses the human kind label in the aria-label, not the enum value', () => {
      for (const [kind, label] of [
        ['workstream', 'Workstream'],
        ['region', 'Region'],
        ['network', 'Network'],
        ['team', 'Team'],
        ['topic', 'Topic'],
      ] as const) {
        const tree = render({ group: fixtureGroup({ kind, displayName: 'X' }) });
        expect((tree.props as Record<string, unknown>)['aria-label']).toBe(`X (${label})`);
      }
    });
  });
});
