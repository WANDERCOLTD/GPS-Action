/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Generic text field — renders an `<input type="text">` or
 * `<textarea>` depending on the `multiline` flag. Used by the admin
 * EntityForm.
 *
 * F14: testids on interactive elements are static literals; the
 * varying field identity goes in `data-field-name`.
 */

'use client';

interface TextFieldProps {
  readonly name: string;
  readonly label: string;
  readonly required?: boolean;
  readonly multiline?: boolean;
  readonly help?: string;
  readonly defaultValue?: string;
  readonly error?: string;
}

export function TextField({
  name,
  label,
  required,
  multiline,
  help,
  defaultValue,
  error,
}: TextFieldProps) {
  const inputId = `admin-field-${name}`;
  const baseStyle = {
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
    color: 'var(--colour-text-primary)',
    background: 'var(--colour-surface-sunken)',
    border: `1px solid ${error ? 'var(--colour-danger)' : 'var(--colour-border-strong)'}`,
    borderRadius: 'var(--radius-sm)',
  } as const;

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
      {multiline ? (
        <textarea
          id={inputId}
          name={name}
          defaultValue={defaultValue ?? ''}
          required={required}
          rows={6}
          data-testid="admin-form-field"
          data-field-name={name}
          style={{ ...baseStyle, resize: 'vertical', minHeight: 96 }}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          name={name}
          defaultValue={defaultValue ?? ''}
          required={required}
          data-testid="admin-form-field"
          data-field-name={name}
          style={baseStyle}
        />
      )}
      {help ? (
        <p
          style={{
            margin: 'var(--space-1) 0 0',
            fontSize: 'var(--text-xs)',
            color: 'var(--colour-text-secondary)',
          }}
        >
          {help}
        </p>
      ) : null}
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
