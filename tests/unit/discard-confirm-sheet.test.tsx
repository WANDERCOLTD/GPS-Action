/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 */

import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { DiscardConfirmSheet } from '@/components/DiscardConfirmSheet';

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

describe('DiscardConfirmSheet', () => {
  it('renders nothing when closed', () => {
    const result = DiscardConfirmSheet({
      open: false,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    });
    expect(result).toBeNull();
  });

  it('renders the dialog with the right heading and confirm/cancel buttons when open', () => {
    const tree = DiscardConfirmSheet({
      open: true,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    }) as AnyElement;

    expect(tree.props['data-testid']).toBe('compose-discard-confirm-sheet');
    expect(tree.props.role).toBe('dialog');
    expect(tree.props['aria-modal']).toBe('true');

    const confirm = findByTestId(tree, 'compose-discard-confirm-sheet-confirm');
    const cancel = findByTestId(tree, 'compose-discard-confirm-sheet-cancel');
    expect(confirm).toBeDefined();
    expect(cancel).toBeDefined();
    expect(confirm?.props.children).toBe('Discard');
    expect(cancel?.props.children).toBe('Keep editing');
  });

  it('fires onConfirm when the destructive button is clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    const tree = DiscardConfirmSheet({ open: true, onConfirm, onCancel }) as AnyElement;

    const confirm = findByTestId(tree, 'compose-discard-confirm-sheet-confirm');
    await (confirm?.props.onClick as () => Promise<void>)();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('fires onCancel when the secondary button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const tree = DiscardConfirmSheet({ open: true, onConfirm, onCancel }) as AnyElement;

    const cancel = findByTestId(tree, 'compose-discard-confirm-sheet-cancel');
    (cancel?.props.onClick as () => void)();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('uses honest copy throughout (no anxiety amplification)', () => {
    const tree = DiscardConfirmSheet({
      open: true,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    }) as AnyElement;
    const allText = flatChildren(tree)
      .filter((e) => typeof e.props.children === 'string')
      .map((e) => e.props.children as string)
      .join(' ');
    expect(allText).toContain('Discard this draft?');
    expect(allText).toContain('undo');
  });
});
