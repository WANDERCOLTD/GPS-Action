/**
 * Unit tests for PageHeader.
 *
 * @build-unit bu-page-header-system
 * @spec docs/build/session-briefs/bu-page-header-system.md
 *
 * Vitest env is `node`, no RTL — we invoke PageHeader as a plain
 * function and walk the ReactElement tree to assert testid + content
 * contract. Sticky positioning + the --app-nav-height variable are
 * CSS-driven and live in HeaderShell tests; PageHeader's contract is
 * the slot shape and testid surface.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { PageHeader } from '@/components/PageHeader';

type AnyElement = ReactElement<Record<string, unknown>>;

function flatChildren(el: AnyElement): AnyElement[] {
  const acc: AnyElement[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const e = node as AnyElement;
    acc.push(e);
    walk(e.props.children);
  };
  walk(el);
  return acc;
}

function findByTestId(el: AnyElement, testId: string): AnyElement | undefined {
  return flatChildren(el).find((e) => e.props['data-testid'] === testId);
}

function flatStrings(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flatStrings).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return flatStrings((node as AnyElement).props.children);
  }
  return '';
}

describe('PageHeader', () => {
  it('renders the title with the canonical testid', () => {
    const tree = PageHeader({ title: 'Network' }) as AnyElement;
    const title = findByTestId(tree, 'page-header-title');
    expect(title).toBeDefined();
    expect(flatStrings(title)).toBe('Network');
  });

  it('renders the description when provided', () => {
    const tree = PageHeader({
      title: 'Network',
      description: 'Live from WhatsApp',
    }) as AnyElement;
    const description = findByTestId(tree, 'page-header-description');
    expect(description).toBeDefined();
    expect(flatStrings(description)).toBe('Live from WhatsApp');
  });

  it('omits the description block when description is undefined', () => {
    const tree = PageHeader({ title: 'Settings' }) as AnyElement;
    expect(findByTestId(tree, 'page-header-description')).toBeUndefined();
  });

  it('renders the actions slot when actions are provided', () => {
    const actions = (
      <button data-testid="page-header-test-action" type="button">
        Action
      </button>
    );
    const tree = PageHeader({ title: 'Network', actions }) as AnyElement;
    const actionsBlock = findByTestId(tree, 'page-header-actions');
    expect(actionsBlock).toBeDefined();
    expect(findByTestId(tree, 'page-header-test-action')).toBeDefined();
  });

  it('omits the actions block when no actions are passed', () => {
    const tree = PageHeader({ title: 'Network' }) as AnyElement;
    expect(findByTestId(tree, 'page-header-actions')).toBeUndefined();
  });

  it('renders the children sub-row when provided', () => {
    const children = <div data-testid="page-header-test-subrow-content">filter chips</div>;
    const tree = PageHeader({
      title: 'Network',
      description: 'Live from WhatsApp',
      children,
    }) as AnyElement;
    const subRow = findByTestId(tree, 'page-header-subrow');
    expect(subRow).toBeDefined();
    expect(findByTestId(tree, 'page-header-test-subrow-content')).toBeDefined();
  });

  it('omits the sub-row block when no children are passed', () => {
    const tree = PageHeader({ title: 'Network' }) as AnyElement;
    expect(findByTestId(tree, 'page-header-subrow')).toBeUndefined();
  });

  it('exposes the page-header testid on the outer header element', () => {
    const tree = PageHeader({ title: 'Network' }) as AnyElement;
    expect(findByTestId(tree, 'page-header')).toBeDefined();
  });
});
