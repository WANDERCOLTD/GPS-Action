'use client';

/**
 * @build-unit bu-page-header-system
 * @spec docs/build/session-briefs/bu-page-header-system.md
 *
 * Sticky wrapper around the root header content. Two jobs:
 *
 *   1. Measure the rendered header height and write it to the
 *      `--app-nav-height` CSS variable on `<html>` so `<PageHeader />`
 *      (which sticks at `top: var(--app-nav-height)`) sits flush
 *      under the AppNav at any breakpoint.
 *
 *   2. Hide the header on sustained scroll-down (>12px) and reveal it
 *      on scroll-up. While hidden, `--app-nav-height` is forced to 0px
 *      so `<PageHeader />` collapses into the freed space — both
 *      surfaces transition together via CSS.
 *
 * Pure CSS transform — no layout shift, no JS animation loop.
 * `data-hidden` is exposed for tests and for any consumer that wants
 * to react to nav visibility.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { useScrollDirection } from '@/shared/hooks/use-scroll-direction';

interface HeaderShellProps {
  children: ReactNode;
}

export function HeaderShell({ children }: HeaderShellProps) {
  const ref = useRef<HTMLElement | null>(null);
  const direction = useScrollDirection();
  const hidden = direction === 'down';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function syncVar() {
      if (!el) return;
      const realHeight = el.offsetHeight;
      document.documentElement.style.setProperty(
        '--app-nav-height',
        hidden ? '0px' : `${realHeight}px`,
      );
    }

    syncVar();
    const ro = new ResizeObserver(syncVar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hidden]);

  return (
    <header
      ref={ref}
      data-testid="nav-header-shell"
      data-hidden={hidden ? 'true' : 'false'}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky-header)' as unknown as number,
        background: 'var(--colour-surface-raised)',
        borderBottom: '1px solid var(--colour-border-subtle)',
        transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 200ms ease',
        willChange: 'transform',
      }}
    >
      {children}
    </header>
  );
}
