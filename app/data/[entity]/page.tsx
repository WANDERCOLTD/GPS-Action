/**
 * @build-unit BU-requests-foundation
 * @spec architecture/admin-surface.md
 *
 * Per-entity inspector stub. The foundation BU surfaces the entity's
 * metadata (display field, list columns, role gates) so senior users
 * can confirm the data model is wired through. Full row-list rendering
 * + CRUD comes in BU-admin-crud.
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createTRPCContext } from '@/server/routers/context';
import { AppNav } from '@/components/AppNav';
import { entityMetadata } from '@/server/admin/entity-metadata';

interface PageProps {
  params: Promise<{ entity: string }>;
}

export const metadata = {
  title: 'Data — GPS Action',
};

export default async function DataEntityPage({ params }: PageProps) {
  const { entity } = await params;
  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect(`/dev/login?returnTo=/data/${entity}`);
  }

  const meta = entityMetadata[entity as keyof typeof entityMetadata];
  if (!meta) notFound();

  const required = meta.requiresRole?.view;
  if (required === 'admin' && !ctx.activeRoles.includes('admin')) notFound();
  if (
    required === 'queue_manager' &&
    !ctx.activeRoles.includes('queue_manager') &&
    !ctx.activeRoles.includes('admin')
  ) {
    notFound();
  }

  return (
    <>
      <AppNav active="data" />
      <main
        style={{
          padding: 'var(--space-6) var(--space-4)',
          maxWidth: 720,
          margin: '0 auto',
        }}
      >
        <Link
          href="/data"
          data-testid="data-back-index-link"
          style={{
            display: 'inline-block',
            marginBottom: 'var(--space-4)',
            color: 'var(--colour-text-link)',
            fontSize: 'var(--text-sm)',
            textDecoration: 'none',
          }}
        >
          ← Back to data
        </Link>
        <h1 className="gps-title" data-testid="data-entity-title">
          {entity}
        </h1>

        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--text-sm)',
            margin: 0,
            padding: 'var(--space-4)',
            background: 'var(--colour-surface-raised)',
            border: '1px solid var(--colour-border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
          data-testid="data-entity-metadata"
        >
          <dt style={{ color: 'var(--colour-text-secondary)' }}>Display field</dt>
          <dd style={{ margin: 0 }}>{meta.displayField}</dd>
          <dt style={{ color: 'var(--colour-text-secondary)' }}>List columns</dt>
          <dd style={{ margin: 0 }}>{meta.listColumns.join(', ')}</dd>
          <dt style={{ color: 'var(--colour-text-secondary)' }}>Workflow</dt>
          <dd style={{ margin: 0 }}>{meta.workflow ?? '—'}</dd>
          <dt style={{ color: 'var(--colour-text-secondary)' }}>Soft delete</dt>
          <dd style={{ margin: 0 }}>{meta.softDelete ? 'yes' : 'no'}</dd>
          {meta.requiresRole && (
            <>
              <dt style={{ color: 'var(--colour-text-secondary)' }}>View role</dt>
              <dd style={{ margin: 0 }}>{meta.requiresRole.view ?? 'any'}</dd>
              <dt style={{ color: 'var(--colour-text-secondary)' }}>Edit role</dt>
              <dd style={{ margin: 0 }}>{meta.requiresRole.edit ?? 'any'}</dd>
            </>
          )}
        </dl>

        <p
          style={{
            marginTop: 'var(--space-6)',
            color: 'var(--colour-text-secondary)',
            fontSize: 'var(--text-sm)',
          }}
          data-testid="data-entity-stub-message"
        >
          Read-only row list + create/edit forms land in BU-admin-crud. Today this page shows the
          entity-metadata contract that the future CRUD generator will use.
        </p>
      </main>
    </>
  );
}
