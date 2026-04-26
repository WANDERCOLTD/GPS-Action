/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Generic admin detail page — every field of one row, with an Edit
 * button (gated on `requiresRole.edit`) and a Delete / Restore
 * button when soft-delete applies. Server component.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { TRPCContext } from '@/server/lib/trpc';
import { entityMetadata } from '@/server/admin/entity-metadata';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { getEntityRaw } from '@/server/services/admin/crud';
import { getRegistryEntry } from '@/server/services/admin/registry';
import { RowMutationButton } from '@/components/admin/RowMutationButton';

interface EntityDetailPageProps {
  readonly entity: EntityKey;
  readonly id: string;
  readonly ctx: TRPCContext;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.map(String).join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export async function EntityDetailPage({ entity, id, ctx }: EntityDetailPageProps) {
  const meta = entityMetadata[entity];
  if (!meta) notFound();
  // Confirm the entity is registered (auditLog is, even though it has no
  // mutation methods). Throws NOT_FOUND if not.
  getRegistryEntry(entity);
  const row = await getEntityRaw(entity, id);
  if (!row) notFound();

  const canEdit = ctx.activeRoles.includes(meta.requiresRole.edit);
  const isDeleted = row.deletedAt instanceof Date;
  const fieldNames = Object.keys(row).sort();

  return (
    <section data-testid="admin-detail-section">
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <Link
          href={`/data/${entity}`}
          data-testid="admin-detail-back-link"
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
        <h1 className="gps-title" data-testid="admin-detail-title" style={{ margin: 0 }}>
          {entity} · {String(row[meta.displayField] ?? id).slice(0, 80)}
        </h1>
      </header>

      {isDeleted ? (
        <div
          role="status"
          data-testid="admin-detail-deleted-banner"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            background: 'var(--colour-warning-subtle)',
            border: '1px solid var(--colour-warning)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-primary)',
          }}
        >
          Soft-deleted on {(row.deletedAt as Date).toISOString().slice(0, 10)}. Restore to bring
          this row back into default lists.
        </div>
      ) : null}

      <dl
        data-testid="admin-detail-fields"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(160px, auto) 1fr',
          gap: 'var(--space-2) var(--space-4)',
          fontSize: 'var(--text-sm)',
          margin: 0,
          padding: 'var(--space-4)',
          background: 'var(--colour-surface-raised)',
          border: '1px solid var(--colour-border-subtle)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {fieldNames.map((field) => (
          <FieldRow key={field} name={field} value={row[field]} />
        ))}
      </dl>

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          alignItems: 'center',
          marginTop: 'var(--space-6)',
          flexWrap: 'wrap',
        }}
      >
        {canEdit && getRegistryEntry(entity).update ? (
          <Link
            href={`/data/${entity}/${id}/edit`}
            data-testid="admin-detail-edit-link"
            style={{
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--colour-primary-contrast)',
              background: 'var(--colour-primary)',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
            }}
          >
            Edit
          </Link>
        ) : null}
        {canEdit && meta.softDelete && !isDeleted ? (
          <RowMutationButton entity={entity} id={id} mode="soft" />
        ) : null}
        {canEdit && meta.softDelete && isDeleted ? (
          <RowMutationButton entity={entity} id={id} mode="restore" />
        ) : null}
        {canEdit && !meta.softDelete && getRegistryEntry(entity).hardDelete ? (
          <RowMutationButton entity={entity} id={id} mode="hard" />
        ) : null}
      </div>
    </section>
  );
}

function FieldRow({ name, value }: { name: string; value: unknown }) {
  const isJson =
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    !Array.isArray(value);
  return (
    <>
      <dt style={{ color: 'var(--colour-text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {name}
      </dt>
      <dd
        data-testid="admin-detail-field-value"
        data-field={name}
        style={{
          margin: 0,
          fontFamily: isJson ? 'var(--font-mono)' : 'var(--font-ui)',
          whiteSpace: isJson ? 'pre-wrap' : 'normal',
          wordBreak: 'break-word',
        }}
      >
        {formatValue(value)}
      </dd>
    </>
  );
}
