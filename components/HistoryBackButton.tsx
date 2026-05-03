'use client';

/**
 * @build-unit BU-search-result-cards
 * @spec build/session-briefs/bu-search-result-cards.md
 * @spec product/design-philosophy.md (Surface consistency)
 *
 * Page-level back affordance. Returns to the previous page in
 * `window.history` when one exists; otherwise navigates to
 * `fallbackHref` so direct deep-link visits don't strand the member
 * outside the app.
 *
 * Used by `/search` (header) and `/post/[id]` (detail header). The
 * single primitive replaces ad-hoc "Back to feed" text links — those
 * always pointed at `/feed` regardless of where the member came from,
 * which broke the search → post → back-to-search flow.
 *
 * Renders an icon-only `ChevronLeft` button matching the platform-
 * native pattern (44 × 44 hit target, transparent background, link-
 * colour glyph). Per design-philosophy "Surface consistency" rule:
 * one back primitive across detail surfaces.
 */

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import type { CSSProperties } from 'react';

interface HistoryBackButtonProps {
  /** Where to navigate when there's no history (deep-link / fresh tab). */
  fallbackHref: string;
  /** Accessible label. Defaults to 'Back'. */
  ariaLabel?: string;
}

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 44,
  height: 44,
  padding: 0,
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--colour-text-link)',
  cursor: 'pointer',
};

export function HistoryBackButton({ fallbackHref, ariaLabel = 'Back' }: HistoryBackButtonProps) {
  const router = useRouter();

  function handleClick(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      data-testid="nav-history-back-button"
      data-fallback={fallbackHref}
      style={buttonStyle}
    >
      <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
