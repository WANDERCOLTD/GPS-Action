/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * One-click boolean flip in the entity list cell. Used for fields
 * on the server-side `INLINE_TOGGLE_ALLOWLIST` (currently
 * featureFlag.enabledGlobally) — every other boolean still renders
 * as plain "yes"/"no" text via formatCell.
 *
 * Goes through `caller.admin.update`, so the audit log fires
 * automatically. Pending state shows the new value optimistically;
 * on error we revert and surface the message inline.
 */

'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { adminToggleBooleanAction } from '@/app/data/[entity]/actions';

interface InlineBooleanToggleProps {
  readonly entity: string;
  readonly id: string;
  readonly field: string;
  readonly value: boolean;
  readonly disabled?: boolean;
  readonly label?: string;
}

export function InlineBooleanToggle({
  entity,
  id,
  field,
  value,
  disabled,
  label,
}: InlineBooleanToggleProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticValue, setOptimisticValue] = useOptimistic(value);

  const handleClick = () => {
    if (disabled || pending) return;
    setError(null);
    const next = !optimisticValue;
    startTransition(async () => {
      setOptimisticValue(next);
      const result = await adminToggleBooleanAction(entity, id, field, next);
      if (!result.ok) {
        setError(result.message);
      }
    });
  };

  const trackOn = optimisticValue;
  const accessibleLabel = label ?? `Toggle ${field}`;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <button
        type="button"
        role="switch"
        aria-checked={trackOn}
        aria-label={accessibleLabel}
        onClick={handleClick}
        disabled={disabled || pending}
        data-testid="admin-list-inline-toggle"
        data-row-id={id}
        data-field={field}
        data-value={trackOn ? 'true' : 'false'}
        style={{
          position: 'relative',
          width: 36,
          height: 20,
          padding: 0,
          background: trackOn ? 'var(--colour-success)' : 'var(--colour-border-strong)',
          border: '1px solid',
          borderColor: trackOn ? 'var(--colour-success)' : 'var(--colour-border-strong)',
          borderRadius: 999,
          cursor: disabled ? 'not-allowed' : pending ? 'wait' : 'pointer',
          opacity: disabled ? 0.5 : pending ? 0.7 : 1,
          transition: 'background 120ms ease, border-color 120ms ease',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 1,
            left: trackOn ? 17 : 1,
            width: 16,
            height: 16,
            background: 'var(--colour-primary-contrast)',
            borderRadius: '50%',
            transition: 'left 120ms ease',
          }}
        />
      </button>
      {error ? (
        <span
          role="alert"
          data-testid="admin-list-inline-toggle-error"
          data-row-id={id}
          style={{ fontSize: 'var(--text-xs)', color: 'var(--colour-danger)' }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
