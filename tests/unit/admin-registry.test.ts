/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Coverage and consistency guards for the admin registry.
 *
 * G2: every entity in ADMIN_ENTITY_KEYS has a registry entry, and
 *     every registry entry has a metadata entry.
 * G3: enum literal drift — every Zod enum in the registry's
 *     create/update form descriptors agrees with the Prisma enum
 *     of the same name.
 *
 * Together with B14 (schema↔metadata coverage, deferred), these tests
 * keep the contract chain from going stale.
 *
 * Also smoke-tests dotted-path include planning + row flattening.
 */

import { describe, it, expect } from 'vitest';
import { ADMIN_ENTITY_KEYS } from '@/shared/validation/admin';
import { adminEntityKeys, getRegistryEntry } from '@/server/services/admin/registry';
import { entityMetadata } from '@/server/admin/entity-metadata';
import {
  flattenRowForColumns,
  planIncludeFromColumns,
  planToPrismaInclude,
} from '@/server/services/admin/include';
import {
  GroupJoinPolicy,
  PostVisibility,
  RegionType,
  SystemRole,
  FeatureFlagPurpose,
} from '@prisma/client';
import type { FormFieldDescriptor } from '@/server/services/admin/types';

describe('admin registry — slice 1 coverage (G2)', () => {
  it('shared ADMIN_ENTITY_KEYS matches the registry', () => {
    expect(adminEntityKeys.sort()).toEqual([...ADMIN_ENTITY_KEYS].sort());
  });

  it('every registry entry has a metadata entry', () => {
    for (const key of adminEntityKeys) {
      expect(entityMetadata[key]).toBeDefined();
    }
  });

  it('roleGrant has create-only (no update / softDelete)', () => {
    const e = getRegistryEntry('roleGrant');
    expect(e.create).toBeDefined();
    expect(e.update).toBeUndefined();
    expect(e.softDelete).toBeUndefined();
  });

  it('auditLog is read-only (no mutation methods)', () => {
    const e = getRegistryEntry('auditLog');
    expect(e.create).toBeUndefined();
    expect(e.update).toBeUndefined();
    expect(e.softDelete).toBeUndefined();
    expect(e.restore).toBeUndefined();
    expect(e.hardDelete).toBeUndefined();
  });
});

// ── G3: enum literal drift ───────────────────────────────────────────────

function findEnumOptions(
  entity: (typeof adminEntityKeys)[number],
  fieldName: string,
): ReadonlyArray<string> | null {
  const entry = getRegistryEntry(entity);
  const all: ReadonlyArray<FormFieldDescriptor> = [
    ...(entry.formFields.create ?? []),
    ...(entry.formFields.update ?? []),
  ];
  for (const d of all) {
    if (d.name === fieldName && d.type === 'enum') return d.options;
  }
  return null;
}

describe('admin registry — Prisma enum drift (G3)', () => {
  it('post.visibility matches PostVisibility', () => {
    const opts = findEnumOptions('post', 'visibility');
    expect(opts).not.toBeNull();
    expect([...(opts ?? [])].sort()).toEqual(Object.values(PostVisibility).sort());
  });

  it('region.type matches RegionType', () => {
    const opts = findEnumOptions('region', 'type');
    expect(opts).not.toBeNull();
    expect([...(opts ?? [])].sort()).toEqual(Object.values(RegionType).sort());
  });

  it('group.joinPolicy matches GroupJoinPolicy', () => {
    const opts = findEnumOptions('group', 'joinPolicy');
    expect(opts).not.toBeNull();
    expect([...(opts ?? [])].sort()).toEqual(Object.values(GroupJoinPolicy).sort());
  });

  it('roleGrant.role matches SystemRole', () => {
    const opts = findEnumOptions('roleGrant', 'role');
    expect(opts).not.toBeNull();
    expect([...(opts ?? [])].sort()).toEqual(Object.values(SystemRole).sort());
  });

  it('featureFlag.purpose matches FeatureFlagPurpose', () => {
    const opts = findEnumOptions('featureFlag', 'purpose');
    expect(opts).not.toBeNull();
    expect([...(opts ?? [])].sort()).toEqual(Object.values(FeatureFlagPurpose).sort());
  });
});

// ── Dotted-path include / flatten ────────────────────────────────────────

describe('admin/include helpers', () => {
  it('planIncludeFromColumns extracts single-level relations', () => {
    const plan = planIncludeFromColumns(['title', 'author.displayName', 'createdAt']);
    expect(plan).toEqual({ author: new Set(['displayName']) });
  });

  it('planToPrismaInclude shapes select correctly', () => {
    const plan = planIncludeFromColumns(['author.displayName', 'author.email']);
    expect(planToPrismaInclude(plan)).toEqual({
      author: { select: { id: true, displayName: true, email: true } },
    });
  });

  it('throws on multi-level dotted paths', () => {
    expect(() => planIncludeFromColumns(['author.profile.bio'])).toThrow(/multi-level/);
  });

  it('flattenRowForColumns resolves dotted paths', () => {
    const row = {
      id: 'p1',
      title: 'Hi',
      author: { id: 'u1', displayName: 'Eddie' },
    };
    const flat = flattenRowForColumns(row, ['title', 'author.displayName']);
    expect(flat.title).toBe('Hi');
    expect(flat['author.displayName']).toBe('Eddie');
  });

  it('flattenRowForColumns returns null for missing relation', () => {
    const row = { id: 'p1', title: 'Hi', author: null };
    const flat = flattenRowForColumns(row, ['author.displayName']);
    expect(flat['author.displayName']).toBeNull();
  });
});
