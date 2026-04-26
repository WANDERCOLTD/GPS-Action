/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Generic admin list page — table view of every row of a single
 * entity. Reads `entityMetadata[entity]` for column / sort / search
 * config; reads the registry's `list` for the rows themselves.
 *
 * Server component. The search box is intentionally a plain GET
 * form so URL state survives refresh / share. The "New" button is
 * gated server-side on `requiresRole.edit`.
 */

import Link from 'next/link';
import type { TRPCContext } from '@/server/lib/trpc';
import { entityMetadata } from '@/server/admin/entity-metadata';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { listEntity } from '@/server/services/admin/crud';

interface EntityListPageProps {
  readonly entity: EntityKey;
  readonly ctx: TRPCContext;
  readonly search?: string;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export async function EntityListPage({ entity, ctx, search }: EntityListPageProps) {
  const meta = entityMetadata[entity];
  if (!meta) {
    return null;
  }
  const canEdit = ctx.activeRoles.includes(meta.requiresRole.edit);
  const { rows, total } = await listEntity(entity, { search });

  return (
    <section data-testid="admin-list-section">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="gps-title" data-testid="admin-list-title" style={{ margin: 0 }}>
            {entity}
          </h1>
          <p
            style={{
              margin: 'var(--space-1) 0 0',
              fontSize: 'var(--text-sm)',
              color: 'var(--colour-text-secondary)',
            }}
            data-testid="admin-list-summary"
          >
            {total} {total === 1 ? 'row' : 'rows'}
            {meta.softDelete ? ' · soft-deleted hidden by default' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <form
            method="get"
            action={`/data/${entity}`}
            data-testid="admin-list-search-form"
            style={{ display: 'flex', gap: 'var(--space-2)' }}
          >
            <input
              type="search"
              name="search"
              defaultValue={search ?? ''}
              placeholder={
                meta.searchableFields && meta.searchableFields.length > 0
                  ? `Search ${meta.searchableFields.join(', ')}`
                  : 'Search'
              }
              data-testid="admin-list-search"
              aria-label={`Search ${entity}`}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-ui)',
                color: 'var(--colour-text-primary)',
                background: 'var(--colour-surface-sunken)',
                border: '1px solid var(--colour-border-strong)',
                borderRadius: 'var(--radius-sm)',
                minWidth: 220,
              }}
            />
            <button
              type="submit"
              data-testid="admin-list-search-submit"
              style={{
                padding: 'var(--space-2) var(--space-4)',
                fontSize: 'var(--text-sm)',
                color: 'var(--colour-text-primary)',
                background: 'var(--colour-surface-raised)',
                border: '1px solid var(--colour-border-strong)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              Search
            </button>
          </form>
          {canEdit ? (
            <Link
              href={`/data/${entity}/new`}
              data-testid="admin-list-new-link"
              style={{
                padding: 'var(--space-2) var(--space-4)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--colour-primary-contrast)',
                background: 'var(--colour-primary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
              }}
            >
              + New
            </Link>
          ) : null}
        </div>
      </header>

      {rows.length === 0 ? (
        <div
          data-testid="admin-list-empty"
          style={{
            padding: 'var(--space-6)',
            background: 'var(--colour-surface-raised)',
            border: '1px solid var(--colour-border-subtle)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}
        >
          <p
            style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--colour-text-secondary)' }}
          >
            {search ? 'No rows match your search.' : 'No rows yet.'}
          </p>
          {canEdit && !search ? (
            <Link
              href={`/data/${entity}/new`}
              data-testid="admin-list-empty-create"
              style={{
                display: 'inline-block',
                marginTop: 'var(--space-3)',
                fontSize: 'var(--text-sm)',
                color: 'var(--colour-text-link)',
                textDecoration: 'none',
              }}
            >
              Create one →
            </Link>
          ) : null}
        </div>
      ) : (
        <div
          style={{
            overflowX: 'auto',
            background: 'var(--colour-surface-raised)',
            border: '1px solid var(--colour-border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <table
            data-testid="admin-list-table"
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--colour-border-subtle)' }}>
                {meta.listColumns.map((col) => (
                  <th
                    key={col}
                    style={{
                      textAlign: 'left',
                      padding: 'var(--space-3) var(--space-4)',
                      fontWeight: 'var(--weight-semibold)',
                      color: 'var(--colour-text-secondary)',
                      fontSize: 'var(--text-xs)',
                      letterSpacing: 'var(--tracking-wide)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  data-testid="admin-list-row"
                  data-row-id={row.id}
                  style={{ borderBottom: '1px solid var(--colour-border-subtle)' }}
                >
                  {meta.listColumns.map((col, idx) => (
                    <td
                      key={col}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        verticalAlign: 'top',
                      }}
                    >
                      {idx === 0 ? (
                        <Link
                          href={`/data/${entity}/${row.id}`}
                          data-testid="admin-list-row-link"
                          data-row-id={row.id}
                          style={{ color: 'var(--colour-text-link)', textDecoration: 'none' }}
                        >
                          {formatCell(row[col])}
                        </Link>
                      ) : (
                        formatCell(row[col])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details style={{ marginTop: 'var(--space-6)' }} data-testid="admin-list-schema-disclosure">
        <summary
          style={{
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-secondary)',
          }}
        >
          Schema (entity-metadata.ts)
        </summary>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--text-sm)',
            margin: 'var(--space-3) 0 0',
            padding: 'var(--space-4)',
            background: 'var(--colour-surface-canvas)',
            border: '1px solid var(--colour-border-subtle)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <dt style={{ color: 'var(--colour-text-secondary)' }}>Display field</dt>
          <dd style={{ margin: 0 }}>{meta.displayField}</dd>
          <dt style={{ color: 'var(--colour-text-secondary)' }}>List columns</dt>
          <dd style={{ margin: 0 }}>{meta.listColumns.join(', ')}</dd>
          <dt style={{ color: 'var(--colour-text-secondary)' }}>Soft delete</dt>
          <dd style={{ margin: 0 }}>{meta.softDelete ? 'yes' : 'no'}</dd>
          <dt style={{ color: 'var(--colour-text-secondary)' }}>View role</dt>
          <dd style={{ margin: 0 }}>{meta.requiresRole.view}</dd>
          <dt style={{ color: 'var(--colour-text-secondary)' }}>Edit role</dt>
          <dd style={{ margin: 0 }}>{meta.requiresRole.edit}</dd>
          {meta.notes ? (
            <>
              <dt style={{ color: 'var(--colour-text-secondary)' }}>Notes</dt>
              <dd style={{ margin: 0 }}>{meta.notes}</dd>
            </>
          ) : null}
        </dl>
      </details>
    </section>
  );
}
