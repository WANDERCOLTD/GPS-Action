/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Entity list route. Replaces BU-requests-foundation's metadata-only
 * stub with a real table backed by the generic admin engine.
 *
 * - Auth: redirects to /dev/login when unauthed; 404s on insufficient role.
 * - Workflow=queue entities (request) redirect to /requests (Q4).
 * - Search comes through the URL `?search=` — preserved on refresh.
 */

import { notFound, redirect } from 'next/navigation';
import { ArrowLink } from '@/components/ArrowLink';
import { createTRPCContext } from '@/server/routers/context';
import { entityMetadata } from '@/server/admin/entity-metadata';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { EntityListPage } from '@/components/admin/EntityListPage';
import { ADMIN_ENTITY_KEYS } from '@/shared/validation/admin';
import { canAccessEntity } from '@/server/services/admin/auth';
import { adminBulkAction } from '@/app/data/[entity]/bulk-actions';

interface PageProps {
  params: Promise<{ entity: string }>;
  searchParams: Promise<{ search?: string }>;
}

export const metadata = {
  title: 'Data — GPS Action',
};

export default async function DataEntityPage({ params, searchParams }: PageProps) {
  const { entity } = await params;
  const { search } = await searchParams;

  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect(`/dev/login?returnTo=/data/${entity}`);
  }

  const meta = entityMetadata[entity as EntityKey];
  if (!meta) notFound();

  // Q4: queue-workflow entities live under /requests, not /data.
  if (meta.workflow === 'queue') {
    redirect('/requests');
  }

  // Slice 1: only registered entities render. Future slices add to ADMIN_ENTITY_KEYS.
  if (!(ADMIN_ENTITY_KEYS as readonly string[]).includes(entity)) {
    notFound();
  }

  // Server-side role gate (also enforced in the procedure middleware).
  if (!canAccessEntity(ctx, entity as EntityKey, 'view')) notFound();

  return (
    <main
      style={{
        padding: 'var(--space-6) var(--space-4)',
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <ArrowLink
          href="/data"
          direction="back"
          testIdArea="data"
          testIdSuffix="list-back-index"
        >
          Back to data
        </ArrowLink>
      </div>
      <EntityListPage
        entity={entity as EntityKey}
        ctx={ctx}
        search={search}
        bulkAction={adminBulkAction.bind(null, entity)}
      />
    </main>
  );
}
