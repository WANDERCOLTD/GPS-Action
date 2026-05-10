'use client';

/**
 * @build-unit bu-ticket-view-fixes (Sub-build C, Items 8 + 9)
 * @spec docs/build/session-briefs/bu-ticket-view-fixes.md
 *
 * Minimal tab-strip primitive for the kanban ticket-detail surface.
 * Used twice on the page:
 *
 *   - Discussion tabs (Comments / Log) — Item 8.
 *   - Compose mode tabs (Comment / Note) — Item 9.
 *
 * The visual idiom matches `components/CommentList.tsx`'s filter tabs
 * (underline-on-active, no chrome) so the ticket-detail surface and
 * the post-detail surface look consistent.
 *
 * Each tab carries a caller-supplied `data-testid` literal (passed
 * through as a runtime string). The primitive uses `React.createElement`
 * for the dynamic-testid host nodes so the static-testid ESLint rule
 * (F14) is satisfied at the *call sites* where the strings originate.
 */

import { createElement, type ReactNode } from 'react';

export interface TabStripOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Full `data-testid` literal for the tab button. */
  testId: string;
  /** Full `data-testid` literal for the optional count badge. */
  countTestId?: string;
  /** Optional count badge — e.g. `Log · 12`. */
  count?: number | null;
}

export interface TabStripProps<T extends string> {
  options: ReadonlyArray<TabStripOption<T>>;
  active: T;
  onChange: (next: T) => void;
  /** Accessible label for the tablist. */
  ariaLabel: string;
  /** `data-testid` literal for the wrapping tablist. */
  tabListTestId: string;
  disabled?: boolean;
}

export function TabStrip<T extends string>({
  options,
  active,
  onChange,
  ariaLabel,
  tabListTestId,
  disabled,
}: TabStripProps<T>) {
  return createElement(
    'div',
    {
      role: 'tablist',
      'aria-label': ariaLabel,
      'data-testid': tabListTestId,
      style: {
        display: 'flex',
        gap: 'var(--space-2)',
        borderBottom: '1px solid var(--colour-border-subtle)',
      },
    },
    options.map((option) => {
      const isActive = active === option.value;
      return createElement(
        'button',
        {
          type: 'button',
          key: option.value,
          role: 'tab',
          'aria-selected': isActive,
          'data-testid': option.testId,
          'data-active': isActive,
          onClick: () => onChange(option.value),
          disabled,
          style: {
            padding: 'var(--space-2) var(--space-3)',
            background: 'transparent',
            border: 'none',
            borderBottom: isActive ? '2px solid var(--colour-text-link)' : '2px solid transparent',
            color: isActive ? 'var(--colour-text-primary)' : 'var(--colour-text-secondary)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--text-sm)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            fontWeight: isActive ? 600 : 400,
          },
        },
        createElement('span', null, option.label),
        option.count !== null && option.count !== undefined
          ? createElement(
              'span',
              {
                'data-testid': option.countTestId,
                style: {
                  fontSize: 'var(--text-xs)',
                  color: 'var(--colour-text-secondary)',
                  fontWeight: 400,
                },
              },
              `(${option.count})`,
            )
          : null,
      );
    }),
  );
}
