/**
 * Schema smoke test — proves the generated Prisma client exposes every Slice 1
 * model. Type-only references; no database I/O.
 *
 * @build-unit BU-001-prep
 * @spec architecture/admin-surface.md
 * @spec architecture/claim-and-lease.md
 */

import { describe, it, expect } from 'vitest';
import type { PrismaClient } from '@prisma/client';

import { entityMetadata } from '@/server/admin/entity-metadata';

describe('schema smoke — Slice 1 entities', () => {
  it('exposes every Slice 1 model on PrismaClient', () => {
    type ModelKey = keyof Pick<
      PrismaClient,
      | 'user'
      | 'region'
      | 'userRegion'
      | 'workItem'
      | 'roleGrant'
      | 'coordinatorProfile'
      | 'coordinatorGroup'
      | 'auditLog'
      | 'featureFlag'
    >;

    const expected: ReadonlyArray<ModelKey> = [
      'user',
      'region',
      'userRegion',
      'workItem',
      'roleGrant',
      'coordinatorProfile',
      'coordinatorGroup',
      'auditLog',
      'featureFlag',
    ];

    expect(expected).toHaveLength(9);
  });

  it('has a metadata entry for every Slice 1 entity', () => {
    const expectedKeys = [
      'user',
      'region',
      'userRegion',
      'workItem',
      'roleGrant',
      'coordinatorProfile',
      'coordinatorGroup',
      'auditLog',
      'featureFlag',
    ];

    for (const key of expectedKeys) {
      expect(entityMetadata).toHaveProperty(key);
    }

    expect(Object.keys(entityMetadata).sort()).toEqual([...expectedKeys].sort());
  });

  it('every metadata entry declares a display field or a display template', () => {
    for (const [name, entry] of Object.entries(entityMetadata)) {
      const hasDisplay = entry.displayField.length > 0 || (entry.displayTemplate ?? '').length > 0;
      expect(hasDisplay, `${name} must have displayField or displayTemplate`).toBe(true);
    }
  });
});
