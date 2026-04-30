/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Edit-row route — `<EntityForm mode="update">` with the row's
 * current values pre-filled.
 */

import { notFound, redirect } from 'next/navigation';
import { ArrowLink } from '@/components/ArrowLink';
import { createTRPCContext } from '@/server/routers/context';
import { entityMetadata } from '@/server/admin/entity-metadata';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { EntityForm } from '@/components/admin/EntityForm';
import { getRegistryEntry } from '@/server/services/admin/registry';
import { getEntityRaw } from '@/server/services/admin/crud';
import { ADMIN_ENTITY_KEYS } from '@/shared/validation/admin';
import { canAccessEntity } from '@/server/services/admin/auth';
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
  if (!canAccessEntity(ctx, entity as EntityKey, 'edit')) notFound();

  const entry = getRegistryEntry(entity as EntityKey);
  const descriptors = entry.formFields.update;
  if (!descriptors) notFound();

  const row = await getEntityRaw(entity as EntityKey, id);
  if (!row) notFound();

  const action = adminUpdateAction.bind(null, entity, id);

  return (
    <main
      style={{
        padding: 'var(--space-6) var(--space-4)',
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <ArrowLink
          href={`/data/${entity}/${id}`}
          direction="back"
          testIdArea="data"
          testIdSuffix="edit-back"
        >
          Back to detail
        </ArrowLink>
      </div>
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
  );
}
