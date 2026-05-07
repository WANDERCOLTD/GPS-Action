'use client';

/**
 * @build-unit BU-hydration-fixes
 * @spec build/session-briefs/bu-hydration-fixes.md
 * @spec architecture/decision-log.md (D080)
 *
 * Renders a relative timestamp ("2 minutes ago") without a hydration
 * mismatch. Server-side and on first client paint, the visible text is
 * an absolute fallback (the ISO date by default — short, deterministic,
 * matches what the `<time dateTime>` attribute carries). After mount,
 * `useEffect` flips the text to `formatDistanceToNow(date, { addSuffix:
 * true })`, which is the member-facing affordance we want long-term.
 *
 * Why we keep the relative form instead of dropping back to absolute:
 * the relative form is the established UX (X-ago bucket boundaries are
 * how members orient on a feed). The bug being fixed is the *timing*
 * of the computation, not the format itself. See D080.
 *
 * The `<time>` element always carries the ISO timestamp on
 * `dateTime`, so screen readers and indexers have a stable handle no
 * matter which branch is rendered.
 */

import { formatDistanceToNow } from 'date-fns';
import type { CSSProperties, ReactNode } from 'react';
import { ClientOnly } from '@/components/ClientOnly';

interface RelativeTimeProps {
  /** ISO 8601 string or `Date`. Both are accepted; the component normalises. */
  date: string | Date;
  /**
   * Optional override for the SSR/first-paint fallback string. Default
   * is the ISO date (deterministic, accessible, never wrong).
   */
  fallback?: string;
  /** Optional className passthrough so callers can keep their styling. */
  className?: string;
  /** Optional inline style passthrough. */
  style?: CSSProperties;
}

export function RelativeTime({ date, fallback, className, style }: RelativeTimeProps): ReactNode {
  const iso = typeof date === 'string' ? date : date.toISOString();
  const fallbackText = fallback ?? iso;
  return (
    <ClientOnly
      fallback={
        <time dateTime={iso} className={className} style={style}>
          {fallbackText}
        </time>
      }
    >
      <time dateTime={iso} className={className} style={style}>
        {formatDistanceToNow(new Date(iso), { addSuffix: true })}
      </time>
    </ClientOnly>
  );
}
