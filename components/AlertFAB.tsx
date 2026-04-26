/**
 * @build-unit BU-requests-urgent
 * @spec architecture/decision-log.md (D044, D058, D061)
 * @spec product/scenarios.md (SCN-23)
 *
 * Alert tile FAB — red warning triangle + exclamation. Single-tap
 * opens the alert composer per D044's intent-cards model. Per D058
 * this is the primary entry point for "something urgent is happening
 * right now".
 *
 * Per D061: a single explicit interactive element with a known action.
 */

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export function AlertFAB() {
  return (
    <Link
      href="/alert/new"
      data-testid="feed-alert-fab"
      aria-label="Raise an urgent alert"
      style={{
        position: 'fixed',
        bottom: 'var(--space-6)',
        right: 'var(--space-6)',
        width: 56,
        height: 56,
        borderRadius: 'var(--radius-circle)',
        background: 'var(--colour-urgent)',
        color: 'var(--colour-urgent-contrast)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px color-mix(in srgb, var(--colour-urgent) 35%, transparent)',
        textDecoration: 'none',
        zIndex: 100,
      }}
    >
      <AlertTriangle size={28} aria-hidden="true" strokeWidth={2.5} />
    </Link>
  );
}
