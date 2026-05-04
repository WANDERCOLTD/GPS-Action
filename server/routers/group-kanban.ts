/**
 * @build-unit bu-coordination-board (build seq #3 — routers)
 * @spec build/session-briefs/bu-coordination-board.md
 *
 * Group-kanban router — read-only Group access for the kanban surface.
 * Coexists with the admin Group CRUD (admin/registry.ts); this layer
 * is what /board/* surfaces call to resolve group context.
 */

import { z } from 'zod';
import { router, authedProcedure } from '@/server/lib/trpc';
import {
  listAccessibleGroupsForUser,
  getGroupBySlugForUser,
  getGroupAccess,
  type AccessibleGroup,
  type GroupAccess,
} from '@/server/services/group-kanban';

const slugSchema = z.object({ slug: z.string().trim().min(1).max(120) });
const groupIdSchema = z.object({ groupId: z.string().min(1) });

export const groupKanbanRouter = router({
  /** Picker feed for /board — groups the caller can open. */
  listMine: authedProcedure.query(async ({ ctx }): Promise<AccessibleGroup[]> => {
    return listAccessibleGroupsForUser({
      userId: ctx.user.id,
      isSystemAdmin: ctx.activeRoles.includes('admin'),
    });
  }),

  /** Slug resolver for /board/[groupSlug]. Returns null when invisible. */
  bySlug: authedProcedure
    .input(slugSchema)
    .query(async ({ ctx, input }): Promise<AccessibleGroup | null> => {
      return getGroupBySlugForUser({
        slug: input.slug,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    }),

  /** Access primitive — never throws; returns the flags struct. */
  myAccess: authedProcedure
    .input(groupIdSchema)
    .query(async ({ ctx, input }): Promise<GroupAccess> => {
      return getGroupAccess({
        groupId: input.groupId,
        userId: ctx.user.id,
        isSystemAdmin: ctx.activeRoles.includes('admin'),
      });
    }),
});
