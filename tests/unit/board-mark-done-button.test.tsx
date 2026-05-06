/**
 * Unit tests for MarkDoneButton — visibility contract.
 *
 * The interaction (call moveCardAction, register undo toast) involves
 * `useTransition` + context, which would fail under the plain-function
 * expand pattern. We test the deterministic surface: the component
 * renders nothing when the ticket is not active.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { MarkDoneButton } from '@/components/board/MarkDoneButton';

type AnyElement = ReactElement<Record<string, unknown>>;

describe('MarkDoneButton', () => {
  it('renders nothing when ticket is not active', () => {
    const tree = MarkDoneButton({
      requestId: 'r1',
      groupId: 'g1',
      groupSlug: 'writers',
      currentColumnId: 'c1',
      isActive: false,
    }) as AnyElement | null;
    expect(tree).toBeNull();
  });

  it('exports as a function component', () => {
    expect(typeof MarkDoneButton).toBe('function');
  });
});
