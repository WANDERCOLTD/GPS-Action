/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Relation field — selects a foreign key from a related entity.
 *
 * MVP: a single text input that accepts a UUID, with helper text
 * explaining what it points to. A searchable dropdown is a follow-up
 * (see brief's "Out of scope" — relation field write semantics for
 * collections is deferred; scalar FK as a UUID is acceptable for
 * slice 1 admin use).
 */

'use client';

import type { EntityKey } from '@/server/admin/entity-metadata';

interface RelationFieldProps {
  readonly name: string;
  readonly label: string;
  readonly entity: EntityKey;
  readonly required?: boolean;
  readonly defaultValue?: string;
  readonly help?: string;
  readonly error?: string;
}

export function RelationField({
  name,
  label,
  entity,
  required,
  defaultValue,
  help,
  error,
}: RelationFieldProps) {
  const inputId = `admin-field-${name}`;
  const helpText = help ?? `Paste a ${entity} UUID. Searchable dropdown lands later.`;
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <label
        htmlFor={inputId}
        data-testid="admin-form-label"
        data-field-name={name}
        style={{
          display: 'block',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-medium)',
          color: 'var(--colour-text-primary)',
          marginBottom: 'var(--space-1)',
        }}
      >
        {label}
        {required ? (
          <span
            aria-hidden="true"
            style={{ color: 'var(--colour-danger)', marginLeft: 'var(--space-1)' }}
          >
            *
          </span>
        ) : null}
      </label>
      <input
        id={inputId}
        type="text"
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        placeholder="00000000-0000-0000-0000-000000000000"
        data-testid="admin-form-field"
        data-field-name={name}
        data-relation-entity={entity}
        style={{
          width: '100%',
          padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-mono)',
          color: 'var(--colour-text-primary)',
          background: 'var(--colour-surface-sunken)',
          border: `1px solid ${error ? 'var(--colour-danger)' : 'var(--colour-border-strong)'}`,
          borderRadius: 'var(--radius-sm)',
        }}
      />
      <p
        style={{
          margin: 'var(--space-1) 0 0',
          fontSize: 'var(--text-xs)',
          color: 'var(--colour-text-secondary)',
        }}
      >
        {helpText}
      </p>
      {error ? (
        <p
          data-testid="admin-form-field-error"
          data-field-name={name}
          style={{
            margin: 'var(--space-1) 0 0',
            fontSize: 'var(--text-xs)',
            color: 'var(--colour-danger)',
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
