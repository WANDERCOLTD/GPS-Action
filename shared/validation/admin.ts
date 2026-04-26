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
  'roleGrant',
  'featureFlag',
  'auditLog',
] as const;

export type AdminEntityKeyShared = (typeof ADMIN_ENTITY_KEYS)[number];

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
