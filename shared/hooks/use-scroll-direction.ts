'use client';

/**
 * @build-unit bu-page-header-system
 * @spec docs/build/session-briefs/bu-page-header-system.md
 *
 * Sustained-threshold scroll-direction hook. Returns the direction of
 * meaningful (over-threshold) scroll motion — `'up' | 'down' | null`.
 * Used by HeaderShell to slide the AppNav out of the way on
 * scroll-down and bring it back on scroll-up.
 *
 * Threshold defaults to 12px so iOS rubber-band bounces near the top
 * of the page don't flip-flop direction. `topZone` clamps direction to
 * `null` while the viewport is within the first 40px of the document —
 * no point hiding chrome before the user has actually scrolled.
 */

import { useEffect, useState } from 'react';

export type ScrollDirection = 'up' | 'down' | null;

interface UseScrollDirectionOptions {
  threshold?: number;
  topZone?: number;
}

export function useScrollDirection(options: UseScrollDirectionOptions = {}): ScrollDirection {
  const { threshold = 12, topZone = 40 } = options;
  const [direction, setDirection] = useState<ScrollDirection>(null);

  useEffect(() => {
    let lastY = window.scrollY;
    let accumulated = 0;
    let frame: number | null = null;

    function update() {
      frame = null;
      const y = window.scrollY;
      const delta = y - lastY;

      if (y <= topZone) {
        accumulated = 0;
        lastY = y;
        setDirection((d) => (d === 'down' ? null : d));
        return;
      }

      // Reset accumulator when direction reverses so a brief jiggle
      // doesn't have to overcome prior accumulated motion.
      if ((delta > 0 && accumulated < 0) || (delta < 0 && accumulated > 0)) {
        accumulated = 0;
      }
      accumulated += delta;

      if (accumulated > threshold) {
        setDirection('down');
        accumulated = 0;
      } else if (accumulated < -threshold) {
        setDirection('up');
        accumulated = 0;
      }
      lastY = y;
    }

    function onScroll() {
      if (frame !== null) return;
      frame = requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [threshold, topZone]);

  return direction;
}
