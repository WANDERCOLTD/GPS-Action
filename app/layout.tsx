/**
 * @build-unit BU-000-scaffold BU-001-lite BU-error-boundary BU-versioning BU-sticky-nav BU-calendar-view bu-page-header-system
 * @spec architecture/decision-log.md (D003, D065, D073)
 * @spec docs/build/phase-0-foundations.md
 * @spec docs/process/versioning.md
 * @spec docs/build/session-briefs/bu-page-header-system.md
 *
 * Next.js root layout — PWA shell. Renders on every page.
 *
 * Per D065 the layout owns a single sticky `<header>`. Page content
 * scrolls underneath. Reviewer-access and unread-notification-count
 * are resolved here once and surface on every page.
 *
 * bu-page-header-system (2026-05-12): the sticky header is wrapped in
 * `<HeaderShell>` which (1) writes its rendered height to the
 * `--app-nav-height` CSS variable so per-page `<PageHeader>` mounts
 * sit flush below it, and (2) hides the header on sustained
 * scroll-down so reading surfaces get the full viewport. Identity,
 * soft-refresh, and Settings consolidated into `<UserMenu>` —
 * retired three separate header controls (`<LoggedInAs />`,
 * `<HeaderRefreshButton />`, the Settings `<AppNav>` icon).
 *
 * BU-error-boundary (F11) wraps `children` so a single component crash
 * does not take the whole shell down. The sticky header sits OUTSIDE
 * the boundary so the dev identity / nav stay live during a crash.
 * BU-versioning renders the <VersionBadge /> on every page.
 */
import type { ReactNode } from 'react';
import '@/styles/tokens.css';
import '@/styles/components.css';
import { AppNav } from '@/components/AppNav';
import { HeaderLogo } from '@/components/HeaderLogo';
import { HeaderShell } from '@/components/HeaderShell';
import { UserMenu } from '@/components/UserMenu';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IntentFab } from '@/components/IntentFab';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
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

  const [
    calendarEnabled,
    coordBoardEnabled,
    networkFeedEnabled,
    networkFirstEnabled,
    feedTabHidden,
  ] = await Promise.all([
    // BU-calendar-view / D073 — Calendar tab gated by `calendar_enabled`.
    isFeatureEnabled('calendar_enabled'),
    // BU-coordination-board — Board tab gated by `coord_board_v1`.
    isFeatureEnabled('coord_board_v1'),
    // BU-network-feed / D083 — Network tab gated by `network_feed`.
    isFeatureEnabled('network_feed'),
    // bu-network-first — dims Feed/Calendar/Requests as legacy.
    isFeatureEnabled('network_first'),
    // bu-network-first — hides Feed tab entirely when on (default OFF so Feed stays visible).
    isFeatureEnabled('hide_feed_tab'),
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

  // Header shows whenever there's a user, OR we're in dev / demo mode
  // (where the UserMenu still renders a "Sign in" affordance even
  // without an authed user). Production with no user → no header.
  const isDev = process.env.NODE_ENV !== 'production' || isDemoMode();
  const showHeader = !!ctx.user || isDev;
  const menuUser = ctx.user ? { displayName: ctx.user.displayName } : null;

  return (
    <html lang="en" data-theme="light">
      <body>
        <DemoBanner />
        {showHeader && (
          <HeaderShell>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                paddingRight: 'var(--space-4)',
              }}
            >
              <HeaderLogo />
              {ctx.user && (
                <AppNav
                  unreadNotificationCount={unreadNotificationCount}
                  calendarEnabled={calendarEnabled}
                  coordBoardEnabled={coordBoardEnabled}
                  networkFeedEnabled={networkFeedEnabled}
                  networkFirstEnabled={networkFirstEnabled}
                  feedTabVisible={!feedTabHidden}
                />
              )}
              <div style={{ marginLeft: 'auto' }}>
                <UserMenu user={menuUser} isDev={isDev} />
              </div>
            </div>
          </HeaderShell>
        )}
        <ErrorBoundary name="root" fallback={<RootErrorFallback />}>
          {children}
        </ErrorBoundary>
        {ctx.user && <IntentFab />}
        {ctx.user && <KeyboardShortcuts />}
        <VersionBadge />
      </body>
    </html>
  );
}
