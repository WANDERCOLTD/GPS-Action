/**
 * @build-unit BU-000-scaffold BU-001-lite BU-error-boundary
 * @spec architecture/decision-log.md (D003)
 * @spec docs/build/phase-0-foundations.md
 *
 * Next.js root layout — PWA shell. Renders on every page.
 * BU-001-lite adds the LoggedInAs header for dev user switching.
 * BU-error-boundary (F11) wraps `children` so a single component crash
 * does not take the whole shell down. <LoggedInAs /> sits OUTSIDE the
 * boundary so the dev header stays live during a crash.
 */
import type { ReactNode } from 'react';
import '@/styles/tokens.css';
import '@/styles/components.css';
import { LoggedInAs } from '@/components/auth/LoggedInAs';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IntentFab } from '@/components/IntentFab';
import { createTRPCContext } from '@/server/routers/context';

export const metadata = {
  title: 'GPS Action',
  description: 'Coordinated activism platform',
};

/**
 * Top-level fallback for the root error boundary. Text-only by design —
 * no interactive elements, so F14 (require-testid) does not fire and we
 * avoid manufacturing a "Try again" affordance that doesn't yet have a
 * real recovery story. Honest copy per design-philosophy.md: no fake
 * "we've notified our team" until the notification pipeline is real.
 */
function RootErrorFallback() {
  return (
    <div
      role="alert"
      style={{
        margin: 'var(--space-6) auto',
        maxWidth: '40rem',
        padding: 'var(--space-5) var(--space-6)',
        background: 'var(--colour-surface-raised)',
        border: '1px solid var(--colour-border-subtle)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--colour-text-primary)',
        fontFamily: 'var(--font-ui)',
        lineHeight: 'var(--line-normal)',
      }}
    >
      <h1
        style={{
          margin: 0,
          marginBottom: 'var(--space-2)',
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--weight-semibold)',
        }}
      >
        Something went wrong loading this page
      </h1>
      <p style={{ margin: 0, color: 'var(--colour-text-secondary)' }}>
        Try refreshing. If it keeps happening, the error has been logged.
      </p>
    </div>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const ctx = await createTRPCContext();

  return (
    <html lang="en" data-theme="light">
      <body>
        <LoggedInAs user={ctx.user} />
        <ErrorBoundary name="root" fallback={<RootErrorFallback />}>
          {children}
        </ErrorBoundary>
        {ctx.user && <IntentFab />}
      </body>
    </html>
  );
}
