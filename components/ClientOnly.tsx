'use client';

/**
 * @build-unit BU-hydration-fixes
 * @spec build/session-briefs/bu-hydration-fixes.md
 * @spec architecture/decision-log.md (D080)
 *
 * Tiny `useEffect`-gated wrapper that renders a stable `fallback` on the
 * server and on first client paint, then swaps to `children` after mount.
 *
 * The whole point is to keep the server-rendered HTML deterministic for
 * any value that depends on either the browsing context (e.g.
 * `window.location.origin`) or "now" (e.g. `formatDistanceToNow(...)`).
 * Both of those produce SSR/CSR mismatches when consumed inline; gating
 * them behind `useEffect` lines the first client paint up byte-for-byte
 * with the server output, then transitions to the live value once
 * hydration is finished.
 *
 * Preferred over `dynamic({ ssr: false })` for these tiny inline cases:
 * no extra chunk, no loader boundary, no flash-of-empty-content. See
 * D080 for the wider pattern note.
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface ClientOnlyProps {
  /** Stable, SSR-safe content rendered server-side and on first paint. */
  fallback: ReactNode;
  /** Live content rendered after mount on the client. */
  children: ReactNode;
}

export function ClientOnly({ fallback, children }: ClientOnlyProps): ReactNode {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted ? children : fallback;
}
