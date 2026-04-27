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
import { createTRPCContext } from '@/server/routers/context';
import { entityMetadata } from '@/server/admin/entity-metadata';

export const metadata = {
  title: 'Data — GPS Action',
};

export default async function DataIndexPage() {
  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect('/dev/login?returnTo=/data');
  }

  const isAdmin = ctx.activeRoles.includes('admin');

  const entities = Object.entries(entityMetadata)
    .filter(([_key, meta]) => {
      if (isAdmin) return true;
      const required = meta.requiresRole?.view;
      // Show entities that need queue_manager view if user has queue_manager
      if (required === 'queue_manager') return ctx.activeRoles.includes('queue_manager');
      // Default: show only to admin
      return false;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <main
      style={{
        padding: 'var(--space-6) var(--space-4)',
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
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
        Inspect the underlying data model. Each entity below is a database table; admins and queue
        managers can browse rows. Full CRUD (create / update / delete) is deferred to a follow-up
        BU.
      </p>

      {entities.length === 0 ? (
        <p
          style={{ color: 'var(--colour-text-secondary)', fontSize: 'var(--text-sm)' }}
          data-testid="data-empty-message"
        >
          No data tables visible to your role. Admins see everything; queue managers see queue
          tables.
        </p>
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
          {entities.map(([key, meta]) => (
            <li
              key={key}
              style={{ listStyle: 'none' }}
              data-testid="data-entity-tile"
              data-entity-key={key}
            >
              <Link
                href={`/data/${key}`}
                data-testid="data-entity-link"
                data-entity-key={key}
                style={{
                  display: 'block',
                  padding: 'var(--space-4)',
                  background: 'var(--colour-surface-raised)',
                  border: '1px solid var(--colour-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <strong style={{ fontSize: 'var(--text-sm)' }}>{key}</strong>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--colour-text-secondary)',
                    marginTop: 'var(--space-1)',
                  }}
                >
                  {meta.workflow ?? 'standard'} · {meta.softDelete ? 'soft-delete' : 'hard-delete'}
                </div>
              </Link>
            </li>
          ))}
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
        Per-entity list pages and CRUD actions land in BU-admin-crud (parking-lot). Today this is a
        navigable index only.
      </p>
    </main>
  );
}
