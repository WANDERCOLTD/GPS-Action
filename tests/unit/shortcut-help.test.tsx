/**
 * Unit tests for the ShortcutHelp overlay.
 *
 * @build-unit BU-keyboard-shortcuts
 *
 * Vitest env is `node` — no RTL. We invoke ShortcutHelp as a plain
 * function and walk the ReactElement tree to assert the contract:
 *
 *   - returns null when closed
 *   - renders one row per binding when open
 *   - row keys/labels match the registry
 *   - close button calls onClose
 */

import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { ShortcutHelp } from '@/components/ShortcutHelp';
import { SHORTCUT_BINDINGS } from '@/shared/shortcuts';

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

function findAllByTestId(el: AnyElement, testId: string): AnyElement[] {
  return flatChildren(el).filter((e) => e.props['data-testid'] === testId);
}

function findByTestId(el: AnyElement, testId: string): AnyElement | undefined {
  return findAllByTestId(el, testId)[0];
}

describe('ShortcutHelp', () => {
  it('returns null when open is false', () => {
    const tree = ShortcutHelp({ open: false, onClose: vi.fn() });
    expect(tree).toBeNull();
  });

  it('renders the modal and one row per binding when open', () => {
    const tree = ShortcutHelp({ open: true, onClose: vi.fn() }) as AnyElement;
    expect(tree).not.toBeNull();
    expect(findByTestId(tree, 'shortcut-help-modal')).toBeDefined();

    const rows = findAllByTestId(tree, 'shortcut-help-row');
    expect(rows).toHaveLength(SHORTCUT_BINDINGS.length);
  });

  it('uses the binding-id data attribute for each row to match the registry', () => {
    const tree = ShortcutHelp({ open: true, onClose: vi.fn() }) as AnyElement;
    const rows = findAllByTestId(tree, 'shortcut-help-row');
    const expectedIds = SHORTCUT_BINDINGS.map((b) =>
      b.kind === 'sequence'
        ? `${b.prefix}-${b.key}`
        : b.kind === 'contextual'
          ? `ctx-${b.macKeys.replace(/\s+/g, '-')}`
          : b.key,
    );
    const actualIds = rows.map((r) => r.props['data-binding-id']);
    expect(actualIds).toEqual(expectedIds);
  });

  it('close button invokes onClose', () => {
    const onClose = vi.fn();
    const tree = ShortcutHelp({ open: true, onClose }) as AnyElement;
    const close = findByTestId(tree, 'shortcut-help-close');
    expect(close).toBeDefined();
    const onClick = close?.props.onClick as () => void;
    onClick();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop click invokes onClose', () => {
    const onClose = vi.fn();
    const tree = ShortcutHelp({ open: true, onClose }) as AnyElement;
    const backdrop = findByTestId(tree, 'shortcut-help-backdrop');
    expect(backdrop).toBeDefined();
    const onClick = backdrop?.props.onClick as () => void;
    onClick();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
