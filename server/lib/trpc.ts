/**
 * @build-unit BU-001-lite
 * @spec architecture/api-contract.md
 * @spec architecture/admin-surface.md
 *
 * tRPC initialisation. Feature routers build on these primitives.
 * Context includes the current user and their active roles, resolved
 * at the handler level (server/routers/context.ts).
 */

import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { User, SystemRole } from '@prisma/client';

// ── Context ──────────────────────────────────────────────────────────────

export interface TRPCContext {
  user: User | null;
  activeRoles: SystemRole[];
}

// ── tRPC instance ────────────────────────────────────────────────────────

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

// ── Exports: router, procedure, caller factory ───────────────────────────

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// ── Middleware: requireRole ──────────────────────────────────────────────
//
// Checks ctx.activeRoles (pre-fetched in context creation) rather than
// querying the DB inline. This keeps server/lib/ free of DB imports
// (boundary: lib → db not allowed).
//
// F06 rule 4 (no-inline-auth-check) enforces using this middleware
// in routers rather than inline ctx.user checks.

export function requireRole(role: SystemRole) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    if (!ctx.activeRoles.includes(role)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

// ── Procedure helpers ────────────────────────────────────────────────────

/** Requires an authenticated user (any role). For member-only actions. */
export const authedProcedure = publicProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);
