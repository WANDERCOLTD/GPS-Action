/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Edit-row route — `<EntityForm mode="update">` with the row's
 * current values pre-filled.
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createTRPCContext } from '@/server/routers/context';
import { AppNav } from '@/components/AppNav';
import { entityMetadata } from '@/server/admin/entity-metadata';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { EntityForm } from '@/components/admin/EntityForm';
import { getRegistryEntry } from '@/server/services/admin/registry';
import { getEntityRaw } from '@/server/services/admin/crud';
import { ADMIN_ENTITY_KEYS } from '@/shared/validation/admin';
import { adminUpdateAction } from '@/app/data/[entity]/actions';

interface PageProps {
  params: Promise<{ entity: string; id: string }>;
}

export const metadata = {
  title: 'Data — GPS Action',
};

export default async function DataEntityEditPage({ params }: PageProps) {
  const { entity, id } = await params;

  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect(`/dev/login?returnTo=/data/${entity}/${id}/edit`);
  }

  const meta = entityMetadata[entity as EntityKey];
  if (!meta) notFound();
  if (meta.workflow === 'queue') redirect('/requests');
  if (!(ADMIN_ENTITY_KEYS as readonly string[]).includes(entity)) notFound();
  if (!ctx.activeRoles.includes(meta.requiresRole.edit)) notFound();

  const entry = getRegistryEntry(entity as EntityKey);
  const descriptors = entry.formFields.update;
  if (!descriptors) notFound();

  const row = await getEntityRaw(entity as EntityKey, id);
  if (!row) notFound();

  const action = adminUpdateAction.bind(null, entity, id);

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
          href={`/data/${entity}/${id}`}
          data-testid="admin-edit-back-link"
          style={{
            display: 'inline-block',
            marginBottom: 'var(--space-2)',
            color: 'var(--colour-text-link)',
            fontSize: 'var(--text-sm)',
            textDecoration: 'none',
          }}
        >
          ← Back to detail
        </Link>
        <h1 className="gps-title" data-testid="admin-edit-title" style={{ margin: 0 }}>
          Edit {entity}
        </h1>
        <p
          style={{
            margin: 'var(--space-1) 0 var(--space-6)',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-secondary)',
          }}
        >
          Fields validate server-side. Empty optional fields stay unchanged.
        </p>
        <EntityForm
          descriptors={descriptors}
          defaults={row}
          action={action}
          submitLabel="Save changes"
          cancelHref={`/data/${entity}/${id}`}
        />
      </main>
    </>
  );
}
