/**
 * @build-unit BU-requests-foundation
 * @spec architecture/admin-surface.md
 * @spec architecture/decision-log.md (D054)
 *
 * Settings landing — stub. The foundation BU surfaces a navigable
 * placeholder so senior users see the slot exists. Real settings (
 * account, notifications, feature-flag admin, urgent TTL admin)
 * land in their respective BUs.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLink } from '@/components/ArrowLink';
import { PageHeader } from '@/components/PageHeader';
import { createTRPCContext } from '@/server/routers/context';

export const metadata = {
  title: 'Settings — GPS Action',
};

export default async function SettingsPage() {
  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect('/dev/login?returnTo=/settings');
  }

  const isAdmin = ctx.activeRoles.includes('admin');
  const isQueueManager = ctx.activeRoles.includes('queue_manager');
  const canSeeData = isAdmin || isQueueManager;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Account preferences, notification settings, and admin controls"
      />
      <main
        style={{
          padding: 'var(--space-5) var(--space-4) var(--space-6)',
          maxWidth: 720,
          margin: '0 auto',
        }}
      >
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ArrowLink
            href="/feed"
            direction="back"
            testIdArea="settings"
            testIdSuffix="back-feed-top"
          >
            Back to feed
          </ArrowLink>
        </div>
        <p
          style={{
            color: 'var(--colour-text-secondary)',
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-6)',
          }}
        >
          Most of these surfaces are stubs today; they land in their own BUs.
        </p>

        <ul
          style={{
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
          data-testid="settings-section-list"
        >
          <li
            style={{
              listStyle: 'none',
              padding: 'var(--space-4)',
              background: 'var(--colour-surface-raised)',
              border: '1px solid var(--colour-border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}
            data-testid="settings-section-account"
          >
            <strong style={{ fontSize: 'var(--text-sm)' }}>Account</strong>
            <p
              style={{
                margin: 'var(--space-1) 0 0 0',
                fontSize: 'var(--text-xs)',
                color: 'var(--colour-text-secondary)',
              }}
            >
              Display name, email, phone, profile photo. Lands in BU-account.
            </p>
          </li>
          <li
            style={{
              listStyle: 'none',
              padding: 'var(--space-4)',
              background: 'var(--colour-surface-raised)',
              border: '1px solid var(--colour-border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}
            data-testid="settings-section-notifications"
          >
            <strong style={{ fontSize: 'var(--text-sm)' }}>Notifications</strong>
            <p
              style={{
                margin: 'var(--space-1) 0 0 0',
                fontSize: 'var(--text-xs)',
                color: 'var(--colour-text-secondary)',
              }}
            >
              In-app + push preferences. Lands with BU-requests-vetting (D057 Notifications entity).
            </p>
          </li>
          {canSeeData && (
            <li
              style={{
                listStyle: 'none',
                padding: 0,
                background: 'var(--colour-surface-raised)',
                border: '1px solid var(--colour-border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
              data-testid="settings-section-data"
            >
              <Link
                href="/data"
                data-testid="settings-data-link"
                style={{
                  display: 'block',
                  padding: 'var(--space-4)',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <strong style={{ fontSize: 'var(--text-sm)' }}>Data →</strong>
                <p
                  style={{
                    margin: 'var(--space-1) 0 0 0',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--colour-text-secondary)',
                  }}
                >
                  Inspect entities in the data model. Admins see all tables; queue managers see
                  queue tables. Read-only today; full CRUD lands in BU-admin-crud.
                </p>
              </Link>
            </li>
          )}
          {isAdmin && (
            <>
              <li
                style={{
                  listStyle: 'none',
                  padding: 'var(--space-4)',
                  background: 'var(--colour-surface-raised)',
                  border: '1px solid var(--colour-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
                data-testid="settings-section-feature-flags"
              >
                <strong style={{ fontSize: 'var(--text-sm)' }}>Feature flags (admin)</strong>
                <p
                  style={{
                    margin: 'var(--space-1) 0 0 0',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--colour-text-secondary)',
                  }}
                >
                  Toggle ff_reactions, ff_comments, etc. Lands as part of BU-admin-crud or its own
                  small BU. Today: read-only — see the Data section above (featureFlag entity).
                </p>
              </li>
              <li
                style={{
                  listStyle: 'none',
                  padding: 'var(--space-4)',
                  background: 'var(--colour-surface-raised)',
                  border: '1px solid var(--colour-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
                data-testid="settings-section-urgent-ttl"
              >
                <strong style={{ fontSize: 'var(--text-sm)' }}>Urgent TTL (admin)</strong>
                <p
                  style={{
                    margin: 'var(--space-1) 0 0 0',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--colour-text-secondary)',
                  }}
                >
                  Default 4h per D058. Editable here once BU-requests-urgent ships the SystemSetting
                  model.
                </p>
              </li>
            </>
          )}
        </ul>

        <div
          style={{
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--colour-border-subtle)',
          }}
        >
          <ArrowLink href="/feed" direction="back" testIdArea="settings" testIdSuffix="back-feed">
            Back to feed
          </ArrowLink>
        </div>
      </main>
    </>
  );
}
