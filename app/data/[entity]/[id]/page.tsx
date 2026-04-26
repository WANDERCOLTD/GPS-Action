/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Entity detail route — shows every field of one row, with
 * Edit / Delete / Restore buttons gated server-side.
 */

import { notFound, redirect } from 'next/navigation';
import { createTRPCContext } from '@/server/routers/context';
import { AppNav } from '@/components/AppNav';
import { entityMetadata } from '@/server/admin/entity-metadata';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { EntityDetailPage } from '@/components/admin/EntityDetailPage';
import { ADMIN_ENTITY_KEYS } from '@/shared/validation/admin';

interface PageProps {
  params: Promise<{ entity: string; id: string }>;
}

export const metadata = {
  title: 'Data — GPS Action',
};

export default async function DataEntityDetailPage({ params }: PageProps) {
  const { entity, id } = await params;

  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect(`/dev/login?returnTo=/data/${entity}/${id}`);
  }

  const meta = entityMetadata[entity as EntityKey];
  if (!meta) notFound();
  if (meta.workflow === 'queue') redirect('/requests');
  if (!(ADMIN_ENTITY_KEYS as readonly string[]).includes(entity)) notFound();
  if (!ctx.activeRoles.includes(meta.requiresRole.view)) notFound();

  return (
    <>
      <AppNav active="data" />
      <main
        style={{
          padding: 'var(--space-6) var(--space-4)',
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <EntityDetailPage entity={entity as EntityKey} id={id} ctx={ctx} />
      </main>
    </>
  );
}
