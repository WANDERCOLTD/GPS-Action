/**
 * Schema smoke test — proves the generated Prisma client exposes every
 * Slice 1 + Slice 1.5 model. Type-only references; no database I/O.
 *
 * @build-unit BU-001-prep
 * @spec architecture/admin-surface.md
 * @spec architecture/claim-and-lease.md
 * @spec product/groups.md
 * @spec product/post-creation-flow.md
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
      | 'request'
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
      'request',
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
      'request',
      'roleGrant',
      'coordinatorProfile',
      'coordinatorGroup',
      'auditLog',
      'featureFlag',
    ];

    for (const key of expectedKeys) {
      expect(entityMetadata).toHaveProperty(key);
    }
  });

  it('every metadata entry declares a display field or a display template', () => {
    for (const [name, entry] of Object.entries(entityMetadata)) {
      const hasDisplay = entry.displayField.length > 0 || (entry.displayTemplate ?? '').length > 0;
      expect(hasDisplay, `${name} must have displayField or displayTemplate`).toBe(true);
    }
  });
});

describe('schema smoke — Slice 1.5 entities (Groups)', () => {
  it('exposes Group and GroupMembership on PrismaClient', () => {
    type ModelKey = keyof Pick<PrismaClient, 'group' | 'groupMembership'>;

    const expected: ReadonlyArray<ModelKey> = ['group', 'groupMembership'];

    expect(expected).toHaveLength(2);
  });

  it('has metadata entries for Group and GroupMembership', () => {
    expect(entityMetadata).toHaveProperty('group');
    expect(entityMetadata).toHaveProperty('groupMembership');
  });

  it('metadata includes Slice 1.5 entities', () => {
    const slice15Keys = ['group', 'groupMembership'];
    for (const key of slice15Keys) {
      expect(entityMetadata).toHaveProperty(key);
    }
  });
});

describe('schema smoke — Slice 2 (minimal) entities (Post)', () => {
  it('exposes Post on PrismaClient', () => {
    type ModelKey = keyof Pick<PrismaClient, 'post'>;

    const expected: ReadonlyArray<ModelKey> = ['post'];

    expect(expected).toHaveLength(1);
  });

  it('has a metadata entry for Post', () => {
    expect(entityMetadata).toHaveProperty('post');
  });

  it('metadata covers all Slice 1 + 1.5 + 2m + kanban-event-config entities', () => {
    const expectedKeys = [
      'auditLog',
      'coordinatorGroup',
      'coordinatorProfile',
      'featureFlag',
      'group',
      'groupMembership',
      'kanbanEventConfig',
      'post',
      'region',
      'request',
      'roleGrant',
      'user',
      'userRegion',
    ];

    expect(Object.keys(entityMetadata).sort()).toEqual(expectedKeys);
  });
});
