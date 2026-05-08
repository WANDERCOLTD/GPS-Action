/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Wrapper Zod schemas for the generic admin tRPC procedures. The
 * per-entity create/update schemas live in
 * `server/services/admin/registry.ts` so the router stays oblivious
 * to entity-specific shapes — `data` is `record(unknown)` here and
 * the registry parses it on entry.
 *
 * Note: the entity-key list is duplicated here because shared/ may
 * not import from server/services/. The registry test
 * (`tests/unit/admin-registry.test.ts`) asserts these lists agree
 * — drift fails the build.
 */

import { z } from 'zod';

/**
 * Slice 1 entity keys (Q1 — option c). Mirrored against the
 * registry by `tests/unit/admin-registry.test.ts`.
 */
export const ADMIN_ENTITY_KEYS = [
  'user',
  'post',
  'region',
  'group',
  'groupMembership',
  'roleGrant',
  'featureFlag',
  'auditLog',
  'kanbanEventConfig',
] as const;

export type AdminEntityKeyShared = (typeof ADMIN_ENTITY_KEYS)[number];

/**
 * (entity, field) pairs that may be flipped via the entity-list
 * one-click toggle. Restricting to a small allowlist keeps the
 * blast radius narrow — admins can still edit any boolean from the
 * detail page, but only these are flippable from the list.
 *
 * Both the server action and the list-page renderer consult this,
 * so the gate is enforced regardless of caller.
 */
export const INLINE_TOGGLE_ALLOWLIST: Readonly<Record<string, ReadonlyArray<string>>> = {
  featureFlag: ['enabledGlobally'],
  kanbanEventConfig: ['enabled'],
};

export function isInlineToggleAllowed(entity: string, field: string): boolean {
  return INLINE_TOGGLE_ALLOWLIST[entity]?.includes(field) ?? false;
}

const entityEnum = z.enum(ADMIN_ENTITY_KEYS);

const dataRecord = z.record(z.string(), z.unknown());

export const adminListInput = z.object({
  entity: entityEnum,
  search: z.string().max(200).optional(),
  take: z.number().int().min(1).max(100).optional(),
});
export type AdminListInput = z.infer<typeof adminListInput>;

export const adminGetInput = z.object({
  entity: entityEnum,
  id: z.string().uuid(),
});
export type AdminGetInput = z.infer<typeof adminGetInput>;

export const adminCreateInput = z.object({
  entity: entityEnum,
  data: dataRecord,
});
export type AdminCreateInput = z.infer<typeof adminCreateInput>;

export const adminUpdateInput = z.object({
  entity: entityEnum,
  id: z.string().uuid(),
  data: dataRecord,
});
export type AdminUpdateInput = z.infer<typeof adminUpdateInput>;

export const adminDeleteInput = z.object({
  entity: entityEnum,
  id: z.string().uuid(),
  mode: z.enum(['soft', 'restore', 'hard']).default('soft'),
});
export type AdminDeleteInput = z.infer<typeof adminDeleteInput>;

// ── Bulk inputs (BU-admin-bulk-ops) ──────────────────────────────────────

const bulkIds = z.array(z.string().uuid()).min(1).max(100);

const bulkBaseInput = z.object({
  entity: entityEnum,
  ids: bulkIds,
});

export const adminBulkSoftDeleteInput = bulkBaseInput;
export type AdminBulkSoftDeleteInput = z.infer<typeof adminBulkSoftDeleteInput>;

export const adminBulkRestoreInput = bulkBaseInput;
export type AdminBulkRestoreInput = z.infer<typeof adminBulkRestoreInput>;

export const adminBulkHardDeleteInput = bulkBaseInput;
export type AdminBulkHardDeleteInput = z.infer<typeof adminBulkHardDeleteInput>;

/**
 * forceRelease is only valid for the `request` entity. Request lives
 * under workflow:queue and isn't in ADMIN_ENTITY_KEYS today (slice 1).
 * The procedure registers here for future use; the service stub
 * throws NOT_IMPLEMENTED until BU-admin-roles wires it through.
 */
export const adminBulkForceReleaseInput = z.object({
  entity: z.literal('request'),
  ids: bulkIds,
});
export type AdminBulkForceReleaseInput = z.infer<typeof adminBulkForceReleaseInput>;
