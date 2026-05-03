/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Server actions for the generic admin CRUD pages. Each action
 * takes the entity key as the first argument (bound at the page
 * boundary so the form callback signature still matches React's
 * `useActionState` shape).
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import { TRPCError } from '@trpc/server';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import {
  ADMIN_ENTITY_KEYS,
  isInlineToggleAllowed,
  type AdminEntityKeyShared,
} from '@/shared/validation/admin';
import type { EntityFormState } from '@/components/admin/EntityForm';

function isValidEntityKey(value: string): value is AdminEntityKeyShared {
  return (ADMIN_ENTITY_KEYS as readonly string[]).includes(value);
}

function coerceFormData(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed === '') {
      // Treat empty strings as omitted so optional fields stay optional.
      continue;
    }
    out[key] = trimmed;
  }
  // Booleans: checkboxes only post when checked. The form-field
  // descriptor list lives server-side, so we can't know which fields
  // were intended as booleans here. The registry's Zod schema handles
  // the absent-checkbox = false case via `default(false)`.
  // Numbers + booleans get string-coerced; the per-entity Zod schema
  // narrows them via `.coerce.number()` / `.coerce.boolean()` where
  // appropriate. Slice 1 schemas accept strings for these by relying
  // on Zod's default behaviour where the registry author added it; the
  // remainder pass through as strings.
  return out;
}

function coerceTypedValues(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value !== 'string') continue;
    if (value === 'true') out[key] = true;
    else if (value === 'false') out[key] = false;
    else if (/^-?\d+(\.\d+)?$/.test(value) && key.toLowerCase().includes('percentage')) {
      out[key] = Number(value);
    }
  }
  return out;
}

function fieldErrorsFromZod(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.');
    if (path && !out[path]) out[path] = issue.message;
  }
  return out;
}

async function withCaller<T>(
  fn: (caller: ReturnType<typeof createCaller>) => Promise<T>,
): Promise<T> {
  const ctx = await createTRPCContext();
  return fn(createCaller(ctx));
}

export async function adminCreateAction(
  entity: string,
  _state: EntityFormState,
  formData: FormData,
): Promise<EntityFormState> {
  if (!isValidEntityKey(entity)) {
    return { status: 'error', message: `Unknown entity "${entity}"` };
  }
  let result: { id: string };
  try {
    result = await withCaller((caller) =>
      caller.admin.create({
        entity,
        data: coerceTypedValues(coerceFormData(formData)),
      }),
    );
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return {
        status: 'error',
        message: 'Some fields are invalid.',
        fieldErrors: fieldErrorsFromZod(err),
      };
    }
    if (err instanceof TRPCError) {
      return { status: 'error', message: err.message || 'Could not save — try again.' };
    }
    return { status: 'error', message: 'Could not save — try again.' };
  }
  redirect(`/data/${entity}/${result.id}`);
}

export async function adminUpdateAction(
  entity: string,
  id: string,
  _state: EntityFormState,
  formData: FormData,
): Promise<EntityFormState> {
  if (!isValidEntityKey(entity)) {
    return { status: 'error', message: `Unknown entity "${entity}"` };
  }
  try {
    await withCaller((caller) =>
      caller.admin.update({
        entity,
        id,
        data: coerceTypedValues(coerceFormData(formData)),
      }),
    );
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return {
        status: 'error',
        message: 'Some fields are invalid.',
        fieldErrors: fieldErrorsFromZod(err),
      };
    }
    if (err instanceof TRPCError) {
      return { status: 'error', message: err.message || 'Could not save — try again.' };
    }
    return { status: 'error', message: 'Could not save — try again.' };
  }
  redirect(`/data/${entity}/${id}`);
}

/**
 * Inline boolean toggle from the entity list page. Goes through the
 * same `caller.admin.update` path as the detail edit form, so the
 * audit log fires automatically (every flip writes one AuditLog row
 * via the crud facade). The (entity, field) pair must be on the
 * INLINE_TOGGLE_ALLOWLIST or the action 400s.
 */
export async function adminToggleBooleanAction(
  entity: string,
  id: string,
  field: string,
  nextValue: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isValidEntityKey(entity)) {
    return { ok: false, message: `Unknown entity "${entity}"` };
  }
  if (!isInlineToggleAllowed(entity, field)) {
    return {
      ok: false,
      message: `Field "${field}" on "${entity}" is not inline-toggleable`,
    };
  }
  try {
    await withCaller((caller) =>
      caller.admin.update({ entity, id, data: { [field]: nextValue } }),
    );
  } catch (err: unknown) {
    if (err instanceof TRPCError) {
      return { ok: false, message: err.message };
    }
    return { ok: false, message: 'Could not update — try again.' };
  }
  revalidatePath(`/data/${entity}`);
  return { ok: true };
}

export async function adminDeleteAction(
  entity: string,
  id: string,
  mode: 'soft' | 'restore' | 'hard',
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isValidEntityKey(entity)) {
    return { ok: false, message: `Unknown entity "${entity}"` };
  }
  try {
    await withCaller((caller) => caller.admin.delete({ entity, id, mode }));
  } catch (err: unknown) {
    if (err instanceof TRPCError) {
      return { ok: false, message: err.message };
    }
    return { ok: false, message: 'Could not delete — try again.' };
  }
  return { ok: true };
}
