/**
 * @build-unit BU-001-lite
 * @spec architecture/environments.md
 *
 * Dev-only layout. Returns 404 in production so /dev/* routes are
 * unreachable. Defence-in-depth alongside the dev router's conditional
 * registration in _app.ts.
 */

import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { isDemoMode } from '@/shared/demo-mode';

export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production' && !isDemoMode()) {
    notFound();
  }

  return (
    <div
      style={{
        borderTop: '3px solid var(--colour-warning)',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          background: 'var(--colour-warning-subtle)',
          padding: 'var(--space-1) var(--space-4)',
          fontSize: 'var(--text-xs)',
          color: 'var(--colour-text-secondary)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        DEV TOOLS — not available in production
      </div>
      {children}
    </div>
  );
}
