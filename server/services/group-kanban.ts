/**
 * @build-unit bu-coordination-board (build seq #2 — group-kanban chunk)
 * @spec build/session-briefs/bu-coordination-board.md
 *
 * Group-flavoured queries for the kanban surface. Coexists with the
 * generic admin Group CRUD (server/services/admin/registry.ts) — this
 * service is read-only group access, scoped to what a member can see
 * on the `/board` surfaces.
 *
 * Three jobs:
 *   1. Picker-feed: which groups can this member open a board for?
 *   2. Slug resolver: load this group + access flags by URL slug.
 *   3. Access primitive: yes/no checks reused by other services and
 *      routers (e.g. before reorder, share, team-blast).
 *
 * Permission shape (from brief permission table):
 *   - `isSystemAdmin` — caller already resolved from RoleGrant; passed
 *     through. Service is permission-agnostic at the system level.
 *   - `isGroupAdmin` — derived from active GroupMembership.role === admin.
 *   - `isMember` — derived from active GroupMembership.
 *   - "Active" membership = leftAt IS NULL AND deletedAt IS NULL.
 *
 * Soft-deleted Groups (`Group.deletedAt`) are invisible to everyone —
 * including system admins — on the kanban surface. Admin restoration
 * goes through admin/registry.ts.
 *
 * Service throws `GroupAccessError` on the assert* helpers; callers
 * (routers) convert to TRPCError. Plain error class avoids a tRPC
 * dependency in this layer.
 *
 * Layer boundary: services → db + lib + shared only.
 */

import type { Group } from '@prisma/client';
import { prisma } from '@/server/db/client';

export interface GroupAccess {
  isMember: boolean;
  isGroupAdmin: boolean;
  isSystemAdmin: boolean;
  /** Any of the three above. False = caller should treat the group as not-found. */
  canViewBoard: boolean;
  /** Group admin OR system admin. Gate for column config, reorder, team-blast, etc. */
  canAdminBoard: boolean;
}

export interface AccessibleGroup {
  group: Group;
  access: GroupAccess;
}

export type GroupAccessErrorKind = 'not_found' | 'forbidden';

export class GroupAccessError extends Error {
  constructor(
    public readonly kind: GroupAccessErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'GroupAccessError';
  }
}

interface AccessQuery {
  userId: string;
  isSystemAdmin: boolean;
}

interface GroupAccessQuery extends AccessQuery {
  groupId: string;
}

interface SlugQuery extends AccessQuery {
  slug: string;
}

function deriveAccess(
  membership: { role: 'member' | 'admin' } | null,
  isSystemAdmin: boolean,
): GroupAccess {
  const isMember = membership !== null;
  const isGroupAdmin = membership?.role === 'admin';
  return {
    isMember,
    isGroupAdmin,
    isSystemAdmin,
    canViewBoard: isMember || isSystemAdmin,
    canAdminBoard: isGroupAdmin || isSystemAdmin,
  };
}

/**
 * Active groups the user can open a board for. System admins see every
 * non-deleted Group; members see groups they actively belong to.
 *
 * Sorted by displayName ascending — stable picker order. Soft-deleted
 * Groups are excluded for both audiences (admin restore lives elsewhere).
 */
export async function listAccessibleGroupsForUser(input: AccessQuery): Promise<AccessibleGroup[]> {
  if (input.isSystemAdmin) {
    const groups = await prisma.group.findMany({
      where: { deletedAt: null },
      orderBy: { displayName: 'asc' },
    });
    // System admin sees everything; membership row optional but checked
    // so isMember / isGroupAdmin reflect reality (not just admin scope).
    const memberships = await prisma.groupMembership.findMany({
      where: {
        userId: input.userId,
        leftAt: null,
        deletedAt: null,
        groupId: { in: groups.map((g) => g.id) },
      },
      select: { groupId: true, role: true },
    });
    const byGroup = new Map(memberships.map((m) => [m.groupId, m]));
    return groups.map((group) => ({
      group,
      access: deriveAccess(byGroup.get(group.id) ?? null, true),
    }));
  }

  const memberships = await prisma.groupMembership.findMany({
    where: {
      userId: input.userId,
      leftAt: null,
      deletedAt: null,
      group: { deletedAt: null },
    },
    include: { group: true },
    orderBy: { group: { displayName: 'asc' } },
  });

  return memberships.map((m) => ({
    group: m.group,
    access: deriveAccess({ role: m.role }, false),
  }));
}

/**
 * Resolve a group by URL slug, scoped to what the caller can see.
 * Returns null when:
 *   - Group doesn't exist or is soft-deleted.
 *   - Caller is neither a member nor a system admin.
 *
 * Existence is masked from non-members (no "forbidden" leak — keeps
 * group discovery scoped to memberships).
 */
export async function getGroupBySlugForUser(input: SlugQuery): Promise<AccessibleGroup | null> {
  const group = await prisma.group.findFirst({
    where: { slug: input.slug, deletedAt: null },
  });
  if (!group) return null;

  const membership = await prisma.groupMembership.findFirst({
    where: {
      userId: input.userId,
      groupId: group.id,
      leftAt: null,
      deletedAt: null,
    },
    select: { role: true },
  });

  const access = deriveAccess(membership, input.isSystemAdmin);
  if (!access.canViewBoard) return null;
  return { group, access };
}

/**
 * Access primitive — never throws, always returns a struct. Callers
 * that want a thrown error use assertCanViewBoard / assertCanAdminBoard.
 *
 * Caveat: returns the zero-access struct (all false except isSystemAdmin)
 * if the group doesn't exist OR is soft-deleted. The caller decides
 * whether that's a 404 or a 403 — at this layer it's the same answer.
 */
export async function getGroupAccess(input: GroupAccessQuery): Promise<GroupAccess> {
  const group = await prisma.group.findFirst({
    where: { id: input.groupId, deletedAt: null },
    select: { id: true },
  });
  if (!group) {
    return {
      isMember: false,
      isGroupAdmin: false,
      isSystemAdmin: input.isSystemAdmin,
      canViewBoard: false,
      canAdminBoard: false,
    };
  }

  const membership = await prisma.groupMembership.findFirst({
    where: {
      userId: input.userId,
      groupId: input.groupId,
      leftAt: null,
      deletedAt: null,
    },
    select: { role: true },
  });

  return deriveAccess(membership, input.isSystemAdmin);
}

/**
 * Throws `GroupAccessError('not_found' | 'forbidden')` when access
 * is denied. Returns the access struct on success — saves a second
 * query for callers that want it.
 */
export async function assertCanViewBoard(input: GroupAccessQuery): Promise<GroupAccess> {
  const access = await getGroupAccess(input);
  if (!access.canViewBoard) {
    // Group not found OR caller is not a member/admin — collapse to
    // not_found to match getGroupBySlugForUser's masking behaviour.
    throw new GroupAccessError('not_found', `Group ${input.groupId} not accessible`);
  }
  return access;
}

/**
 * Throws on non-admin. Distinguishes 'not_found' (group missing or
 * caller can't even view) from 'forbidden' (caller is a member but
 * not a group admin).
 */
export async function assertCanAdminBoard(input: GroupAccessQuery): Promise<GroupAccess> {
  const access = await getGroupAccess(input);
  if (!access.canViewBoard) {
    throw new GroupAccessError('not_found', `Group ${input.groupId} not accessible`);
  }
  if (!access.canAdminBoard) {
    throw new GroupAccessError(
      'forbidden',
      `Group ${input.groupId} requires admin role for this action`,
    );
  }
  return access;
}
