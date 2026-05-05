/**
 * @build-unit BU-000-scaffold BU-001-lite BU-error-boundary BU-versioning BU-sticky-nav BU-calendar-view
 * @spec architecture/decision-log.md (D003, D065, D073)
 * @spec docs/build/phase-0-foundations.md
 * @spec docs/process/versioning.md
 *
 * Next.js root layout — PWA shell. Renders on every page.
 *
 * Per D065 the layout owns a single sticky `<header>` containing the
 * dev `LoggedInAs` strip, the `AppNav` link strip, and a soft-refresh
 * button. Page content scrolls underneath. Reviewer-access and
 * unread-notification-count are resolved here once and surface on
 * every page (not only on `/requests`).
 *
 * BU-error-boundary (F11) wraps `children` so a single component crash
 * does not take the whole shell down. The sticky header sits OUTSIDE
 * the boundary so the dev identity / nav stay live during a crash.
 * BU-versioning renders the <VersionBadge /> on every page.
 */
import type { ReactNode } from 'react';
import '@/styles/tokens.css';
import '@/styles/components.css';
import { LoggedInAs } from '@/components/auth/LoggedInAs';
import { AppNav } from '@/components/AppNav';
import { HeaderLogo } from '@/components/HeaderLogo';
import { HeaderRefreshButton } from '@/components/HeaderRefreshButton';
import { DevBannerToggle } from '@/components/DevBannerToggle';
import { DevBannerWrapper } from '@/components/DevBannerWrapper';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IntentFab } from '@/components/IntentFab';
import { VersionBadge } from '@/components/VersionBadge';
import { DemoBanner } from '@/components/DemoBanner';
import { createTRPCContext } from '@/server/routers/context';
import { countUnreadForUser } from '@/server/services/notification';
import { countNewForUser } from '@/server/services/notifications-kanban';
import { isFeatureEnabled } from '@/server/services/flags';
import { isDemoMode } from '@/shared/demo-mode';

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

  const [calendarEnabled, coordBoardEnabled] = await Promise.all([
    // BU-calendar-view / D073 — Calendar tab gated by `calendar_enabled`.
    isFeatureEnabled('calendar_enabled'),
    // BU-coordination-board — Board tab gated by `coord_board_v1`.
    isFeatureEnabled('coord_board_v1'),
  ]);

  // Unread badge source switches by flag: kanban callers reach the new
  // `/notifications` pane (lifecycle = new), legacy callers stay on the
  // requests workspace (`readAt IS NULL`). Otherwise the badge counts
  // would diverge from the pane it leads to.
  const unreadNotificationCount = ctx.user
    ? coordBoardEnabled
      ? await countNewForUser(ctx.user.id)
      : await countUnreadForUser(ctx.user.id)
    : 0;

  // The sticky header is suppressed entirely when there is genuinely
  // nothing to render in it — production with no user (LoggedInAs is a
  // dev-only no-op there). In dev there is always at least the
  // "Logged in as / Not logged in" strip, so the header is always shown.
  const showHeader = !!ctx.user || process.env.NODE_ENV !== 'production' || isDemoMode();

  return (
    <html lang="en" data-theme="light">
      <body>
        <DemoBanner />
        {showHeader && (
          <header
            data-testid="nav-header-shell"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 'var(--z-sticky-header)' as unknown as number,
              background: 'var(--colour-surface-raised)',
              borderBottom: '1px solid var(--colour-border-subtle)',
            }}
          >
            <DevBannerWrapper>
              <LoggedInAs user={ctx.user} />
            </DevBannerWrapper>
            {ctx.user && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  paddingRight: 'var(--space-4)',
                }}
              >
                <HeaderLogo />
                <AppNav
                  unreadNotificationCount={unreadNotificationCount}
                  calendarEnabled={calendarEnabled}
                  coordBoardEnabled={coordBoardEnabled}
                />
                <DevBannerToggle enabled={process.env.NODE_ENV !== 'production' || isDemoMode()} />
                <HeaderRefreshButton />
              </div>
            )}
          </header>
        )}
        <ErrorBoundary name="root" fallback={<RootErrorFallback />}>
          {children}
        </ErrorBoundary>
        {ctx.user && <IntentFab />}
        <VersionBadge />
      </body>
    </html>
  );
}
