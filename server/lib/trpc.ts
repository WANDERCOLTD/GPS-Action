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
  /** Per-type role scopes (D055). E.g. ["queue_manager:vetting"]. */
  activeScopes: string[];
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
//
// Two forms (D055):
//   requireRole('admin')                       — role check only
//   requireRole('queue_manager:vetting')       — scope check (string with colon)
// A scope string allows a role-level grant OR an exact-scope grant —
// e.g. an unscoped queue_manager grant satisfies queue_manager:vetting,
// but a queue_manager:flag grant does not.

export function requireRole(roleOrScope: SystemRole | string) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    const isScope = typeof roleOrScope === 'string' && roleOrScope.includes(':');
    if (isScope) {
      const role = roleOrScope.split(':', 1)[0] as SystemRole;
      const hasUnscoped = ctx.activeRoles.includes(role);
      const hasScoped = ctx.activeScopes.includes(roleOrScope);
      if (!hasUnscoped && !hasScoped) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
    } else {
      if (!ctx.activeRoles.includes(roleOrScope as SystemRole)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
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
