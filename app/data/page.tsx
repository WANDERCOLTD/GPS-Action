/**
 * @build-unit BU-requests-foundation
 * @spec architecture/admin-surface.md
 *
 * Data inspection landing — lists every entity in the schema with a
 * link to its (read-only, foundation) list view. Generic CRUD pages
 * are deferred to BU-admin-crud (parking-lot); this stub gives senior
 * users a navigable index of the data model.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLink } from '@/components/ArrowLink';
import { createTRPCContext } from '@/server/routers/context';
import { entityMetadata } from '@/server/admin/entity-metadata';
import { ADMIN_ENTITY_KEYS } from '@/shared/validation/admin';

// Set lookup for "is this entity wired into the registered CRUD pipeline".
// Entities outside this set still appear in `entityMetadata` (so the index
// can show them) but `/data/<key>` will only render a read-only / list view
// without the create / update / delete affordances. We surface that
// distinction here so admins know which tiles go straight to a working
// CRUD page vs which are placeholders.
const ADMIN_ENTITY_KEY_SET = new Set<string>(ADMIN_ENTITY_KEYS);

export const metadata = {
  title: 'Data — GPS Action',
};

export default async function DataIndexPage() {
  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect('/dev/login?returnTo=/data');
  }

  const isAdmin = ctx.activeRoles.includes('admin');

  // Sort: registered CRUD entities first (alphabetical within), then
  // read-only metadata entities (alphabetical within). Per request:
  // "all available items to be marked and position first" — give the
  // working pages prominence so admins see them at a glance.
  const entities = Object.entries(entityMetadata)
    .filter(([_key, meta]) => {
      if (isAdmin) return true;
      const required = meta.requiresRole?.view;
      // Show entities that need queue_manager view if user has queue_manager
      if (required === 'queue_manager') return ctx.activeRoles.includes('queue_manager');
      // Default: show only to admin
      return false;
    })
    .sort(([a], [b]) => {
      const aRegistered = ADMIN_ENTITY_KEY_SET.has(a);
      const bRegistered = ADMIN_ENTITY_KEY_SET.has(b);
      if (aRegistered !== bRegistered) return aRegistered ? -1 : 1;
      return a.localeCompare(b);
    });

  return (
    <main
      style={{
        padding: 'var(--space-6) var(--space-4)',
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <ArrowLink href="/feed" direction="back" testIdArea="data" testIdSuffix="back-feed-top">
          Back to feed
        </ArrowLink>
      </div>
      <h1 className="gps-title" data-testid="data-page-title">
        Data
      </h1>
      <p
        style={{
          color: 'var(--colour-text-secondary)',
          fontSize: 'var(--text-sm)',
          marginBottom: 'var(--space-6)',
        }}
      >
        Inspect the underlying data model. Tiles marked <strong>available</strong> have full CRUD
        (create / update / delete); tiles marked <strong>read-only</strong> are listable but not
        editable from this surface yet. Available entities sort first.
      </p>

      {entities.length === 0 ? (
        <div
          data-testid="data-empty-message"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            padding: 'var(--space-4) 0',
            fontFamily: 'var(--font-ui)',
          }}
        >
          <p style={{ margin: 0, color: 'var(--colour-text-secondary)' }}>
            No data tables visible to your role.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--colour-text-tertiary)',
            }}
          >
            Admins see everything; queue managers see queue tables.
          </p>
        </div>
      ) : (
        <ul
          style={{
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 'var(--space-3)',
          }}
          data-testid="data-entity-list"
        >
          {entities.map(([key, meta]) => {
            const registered = ADMIN_ENTITY_KEY_SET.has(key);
            return (
              <li
                key={key}
                style={{ listStyle: 'none' }}
                data-testid="data-entity-tile"
                data-entity-key={key}
                data-registered={registered ? 'true' : 'false'}
              >
                <Link
                  href={`/data/${key}`}
                  data-testid="data-entity-link"
                  data-entity-key={key}
                  style={{
                    display: 'block',
                    padding: 'var(--space-4)',
                    background: 'var(--colour-surface-raised)',
                    border: registered
                      ? '1px solid var(--colour-border-subtle)'
                      : '1px dashed var(--colour-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    textDecoration: 'none',
                    color: 'inherit',
                    opacity: registered ? 1 : 0.7,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <strong style={{ fontSize: 'var(--text-sm)' }}>{key}</strong>
                    <span
                      data-testid="data-entity-status-pill"
                      data-status={registered ? 'available' : 'read-only'}
                      style={{
                        flexShrink: 0,
                        fontSize: 'var(--text-xs)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: registered
                          ? 'color-mix(in srgb, var(--colour-success) 18%, transparent)'
                          : 'color-mix(in srgb, var(--colour-text-secondary) 12%, transparent)',
                        color: registered
                          ? 'var(--colour-success)'
                          : 'var(--colour-text-secondary)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {registered ? 'available' : 'read-only'}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--colour-text-secondary)',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    {meta.workflow ?? 'standard'} ·{' '}
                    {meta.softDelete ? 'soft-delete' : 'hard-delete'}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p
        style={{
          marginTop: 'var(--space-6)',
          fontSize: 'var(--text-xs)',
          color: 'var(--colour-text-secondary)',
        }}
        data-testid="data-coming-soon"
      >
        New entities are wired in via <code>shared/validation/admin.ts</code>:
        <code>ADMIN_ENTITY_KEYS</code> and <code>server/services/admin/registry.ts</code>. Read-only
        tiles need a registry handler before they flip to <strong>available</strong>.
      </p>
    </main>
  );
}
