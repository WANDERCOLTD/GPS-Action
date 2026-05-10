'use client';

/**
 * @build-unit bu-ticket-view-fixes (Sub-build B — Item 4)
 * @spec docs/build/session-briefs/bu-ticket-view-fixes.md
 *
 * Transient banner shown on the lifecycle list pages when a viewer is
 * redirected here from the ticket-detail view after losing access via
 * unshare. The page redirects with `?unshared=1`; this component
 * detects the param and renders the toast for a moment before
 * stripping the param from the URL so reloads don't re-show it.
 *
 * A full app-wide flash-message system is out of scope for Sub-build B
 * (would extend to other surfaces — handoff candidate for Sub-build C
 * or a separate brief). This component is the narrow surface needed
 * for Item 4's auto-nav toast contract.
 */

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const PARAM_KEY = 'unshared';

export function UnsharedToast() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (params.get(PARAM_KEY) !== '1') return;
    setVisible(true);

    // Clean the URL so a reload doesn't re-fire the toast — replace,
    // don't push, so the back button doesn't return here.
    const next = new URLSearchParams(params.toString());
    next.delete(PARAM_KEY);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);

    const timer = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(timer);
  }, [params, pathname, router]);

  if (!visible) return null;

  return (
    <div
      data-testid="board-unshared-toast"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 'var(--space-4)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        padding: 'var(--space-2) var(--space-3)',
        background: 'var(--colour-surface-raised)',
        border: '1px solid var(--colour-border-subtle)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 6px 18px color-mix(in oklch, currentColor 12%, transparent)',
        fontSize: 'var(--text-sm)',
        maxWidth: 360,
      }}
    >
      This ticket is no longer shared with your team.
    </div>
  );
}
