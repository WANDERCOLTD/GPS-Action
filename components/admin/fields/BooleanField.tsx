/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Boolean checkbox field for the admin EntityForm.
 */

'use client';

interface BooleanFieldProps {
  readonly name: string;
  readonly label: string;
  readonly defaultValue?: boolean;
  readonly help?: string;
}

export function BooleanField({ name, label, defaultValue, help }: BooleanFieldProps) {
  const inputId = `admin-field-${name}`;
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <label
        htmlFor={inputId}
        data-testid="admin-form-label"
        data-field-name={name}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
          color: 'var(--colour-text-primary)',
        }}
      >
        <input
          id={inputId}
          type="checkbox"
          name={name}
          defaultChecked={defaultValue}
          value="true"
          data-testid="admin-form-field"
          data-field-name={name}
        />
        {label}
      </label>
      {help ? (
        <p
          style={{
            margin: 'var(--space-1) 0 0 var(--space-6)',
            fontSize: 'var(--text-xs)',
            color: 'var(--colour-text-secondary)',
          }}
        >
          {help}
        </p>
      ) : null}
    </div>
  );
}
