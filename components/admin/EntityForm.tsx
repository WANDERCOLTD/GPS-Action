/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Generic form for admin create / update. Reads
 * `FormFieldDescriptor[]` props and renders type-aware field
 * components. Submits via the `action` server action passed in by
 * the route page. Field-level validation errors come back via
 * `actionResult.fieldErrors` and are rendered inline.
 *
 * Per Q2 (locked): registry-Zod approach — descriptors are
 * server-derived from the same source as the Zod schemas.
 */

'use client';

import { useActionState } from 'react';
import type { FormFieldDescriptor } from '@/server/services/admin/types';
import { TextField } from '@/components/admin/fields/TextField';
import { EnumField } from '@/components/admin/fields/EnumField';
import { BooleanField } from '@/components/admin/fields/BooleanField';
import { RelationField } from '@/components/admin/fields/RelationField';
import { NumberField } from '@/components/admin/fields/NumberField';

export type EntityFormState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'error';
      readonly message: string;
      readonly fieldErrors?: Record<string, string>;
    }
  | { readonly status: 'ok'; readonly id: string };

export type EntityFormAction = (
  state: EntityFormState,
  formData: FormData,
) => Promise<EntityFormState>;

interface EntityFormProps {
  readonly descriptors: ReadonlyArray<FormFieldDescriptor>;
  readonly defaults?: Record<string, unknown>;
  readonly action: EntityFormAction;
  readonly submitLabel: string;
  readonly cancelHref: string;
}

function defaultValueFor(descriptor: FormFieldDescriptor, defaults?: Record<string, unknown>) {
  if (!defaults) return undefined;
  const raw = defaults[descriptor.name];
  if (raw === undefined || raw === null) return undefined;
  if (descriptor.type === 'boolean') return Boolean(raw);
  if (descriptor.type === 'number') return typeof raw === 'number' ? raw : String(raw);
  if (descriptor.type === 'relation') return String(raw);
  return String(raw);
}

export function EntityForm({
  descriptors,
  defaults,
  action,
  submitLabel,
  cancelHref,
}: EntityFormProps) {
  const [state, formAction, pending] = useActionState<EntityFormState, FormData>(action, {
    status: 'idle',
  });
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const formError = state.status === 'error' ? state.message : null;

  return (
    <form action={formAction} data-testid="admin-form-root">
      {formError ? (
        <div
          role="alert"
          data-testid="admin-form-error"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            background: 'var(--colour-danger-subtle)',
            border: '1px solid var(--colour-danger)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--colour-text-primary)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {formError}
        </div>
      ) : null}

      {descriptors.map((d) => {
        const dv = defaultValueFor(d, defaults);
        const err = fieldErrors?.[d.name];
        switch (d.type) {
          case 'text':
            return (
              <TextField
                key={d.name}
                name={d.name}
                label={d.label}
                required={d.required}
                multiline={d.multiline}
                help={d.help}
                defaultValue={dv as string | undefined}
                error={err}
              />
            );
          case 'enum':
            return (
              <EnumField
                key={d.name}
                name={d.name}
                label={d.label}
                options={d.options}
                required={d.required}
                help={d.help}
                defaultValue={dv as string | undefined}
                error={err}
              />
            );
          case 'boolean':
            return (
              <BooleanField
                key={d.name}
                name={d.name}
                label={d.label}
                help={d.help}
                defaultValue={dv as boolean | undefined}
              />
            );
          case 'relation':
            return (
              <RelationField
                key={d.name}
                name={d.name}
                label={d.label}
                entity={d.entity}
                required={d.required}
                help={d.help}
                defaultValue={dv as string | undefined}
                error={err}
              />
            );
          case 'number':
            return (
              <NumberField
                key={d.name}
                name={d.name}
                label={d.label}
                required={d.required}
                help={d.help}
                defaultValue={dv as number | string | undefined}
                error={err}
              />
            );
          default: {
            // Exhaustiveness — TypeScript flags new descriptor types
            // until they're handled here.
            const _exhaustive: never = d;
            return _exhaustive;
          }
        }
      })}

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-6)',
          alignItems: 'center',
        }}
      >
        <button
          type="submit"
          disabled={pending}
          data-testid="admin-form-submit"
          style={{
            padding: 'var(--space-2) var(--space-5)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--colour-primary-contrast)',
            background: 'var(--colour-primary)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
        <a
          href={cancelHref}
          data-testid="admin-form-cancel"
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-link)',
            textDecoration: 'none',
          }}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
