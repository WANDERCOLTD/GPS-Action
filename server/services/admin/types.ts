/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Shared types for the generic admin CRUD engine. The form-field
 * descriptor is the contract between the registry (server) and the
 * EntityForm component (client). Stays small and serialisable —
 * no Zod schemas leak to the client bundle.
 */

import type { EntityKey } from '@/server/admin/entity-metadata';

export interface FormFieldDescriptorBase {
  readonly name: string;
  readonly label: string;
  /** Defaults to false. Booleans never set this — they're inherently optional. */
  readonly required?: boolean;
  readonly help?: string;
}

export type FormFieldDescriptor =
  | (FormFieldDescriptorBase & { readonly type: 'text'; readonly multiline?: boolean })
  | (FormFieldDescriptorBase & { readonly type: 'enum'; readonly options: ReadonlyArray<string> })
  | (FormFieldDescriptorBase & { readonly type: 'boolean' })
  | (FormFieldDescriptorBase & { readonly type: 'relation'; readonly entity: EntityKey })
  | (FormFieldDescriptorBase & { readonly type: 'number' });

/**
 * A flat row shape returned by the list / get procedures. Dotted-path
 * columns from `listColumns` are resolved at the service layer.
 */
export interface AdminRow {
  readonly id: string;
  readonly deletedAt?: Date | null;
  readonly [columnPath: string]: unknown;
}

export interface AdminListResult {
  readonly rows: ReadonlyArray<AdminRow>;
  readonly total: number;
}

export interface AdminListArgs {
  readonly search?: string;
  readonly take?: number;
}

export interface AdminGetArgs {
  readonly id: string;
}

export interface AdminMutationArgs {
  readonly data: Record<string, unknown>;
}

export interface AdminUpdateArgs extends AdminMutationArgs {
  readonly id: string;
}
