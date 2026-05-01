'use client';

/**
 * @build-unit BU-icon-strips
 * @spec docs/build/session-briefs/bu-icon-strips.md
 * @spec docs/product/design-philosophy.md (Glyph register, Rule 4)
 *
 * Shared tooltip primitive for icon-only chip strips. Wraps a single
 * anchor (a `<Link>`, `<button>`, etc.) and reveals a short label on:
 *
 *   - Pointer hover, after 300ms
 *   - Touch long-press, after 600ms
 *
 * Dismissed by:
 *
 *   - Pointer leave / touch end / touch move
 *   - ESC keydown
 *   - Window scroll (capture-phase, so a scrolling chip strip dismisses)
 *
 * Implementation notes:
 *
 *   - The tooltip portals into `document.body` so it escapes the
 *     overflow / mask containers used by FeedFilterChips and AppNav.
 *   - Position is computed once on show, from the anchor's bounding
 *     rect (captured via `event.currentTarget`). Scrolling dismisses
 *     (no continuous re-position needed).
 *   - We attach handlers directly to the inner anchor via
 *     `cloneElement` — no wrapper element is introduced into the DOM,
 *     so existing layout / styling / testids on the anchor are
 *     untouched, and there is no extra "interactive" element for the
 *     F14 testid rule to flag.
 *
 * Used today by AppNav (canary), FeedFilterChips, CommentList filter
 * tabs, and NearMeView's distance/date sort. The `aria-label` of the
 * inner anchor is the source of truth for accessibility; this
 * component's `label` prop is the *visible* tooltip text and may
 * differ slightly (e.g. "Sort by distance" tooltip vs "Distance"
 * aria-label) — both should mean the same thing.
 */

import * as React from 'react';
import { Fragment, cloneElement, isValidElement, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactElement } from 'react';

interface IconChipTooltipProps {
  /** Visible tooltip text — should mirror the anchor's `aria-label`. */
  label: string;
  /** The interactive anchor (Link / button) — exactly one element. */
  children: ReactElement;
}

const HOVER_DELAY_MS = 300;
const LONG_PRESS_MS = 600;

// Tooltip palette uses --colour-text-primary as background and
// --colour-surface-raised as text — both tokens flip on dark mode, so
// the contrast inverts automatically (dark pill on light theme, light
// pill on dark theme).
const tooltipStyle: CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--colour-text-primary)',
  color: 'var(--colour-surface-raised)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-xs)',
  fontWeight: 500,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  boxShadow: 'var(--shadow-md)',
};

interface AnchorRect {
  top: number;
  left: number;
  width: number;
}

interface ChildHandlerProps {
  onMouseEnter?: React.MouseEventHandler;
  onMouseLeave?: React.MouseEventHandler;
  onFocus?: React.FocusEventHandler;
  onBlur?: React.FocusEventHandler;
  onTouchStart?: React.TouchEventHandler;
  onTouchEnd?: React.TouchEventHandler;
  onTouchMove?: React.TouchEventHandler;
  onTouchCancel?: React.TouchEventHandler;
}

function chain<E extends React.SyntheticEvent>(
  user: ((e: E) => void) | undefined,
  ours: (e: E) => void,
): (e: E) => void {
  return (e: E) => {
    user?.(e);
    ours(e);
  };
}

export function IconChipTooltip({ label, children }: IconChipTooltipProps) {
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRectRef = useRef<AnchorRect | null>(null);
  const [mounted, setMounted] = useState(false);

  // SSR guard — `createPortal(..., document.body)` must wait for client.
  useEffect(() => {
    setMounted(true);
  }, []);

  function clearTimer(): void {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function captureRect(target: Element | null): void {
    if (!target) return;
    const r = target.getBoundingClientRect();
    lastRectRef.current = { top: r.top, left: r.left, width: r.width };
  }

  function scheduleShow(delayMs: number, target: Element | null): void {
    clearTimer();
    captureRect(target);
    timerRef.current = setTimeout(() => {
      if (lastRectRef.current) setRect(lastRectRef.current);
    }, delayMs);
  }

  function hide(): void {
    clearTimer();
    setRect(null);
  }

  // Global dismissers — only attached while visible.
  useEffect(() => {
    if (rect === null) return;
    const onScroll = (): void => hide();
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKeydown);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKeydown);
    };
  }, [rect]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => clearTimer();
  }, []);

  if (!isValidElement<ChildHandlerProps>(children)) return children;

  const userProps = children.props;

  const enhanced = cloneElement(children, {
    onMouseEnter: chain<React.MouseEvent>(userProps.onMouseEnter, (e) =>
      scheduleShow(HOVER_DELAY_MS, e.currentTarget),
    ),
    onMouseLeave: chain<React.MouseEvent>(userProps.onMouseLeave, hide),
    onFocus: chain<React.FocusEvent>(userProps.onFocus, (e) =>
      scheduleShow(HOVER_DELAY_MS, e.currentTarget),
    ),
    onBlur: chain<React.FocusEvent>(userProps.onBlur, hide),
    onTouchStart: chain<React.TouchEvent>(userProps.onTouchStart, (e) =>
      scheduleShow(LONG_PRESS_MS, e.currentTarget),
    ),
    onTouchEnd: chain<React.TouchEvent>(userProps.onTouchEnd, hide),
    onTouchMove: chain<React.TouchEvent>(userProps.onTouchMove, hide),
    onTouchCancel: chain<React.TouchEvent>(userProps.onTouchCancel, hide),
  });

  return (
    <Fragment>
      {enhanced}
      {mounted && rect !== null
        ? createPortal(
            <div
              role="tooltip"
              style={{
                ...tooltipStyle,
                top: rect.top - 8,
                left: rect.left + rect.width / 2,
                transform: 'translate(-50%, -100%)',
              }}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </Fragment>
  );
}
