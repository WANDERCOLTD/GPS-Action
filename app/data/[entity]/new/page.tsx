/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Create-row route — `<EntityForm mode="create">`.
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createTRPCContext } from '@/server/routers/context';
import { AppNav } from '@/components/AppNav';
import { entityMetadata } from '@/server/admin/entity-metadata';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { EntityForm } from '@/components/admin/EntityForm';
import { getRegistryEntry } from '@/server/services/admin/registry';
import { ADMIN_ENTITY_KEYS } from '@/shared/validation/admin';
import { adminCreateAction } from '@/app/data/[entity]/actions';

interface PageProps {
  params: Promise<{ entity: string }>;
}

export const metadata = {
  title: 'Data — GPS Action',
};

export default async function DataEntityNewPage({ params }: PageProps) {
  const { entity } = await params;

  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect(`/dev/login?returnTo=/data/${entity}/new`);
  }

  const meta = entityMetadata[entity as EntityKey];
  if (!meta) notFound();
  if (meta.workflow === 'queue') redirect('/requests');
  if (!(ADMIN_ENTITY_KEYS as readonly string[]).includes(entity)) notFound();
  if (!ctx.activeRoles.includes(meta.requiresRole.edit)) notFound();

  const entry = getRegistryEntry(entity as EntityKey);
  const descriptors = entry.formFields.create;
  if (!descriptors) {
    notFound();
  }

  const action = adminCreateAction.bind(null, entity);

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
          href={`/data/${entity}`}
          data-testid="admin-new-back-link"
          style={{
            display: 'inline-block',
            marginBottom: 'var(--space-2)',
            color: 'var(--colour-text-link)',
            fontSize: 'var(--text-sm)',
            textDecoration: 'none',
          }}
        >
          ← Back to {entity}
        </Link>
        <h1 className="gps-title" data-testid="admin-new-title" style={{ margin: 0 }}>
          New {entity}
        </h1>
        <p
          style={{
            margin: 'var(--space-1) 0 var(--space-6)',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-secondary)',
          }}
        >
          Fields validate server-side. Required fields are marked with *.
        </p>
        <EntityForm
          descriptors={descriptors}
          action={action}
          submitLabel={`Create ${entity}`}
          cancelHref={`/data/${entity}`}
        />
      </main>
    </>
  );
}
