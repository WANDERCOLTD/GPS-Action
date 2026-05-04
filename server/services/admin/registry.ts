/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Per-entity handlers for the generic admin CRUD engine. Each entry
 * exposes typed list / get / create / update / softDelete / restore /
 * hardDelete functions that close over the right Prisma delegate —
 * keeping types sharp without `prisma[entityKey]` indexing.
 *
 * Contract decisions (per the brief, locked 2026-04-26):
 *   - Slice 1 entities only: user, post, region, group, roleGrant,
 *     featureFlag, auditLog. (Q1 → option c.)
 *   - Form generation: per-entity Zod create/update + a serialisable
 *     FormFieldDescriptor[] consumed by EntityForm. (Q2 → registry-Zod.)
 *   - "Immutable" expressed by absence: missing zodCreate / zodUpdate /
 *     allowDelete = procedure rejects with BAD_REQUEST. (Q6.)
 *   - RoleGrant: list/get/create only (revocation is a future BU-admin-roles
 *     flow; we don't expose generic edit here).
 *   - AuditLog: list/get only (immutable).
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import type { EntityKey } from '@/server/admin/entity-metadata';
import { entityMetadata } from '@/server/admin/entity-metadata';
import {
  flattenRowForColumns,
  planIncludeFromColumns,
  planToPrismaInclude,
} from '@/server/services/admin/include';
import type {
  AdminGetArgs,
  AdminListArgs,
  AdminListResult,
  AdminMutationArgs,
  AdminRow,
  AdminUpdateArgs,
  FormFieldDescriptor,
} from '@/server/services/admin/types';

// ── Registry shape ───────────────────────────────────────────────────────

export interface EntityRegistryEntry {
  /** Forms — descriptor for create + update (update may reuse create). */
  readonly formFields: {
    readonly create?: ReadonlyArray<FormFieldDescriptor>;
    readonly update?: ReadonlyArray<FormFieldDescriptor>;
  };
  /** Read operations — always present. */
  list(args: AdminListArgs): Promise<AdminListResult>;
  get(args: AdminGetArgs): Promise<AdminRow | null>;
  /** Mutations — absence means the procedure must reject. */
  create?(args: AdminMutationArgs & { actorId: string }): Promise<{ id: string }>;
  update?(args: AdminUpdateArgs & { actorId: string }): Promise<{ id: string }>;
  softDelete?(args: { id: string; actorId: string }): Promise<{ id: string }>;
  restore?(args: { id: string; actorId: string }): Promise<{ id: string }>;
  hardDelete?(args: { id: string; actorId: string }): Promise<{ id: string }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function buildSearchFilter(
  fields: ReadonlyArray<string>,
  search: string | undefined,
): Record<string, unknown> | undefined {
  if (!search || !fields.length) return undefined;
  const term = search.trim();
  if (!term) return undefined;
  const clauses: Array<Record<string, unknown>> = [];
  for (const field of fields) {
    if (field.includes('.')) {
      const parts = field.split('.');
      const relation = parts[0];
      const scalar = parts[1];
      if (!relation || !scalar) continue;
      clauses.push({
        [relation]: { [scalar]: { contains: term, mode: 'insensitive' as const } },
      });
    } else {
      clauses.push({ [field]: { contains: term, mode: 'insensitive' as const } });
    }
  }
  return { OR: clauses };
}

/**
 * Typed metadata accessor. Throws "unreachable" if a slice 1 key is
 * missing — TypeScript would catch this at the call site if not for
 * the metadata's `Record<string, ...>` declaration.
 */
function meta(key: EntityKey): (typeof entityMetadata)[string] & object {
  const m = entityMetadata[key];
  if (!m) {
    throw new Error(`unreachable: entity-metadata missing key "${key}"`);
  }
  return m;
}

function buildOrderBy<T = Prisma.PostOrderByWithRelationInput>(
  defaultSort: unknown,
): T | T[] | undefined {
  if (!defaultSort) return undefined;
  // Pass-through. The metadata's defaultSort is a Prisma-shaped orderBy
  // for the entity that called buildOrderBy. The generic lets each entry
  // bind its own entity's orderBy shape (Group, Request, Post, …).
  return defaultSort as T;
}

function notImplemented(entity: EntityKey, op: string): never {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: `Operation ${op} not supported for entity ${entity}`,
  });
}

// ── Zod helpers ──────────────────────────────────────────────────────────

const optionalString = z.string().trim().min(1).optional().nullable();

// ── Per-entity entries ───────────────────────────────────────────────────

// User -------------------------------------------------------------------

const userCreateSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  phoneNumber: optionalString,
});
const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(200).optional(),
  phoneNumber: optionalString,
});

const userEntry: EntityRegistryEntry = {
  formFields: {
    create: [
      { type: 'text', name: 'email', label: 'Email', required: true },
      { type: 'text', name: 'displayName', label: 'Display name', required: true },
      { type: 'text', name: 'phoneNumber', label: 'Phone number', required: false },
    ],
    update: [
      { type: 'text', name: 'email', label: 'Email', required: false },
      { type: 'text', name: 'displayName', label: 'Display name', required: false },
      { type: 'text', name: 'phoneNumber', label: 'Phone number', required: false },
    ],
  },
  async list({ search, take }) {
    const m = meta('user');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...buildSearchFilter(m.searchableFields ?? [], search),
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: buildOrderBy(m.defaultSort),
        take: take ?? 50,
        ...(Object.keys(include).length ? { include } : {}),
      }),
      prisma.user.count({ where }),
    ]);
    return {
      rows: rows.map((r) => flattenRowForColumns(r as Record<string, unknown>, m.listColumns)),
      total,
    };
  },
  async get({ id }) {
    const m = meta('user');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const row = await prisma.user.findUnique({
      where: { id },
      ...(Object.keys(include).length ? { include } : {}),
    });
    if (!row) return null;
    return flattenRowForColumns(row as Record<string, unknown>, m.listColumns);
  },
  async create({ data }) {
    const parsed = userCreateSchema.parse(data);
    const created = await prisma.user.create({
      data: {
        email: parsed.email,
        displayName: parsed.displayName,
        phoneNumber: parsed.phoneNumber ?? null,
      },
      select: { id: true },
    });
    return created;
  },
  async update({ id, data }) {
    const parsed = userUpdateSchema.parse(data);
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.email !== undefined ? { email: parsed.email } : {}),
        ...(parsed.displayName !== undefined ? { displayName: parsed.displayName } : {}),
        ...(parsed.phoneNumber !== undefined ? { phoneNumber: parsed.phoneNumber ?? null } : {}),
      },
      select: { id: true },
    });
    return updated;
  },
  async softDelete({ id }) {
    const updated = await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
    return updated;
  },
  async restore({ id }) {
    const updated = await prisma.user.update({
      where: { id },
      data: { deletedAt: null },
      select: { id: true },
    });
    return updated;
  },
};

// Post -------------------------------------------------------------------

const postCreateSchema = z.object({
  authorId: z.string().uuid(),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(10000),
  visibility: z.enum(['public', 'authenticated_only']).default('public'),
});
const postUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  body: z.string().min(1).max(10000).optional(),
  visibility: z.enum(['public', 'authenticated_only']).optional(),
});

const postEntry: EntityRegistryEntry = {
  formFields: {
    create: [
      { type: 'relation', name: 'authorId', label: 'Author', required: true, entity: 'user' },
      { type: 'text', name: 'title', label: 'Title', required: true },
      { type: 'text', name: 'body', label: 'Body', required: true, multiline: true },
      {
        type: 'enum',
        name: 'visibility',
        label: 'Visibility',
        required: true,
        options: ['public', 'authenticated_only'],
      },
    ],
    update: [
      { type: 'text', name: 'title', label: 'Title', required: false },
      { type: 'text', name: 'body', label: 'Body', required: false, multiline: true },
      {
        type: 'enum',
        name: 'visibility',
        label: 'Visibility',
        required: false,
        options: ['public', 'authenticated_only'],
      },
    ],
  },
  async list({ search, take }) {
    const m = meta('post');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      ...buildSearchFilter(m.searchableFields ?? [], search),
    };
    const [rows, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: buildOrderBy(m.defaultSort),
        take: take ?? 50,
        ...(Object.keys(include).length ? { include } : {}),
      }),
      prisma.post.count({ where }),
    ]);
    return {
      rows: rows.map((r) => flattenRowForColumns(r as Record<string, unknown>, m.listColumns)),
      total,
    };
  },
  async get({ id }) {
    const m = meta('post');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const row = await prisma.post.findUnique({
      where: { id },
      ...(Object.keys(include).length ? { include } : {}),
    });
    if (!row) return null;
    return flattenRowForColumns(row as Record<string, unknown>, m.listColumns);
  },
  async create({ data }) {
    const parsed = postCreateSchema.parse(data);
    const created = await prisma.post.create({
      data: {
        authorId: parsed.authorId,
        title: parsed.title,
        body: parsed.body,
        visibility: parsed.visibility,
      },
      select: { id: true },
    });
    return created;
  },
  async update({ id, data }) {
    const parsed = postUpdateSchema.parse(data);
    const updated = await prisma.post.update({
      where: { id },
      data: parsed,
      select: { id: true },
    });
    return updated;
  },
  async softDelete({ id }) {
    const updated = await prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
    return updated;
  },
  async restore({ id }) {
    const updated = await prisma.post.update({
      where: { id },
      data: { deletedAt: null },
      select: { id: true },
    });
    return updated;
  },
};

// Region -----------------------------------------------------------------

const regionCreateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits, hyphens only'),
  displayName: z.string().min(1).max(200),
  type: z.enum(['national', 'region', 'council']),
  parentId: z.string().uuid().optional().nullable(),
});
const regionUpdateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  type: z.enum(['national', 'region', 'council']).optional(),
  parentId: z.string().uuid().optional().nullable(),
});

const regionEntry: EntityRegistryEntry = {
  formFields: {
    create: [
      { type: 'text', name: 'slug', label: 'Slug', required: true },
      { type: 'text', name: 'displayName', label: 'Display name', required: true },
      {
        type: 'enum',
        name: 'type',
        label: 'Type',
        required: true,
        options: ['national', 'region', 'council'],
      },
      { type: 'relation', name: 'parentId', label: 'Parent', required: false, entity: 'region' },
    ],
    update: [
      { type: 'text', name: 'displayName', label: 'Display name', required: false },
      {
        type: 'enum',
        name: 'type',
        label: 'Type',
        required: false,
        options: ['national', 'region', 'council'],
      },
      { type: 'relation', name: 'parentId', label: 'Parent', required: false, entity: 'region' },
    ],
  },
  async list({ search, take }) {
    const m = meta('region');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const where: Prisma.RegionWhereInput = {
      deletedAt: null,
      ...buildSearchFilter(m.searchableFields ?? [], search),
    };
    const [rows, total] = await Promise.all([
      prisma.region.findMany({
        where,
        orderBy: buildOrderBy(m.defaultSort),
        take: take ?? 50,
        ...(Object.keys(include).length ? { include } : {}),
      }),
      prisma.region.count({ where }),
    ]);
    return {
      rows: rows.map((r) => flattenRowForColumns(r as Record<string, unknown>, m.listColumns)),
      total,
    };
  },
  async get({ id }) {
    const m = meta('region');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const row = await prisma.region.findUnique({
      where: { id },
      ...(Object.keys(include).length ? { include } : {}),
    });
    if (!row) return null;
    return flattenRowForColumns(row as Record<string, unknown>, m.listColumns);
  },
  async create({ data }) {
    const parsed = regionCreateSchema.parse(data);
    return prisma.region.create({
      data: {
        slug: parsed.slug,
        displayName: parsed.displayName,
        type: parsed.type,
        parentId: parsed.parentId ?? null,
      },
      select: { id: true },
    });
  },
  async update({ id, data }) {
    const parsed = regionUpdateSchema.parse(data);
    return prisma.region.update({
      where: { id },
      data: {
        ...(parsed.displayName !== undefined ? { displayName: parsed.displayName } : {}),
        ...(parsed.type !== undefined ? { type: parsed.type } : {}),
        ...(parsed.parentId !== undefined ? { parentId: parsed.parentId ?? null } : {}),
      },
      select: { id: true },
    });
  },
  async softDelete({ id }) {
    return prisma.region.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
  },
  async restore({ id }) {
    return prisma.region.update({
      where: { id },
      data: { deletedAt: null },
      select: { id: true },
    });
  },
};

// Group ------------------------------------------------------------------

const groupCreateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits, hyphens only'),
  displayName: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  joinPolicy: z.enum(['open', 'request_to_join', 'admin_only']).default('open'),
  isOfficial: z.boolean().default(false),
});
const groupUpdateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  joinPolicy: z.enum(['open', 'request_to_join', 'admin_only']).optional(),
  isOfficial: z.boolean().optional(),
});

const groupEntry: EntityRegistryEntry = {
  formFields: {
    create: [
      { type: 'text', name: 'slug', label: 'Slug', required: true },
      { type: 'text', name: 'displayName', label: 'Display name', required: true },
      { type: 'text', name: 'description', label: 'Description', required: false, multiline: true },
      {
        type: 'enum',
        name: 'joinPolicy',
        label: 'Join policy',
        required: true,
        options: ['open', 'request_to_join', 'admin_only'],
      },
      { type: 'boolean', name: 'isOfficial', label: 'Official group' },
    ],
    update: [
      { type: 'text', name: 'displayName', label: 'Display name', required: false },
      { type: 'text', name: 'description', label: 'Description', required: false, multiline: true },
      {
        type: 'enum',
        name: 'joinPolicy',
        label: 'Join policy',
        required: false,
        options: ['open', 'request_to_join', 'admin_only'],
      },
      { type: 'boolean', name: 'isOfficial', label: 'Official group' },
    ],
  },
  async list({ search, take }) {
    const m = meta('group');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const where: Prisma.GroupWhereInput = {
      deletedAt: null,
      ...buildSearchFilter(m.searchableFields ?? [], search),
    };
    const [rows, total] = await Promise.all([
      prisma.group.findMany({
        where,
        orderBy: buildOrderBy<Prisma.GroupOrderByWithRelationInput>(m.defaultSort),
        take: take ?? 50,
        ...(Object.keys(include).length ? { include } : {}),
      }),
      prisma.group.count({ where }),
    ]);
    return {
      rows: rows.map((r) => flattenRowForColumns(r as Record<string, unknown>, m.listColumns)),
      total,
    };
  },
  async get({ id }) {
    const m = meta('group');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const row = await prisma.group.findUnique({
      where: { id },
      ...(Object.keys(include).length ? { include } : {}),
    });
    if (!row) return null;
    return flattenRowForColumns(row as Record<string, unknown>, m.listColumns);
  },
  async create({ data, actorId }) {
    const parsed = groupCreateSchema.parse(data);
    return prisma.group.create({
      data: {
        slug: parsed.slug,
        displayName: parsed.displayName,
        description: parsed.description ?? null,
        joinPolicy: parsed.joinPolicy,
        isOfficial: parsed.isOfficial,
        createdByUserId: actorId,
      },
      select: { id: true },
    });
  },
  async update({ id, data }) {
    const parsed = groupUpdateSchema.parse(data);
    return prisma.group.update({
      where: { id },
      data: {
        ...(parsed.displayName !== undefined ? { displayName: parsed.displayName } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description ?? null } : {}),
        ...(parsed.joinPolicy !== undefined ? { joinPolicy: parsed.joinPolicy } : {}),
        ...(parsed.isOfficial !== undefined ? { isOfficial: parsed.isOfficial } : {}),
      },
      select: { id: true },
    });
  },
  async softDelete({ id }) {
    return prisma.group.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
  },
  async restore({ id }) {
    return prisma.group.update({
      where: { id },
      data: { deletedAt: null },
      select: { id: true },
    });
  },
};

// RoleGrant --------------------------------------------------------------
//
// Create only (granting). Revocation is its own flow that lands with a
// future BU-admin-roles. Generic update/delete intentionally absent.

const roleGrantCreateSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['queue_manager', 'admin']),
  scope: z.string().max(80).optional().nullable(),
  grantedReason: z.string().min(1).max(500),
});

const roleGrantEntry: EntityRegistryEntry = {
  formFields: {
    create: [
      { type: 'relation', name: 'userId', label: 'User', required: true, entity: 'user' },
      {
        type: 'enum',
        name: 'role',
        label: 'Role',
        required: true,
        options: ['queue_manager', 'admin'],
      },
      {
        type: 'text',
        name: 'scope',
        label: 'Scope (optional, e.g. queue_manager:vetting)',
        required: false,
      },
      {
        type: 'text',
        name: 'grantedReason',
        label: 'Reason',
        required: true,
        multiline: true,
        help: 'Required — why is this grant being made?',
      },
    ],
  },
  async list({ search, take }) {
    const m = meta('roleGrant');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const where: Prisma.RoleGrantWhereInput = {
      ...buildSearchFilter(m.searchableFields ?? [], search),
    };
    const [rows, total] = await Promise.all([
      prisma.roleGrant.findMany({
        where,
        orderBy: buildOrderBy(m.defaultSort),
        take: take ?? 50,
        ...(Object.keys(include).length ? { include } : {}),
      }),
      prisma.roleGrant.count({ where }),
    ]);
    return {
      rows: rows.map((r) => flattenRowForColumns(r as Record<string, unknown>, m.listColumns)),
      total,
    };
  },
  async get({ id }) {
    const m = meta('roleGrant');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const row = await prisma.roleGrant.findUnique({
      where: { id },
      ...(Object.keys(include).length ? { include } : {}),
    });
    if (!row) return null;
    return flattenRowForColumns(row as Record<string, unknown>, m.listColumns);
  },
  async create({ data, actorId }) {
    const parsed = roleGrantCreateSchema.parse(data);
    return prisma.roleGrant.create({
      data: {
        userId: parsed.userId,
        role: parsed.role,
        scope: parsed.scope ?? null,
        grantedReason: parsed.grantedReason,
        grantedByUserId: actorId,
      },
      select: { id: true },
    });
  },
};

// FeatureFlag ------------------------------------------------------------

const featureFlagCreateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/, 'snake_case starting with a letter'),
  description: z.string().min(1).max(500),
  purpose: z.enum(['rollout', 'kill_switch', 'pilot_gate']),
  enabledGlobally: z.boolean().default(false),
  rolloutPercentage: z.number().int().min(0).max(100).default(0),
});
const featureFlagUpdateSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  enabledGlobally: z.boolean().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
});

const featureFlagEntry: EntityRegistryEntry = {
  formFields: {
    create: [
      { type: 'text', name: 'name', label: 'Name', required: true },
      { type: 'text', name: 'description', label: 'Description', required: true, multiline: true },
      {
        type: 'enum',
        name: 'purpose',
        label: 'Purpose',
        required: true,
        options: ['rollout', 'kill_switch', 'pilot_gate'],
      },
      { type: 'boolean', name: 'enabledGlobally', label: 'Enabled globally' },
      {
        type: 'number',
        name: 'rolloutPercentage',
        label: 'Rollout percentage (0–100)',
        required: false,
      },
    ],
    update: [
      { type: 'text', name: 'description', label: 'Description', required: false, multiline: true },
      { type: 'boolean', name: 'enabledGlobally', label: 'Enabled globally' },
      {
        type: 'number',
        name: 'rolloutPercentage',
        label: 'Rollout percentage (0–100)',
        required: false,
      },
    ],
  },
  async list({ search, take }) {
    const m = meta('featureFlag');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const where: Prisma.FeatureFlagWhereInput = {
      deletedAt: null,
      ...buildSearchFilter(m.searchableFields ?? [], search),
    };
    const [rows, total] = await Promise.all([
      prisma.featureFlag.findMany({
        where,
        orderBy: buildOrderBy(m.defaultSort),
        take: take ?? 50,
        ...(Object.keys(include).length ? { include } : {}),
      }),
      prisma.featureFlag.count({ where }),
    ]);
    return {
      rows: rows.map((r) => flattenRowForColumns(r as Record<string, unknown>, m.listColumns)),
      total,
    };
  },
  async get({ id }) {
    const m = meta('featureFlag');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const row = await prisma.featureFlag.findUnique({
      where: { id },
      ...(Object.keys(include).length ? { include } : {}),
    });
    if (!row) return null;
    return flattenRowForColumns(row as Record<string, unknown>, m.listColumns);
  },
  async create({ data, actorId }) {
    const parsed = featureFlagCreateSchema.parse(data);
    return prisma.featureFlag.create({
      data: {
        name: parsed.name,
        description: parsed.description,
        purpose: parsed.purpose,
        enabledGlobally: parsed.enabledGlobally,
        rolloutPercentage: parsed.rolloutPercentage,
        createdByUserId: actorId,
        updatedByUserId: actorId,
      },
      select: { id: true },
    });
  },
  async update({ id, data, actorId }) {
    const parsed = featureFlagUpdateSchema.parse(data);
    return prisma.featureFlag.update({
      where: { id },
      data: {
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.enabledGlobally !== undefined
          ? { enabledGlobally: parsed.enabledGlobally }
          : {}),
        ...(parsed.rolloutPercentage !== undefined
          ? { rolloutPercentage: parsed.rolloutPercentage }
          : {}),
        updatedByUserId: actorId,
      },
      select: { id: true },
    });
  },
  async softDelete({ id }) {
    return prisma.featureFlag.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
  },
  async restore({ id }) {
    return prisma.featureFlag.update({
      where: { id },
      data: { deletedAt: null },
      select: { id: true },
    });
  },
};

// AuditLog ---------------------------------------------------------------
//
// Read-only. No create / update / delete. The metadata `notes` field
// declares "Immutable — routers must not expose update or delete
// procedures." Per Q6, that's encoded by absence of the mutation
// methods on this registry entry.

const auditLogEntry: EntityRegistryEntry = {
  formFields: {},
  async list({ search, take }) {
    const m = meta('auditLog');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const where: Prisma.AuditLogWhereInput = {
      ...buildSearchFilter(m.searchableFields ?? [], search),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: buildOrderBy(m.defaultSort),
        take: take ?? 50,
        ...(Object.keys(include).length ? { include } : {}),
      }),
      prisma.auditLog.count({ where }),
    ]);
    return {
      rows: rows.map((r) => flattenRowForColumns(r as Record<string, unknown>, m.listColumns)),
      total,
    };
  },
  async get({ id }) {
    const m = meta('auditLog');
    const includePlan = planIncludeFromColumns(m.listColumns);
    const include = planToPrismaInclude(includePlan);
    const row = await prisma.auditLog.findUnique({
      where: { id },
      ...(Object.keys(include).length ? { include } : {}),
    });
    if (!row) return null;
    return flattenRowForColumns(row as Record<string, unknown>, m.listColumns);
  },
};

// ── Registry ─────────────────────────────────────────────────────────────

const registry: Partial<Record<EntityKey, EntityRegistryEntry>> = {
  user: userEntry,
  post: postEntry,
  region: regionEntry,
  group: groupEntry,
  roleGrant: roleGrantEntry,
  featureFlag: featureFlagEntry,
  auditLog: auditLogEntry,
};

export type AdminEntityKey = keyof typeof registry & EntityKey;

/** Entities with a registry entry — slice 1 ships these only. */
export const adminEntityKeys = Object.keys(registry).filter(
  (k): k is AdminEntityKey => registry[k as AdminEntityKey] !== undefined,
);

export function getRegistryEntry(entity: EntityKey): EntityRegistryEntry {
  const entry = registry[entity as AdminEntityKey];
  if (!entry) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Entity "${entity}" is not registered for the admin CRUD engine`,
    });
  }
  return entry;
}

type MutationOp = 'create' | 'update' | 'softDelete' | 'restore' | 'hardDelete';

export function ensureSupports<O extends MutationOp>(
  entity: EntityKey,
  op: O,
): EntityRegistryEntry & Required<Pick<EntityRegistryEntry, O>> {
  const entry = getRegistryEntry(entity);
  if (!entry[op]) {
    notImplemented(entity, op);
  }
  return entry as EntityRegistryEntry & Required<Pick<EntityRegistryEntry, O>>;
}
