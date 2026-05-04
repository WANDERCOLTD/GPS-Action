/**
 * @build-unit bu-coordination-board (build seq #1 of 8)
 * @spec build/session-briefs/bu-coordination-board.md
 * @adr 0005 0006 0007 0008 0009
 *
 * Sanity tests for the coord-board schema slice. Asserts the contract
 * shape via Prisma DMMF (for entity / field / enum existence and types)
 * plus a string match on the migration SQL (for uniqueness, defaults,
 * and cascade rules). No live DB required. Behaviour tests for the
 * services that consume these primitives ride PR #2.
 *
 * The point: catch any drift between the brief's "Schema additions"
 * section and the schema in code. If a future PR removes one of the
 * new entities or enum values, or weakens a unique constraint, this
 * fails.
 *
 * NOTE: Prisma 7 DMMF strips `default`, `isRequired`, `uniqueFields`
 * etc. The migration SQL is the authoritative source for those — hence
 * the dual-source approach.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  Prisma,
  GroupKind,
  CommentKind,
  CommentSource,
  NotificationLifecycle,
  NotificationReasonKind,
  SubscriptionSource,
  RequestGroupOrigin,
  GroupMembershipRole,
} from '@prisma/client';

const datamodel = Prisma.dmmf.datamodel;

const MIGRATION_SQL = readFileSync(
  join(process.cwd(), 'prisma/migrations/20260504100000_coord_board_schema_v1/migration.sql'),
  'utf8',
);

const MIGRATION_SQL_2G1 = readFileSync(
  join(process.cwd(), 'prisma/migrations/20260504120000_request_type_nullable/migration.sql'),
  'utf8',
);

const RENAME_SQL = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20260504100100_rename_group_membership_role_lead_to_admin/migration.sql',
  ),
  'utf8',
);

function findModel(name: string) {
  const m = datamodel.models.find((model) => model.name === name);
  expect(m, `expected model ${name} in schema`).toBeDefined();
  return m!;
}

function fieldOf(modelName: string, fieldName: string) {
  const model = findModel(modelName);
  const field = model.fields.find((f) => f.name === fieldName);
  expect(field, `expected field ${modelName}.${fieldName}`).toBeDefined();
  return field!;
}

describe('coord-board schema — enums (ADRs 0005-0009)', () => {
  it('GroupKind has 5 values per brief', () => {
    expect(Object.keys(GroupKind).sort()).toEqual([
      'network',
      'region',
      'team',
      'topic',
      'workstream',
    ]);
  });

  it('CommentKind covers comment vs note (ADR-0007)', () => {
    expect(Object.keys(CommentKind).sort()).toEqual(['comment', 'note']);
  });

  it('CommentSource discriminates human vs system (ADR-0007)', () => {
    expect(Object.keys(CommentSource).sort()).toEqual(['human', 'system']);
  });

  it('NotificationLifecycle is the 3-state machine (ADR-0008)', () => {
    expect(Object.keys(NotificationLifecycle).sort()).toEqual(['acknowledged', 'dismissed', 'new']);
  });

  it('NotificationReasonKind covers the 6 trigger shapes (ADR-0008)', () => {
    expect(Object.keys(NotificationReasonKind).sort()).toEqual([
      'assignment',
      'comment',
      'mention',
      'status_change',
      'team_blast',
      'urgent_flip',
    ]);
  });

  it('SubscriptionSource covers the 5 subscription origins', () => {
    expect(Object.keys(SubscriptionSource).sort()).toEqual([
      'auto_assignee',
      'auto_author',
      'auto_mention',
      'explicit',
      'team_blast_optin',
    ]);
  });

  it('RequestGroupOrigin covers originating + 2 share routes (ADR-0009)', () => {
    expect(Object.keys(RequestGroupOrigin).sort()).toEqual([
      'ad_hoc_share',
      'originating',
      'workflow_share',
    ]);
  });

  it('GroupMembershipRole renamed lead → admin (Tier-2 #8)', () => {
    const values = Object.keys(GroupMembershipRole).sort();
    expect(values, 'admin should be present').toContain('admin');
    expect(values, 'lead should be removed').not.toContain('lead');
  });

  it('rename migration uses ALTER TYPE to preserve rows', () => {
    expect(RENAME_SQL).toMatch(/ALTER TYPE "GroupMembershipRole" RENAME VALUE 'lead' TO 'admin'/);
  });
});

describe('coord-board schema — entities exist with right field types', () => {
  it('Assignment has requestId + userId scalars (multi-assignee join)', () => {
    findModel('Assignment');
    expect(fieldOf('Assignment', 'requestId').type).toBe('String');
    expect(fieldOf('Assignment', 'userId').type).toBe('String');
    expect(fieldOf('Assignment', 'assignedAt').type).toBe('DateTime');
    expect(fieldOf('Assignment', 'unassignedAt').type).toBe('DateTime');
  });

  it('RequestGroup carries per-link state (ADR-0009)', () => {
    findModel('RequestGroup');
    expect(fieldOf('RequestGroup', 'columnId').type).toBe('String');
    expect(fieldOf('RequestGroup', 'boardPosition').type).toBe('Decimal');
    expect(fieldOf('RequestGroup', 'isUrgent').type).toBe('Boolean');
    expect(fieldOf('RequestGroup', 'origin').type).toBe('RequestGroupOrigin');
    expect(fieldOf('RequestGroup', 'sharedByUserId').type).toBe('String');
  });

  it('GroupShareWorkflow links source to target group (ADR-0009)', () => {
    findModel('GroupShareWorkflow');
    expect(fieldOf('GroupShareWorkflow', 'sourceGroupId').type).toBe('String');
    expect(fieldOf('GroupShareWorkflow', 'targetGroupId').type).toBe('String');
  });

  it('BoardColumn is per-group, ordinal-keyed (ADR-0006)', () => {
    findModel('BoardColumn');
    expect(fieldOf('BoardColumn', 'groupId').type).toBe('String');
    expect(fieldOf('BoardColumn', 'ordinal').type).toBe('Int');
    expect(fieldOf('BoardColumn', 'displayName').type).toBe('String');
  });

  it('RequestSubscription has source enum', () => {
    findModel('RequestSubscription');
    expect(fieldOf('RequestSubscription', 'source').type).toBe('SubscriptionSource');
  });
});

describe('coord-board schema — field additions on existing entities', () => {
  it('Group.kind is GroupKind enum', () => {
    expect(fieldOf('Group', 'kind').type).toBe('GroupKind');
    // SQL is the authoritative source for `default 'team'` (DMMF in
    // Prisma 7 doesn't expose enum defaults).
    expect(MIGRATION_SQL).toMatch(/"kind" "GroupKind" NOT NULL DEFAULT 'team'/);
  });

  it('Request gains nullable columnId and boardPosition (additive)', () => {
    expect(fieldOf('Request', 'columnId').type).toBe('String');
    expect(fieldOf('Request', 'boardPosition').type).toBe('Decimal');
    // Both nullable in SQL — existing rows survive.
    expect(MIGRATION_SQL).toMatch(/ADD COLUMN\s+"boardPosition" DECIMAL/);
    expect(MIGRATION_SQL).toMatch(/ADD COLUMN\s+"columnId" TEXT/);
    // Neither column has NOT NULL.
    expect(MIGRATION_SQL).not.toMatch(/"columnId" TEXT NOT NULL/);
  });

  it('Comment gains kind + source with safe defaults (ADR-0007)', () => {
    expect(fieldOf('Comment', 'kind').type).toBe('CommentKind');
    expect(fieldOf('Comment', 'source').type).toBe('CommentSource');
    expect(MIGRATION_SQL).toMatch(/"kind" "CommentKind" NOT NULL DEFAULT 'comment'/);
    expect(MIGRATION_SQL).toMatch(/"source" "CommentSource" NOT NULL DEFAULT 'human'/);
  });

  it('Notification gains lifecycle + nullable reasonKind (ADR-0008)', () => {
    expect(fieldOf('Notification', 'lifecycle').type).toBe('NotificationLifecycle');
    expect(fieldOf('Notification', 'reasonKind').type).toBe('NotificationReasonKind');
    expect(MIGRATION_SQL).toMatch(/"lifecycle" "NotificationLifecycle" NOT NULL DEFAULT 'new'/);
    // reasonKind is nullable on existing rows — no NOT NULL clause.
    expect(MIGRATION_SQL).toMatch(/"reasonKind" "NotificationReasonKind"(?!\s+NOT NULL)/);
  });

  it('Request.claimedByUserId still present (drop deferred to PR #2g.2)', () => {
    expect(fieldOf('Request', 'claimedByUserId').type).toBe('String');
  });

  it('Request.type is nullable per ADR-0010 (Option B)', () => {
    // PR #2g.1: kanban tickets carry type = null; legacy reviewer flows
    // keep their value. The migration just relaxes NOT NULL — no data
    // change to existing rows. Prisma 7 DMMF strips `isRequired`, so we
    // assert the relaxation via the migration SQL (the authoritative
    // source per this file's header note).
    expect(fieldOf('Request', 'type').type).toBe('RequestType');
    expect(MIGRATION_SQL_2G1).toMatch(/ALTER TABLE "Request" ALTER COLUMN "type" DROP NOT NULL/);
  });
});

describe('coord-board schema — uniqueness and cascade contracts', () => {
  it('Assignment is unique per (requestId, userId) — no double-assign', () => {
    expect(MIGRATION_SQL).toMatch(/CREATE UNIQUE INDEX "Assignment_requestId_userId_key"/);
  });

  it('RequestGroup is unique per (requestId, groupId) — no double-share', () => {
    expect(MIGRATION_SQL).toMatch(/CREATE UNIQUE INDEX "RequestGroup_requestId_groupId_key"/);
  });

  it('GroupShareWorkflow is unique per (sourceGroupId, targetGroupId)', () => {
    expect(MIGRATION_SQL).toMatch(
      /CREATE UNIQUE INDEX "GroupShareWorkflow_sourceGroupId_targetGroupId_key"/,
    );
  });

  it('BoardColumn is unique per (groupId, ordinal) — no column collision', () => {
    expect(MIGRATION_SQL).toMatch(/CREATE UNIQUE INDEX "BoardColumn_groupId_ordinal_key"/);
  });

  it('RequestSubscription is unique per (requestId, userId)', () => {
    expect(MIGRATION_SQL).toMatch(/CREATE UNIQUE INDEX "RequestSubscription_requestId_userId_key"/);
  });

  it('Group cascade fans out to BoardColumn / GroupShareWorkflow / RequestGroup', () => {
    expect(MIGRATION_SQL).toMatch(/BoardColumn[^\n]*REFERENCES "Group"\([^)]+\) ON DELETE CASCADE/);
    expect(MIGRATION_SQL).toMatch(
      /GroupShareWorkflow_sourceGroupId_fkey[^\n]*REFERENCES "Group"\([^)]+\) ON DELETE CASCADE/,
    );
    expect(MIGRATION_SQL).toMatch(
      /RequestGroup_groupId_fkey[^\n]*REFERENCES "Group"\([^)]+\) ON DELETE CASCADE/,
    );
  });

  it('Request.columnId FK uses SET NULL on BoardColumn delete', () => {
    expect(MIGRATION_SQL).toMatch(
      /Request_columnId_fkey[^\n]*REFERENCES "BoardColumn"\([^)]+\) ON DELETE SET NULL/,
    );
  });
});

describe('coord-board schema — sync-write data migration (ADR-0007 + ADR-0008)', () => {
  it('flips existing system-authored Comment rows to source = system', () => {
    expect(MIGRATION_SQL).toMatch(
      /UPDATE "Comment"\s+SET "source" = 'system'\s+WHERE "systemKind" IS NOT NULL/,
    );
  });

  it('flips existing read Notification rows to lifecycle = acknowledged', () => {
    expect(MIGRATION_SQL).toMatch(
      /UPDATE "Notification"\s+SET "lifecycle" = 'acknowledged'\s+WHERE "readAt" IS NOT NULL/,
    );
  });
});
