/**
 * tRPC initialisation.
 * Feature routers build on these primitives.
 */

import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

const t = initTRPC.create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
// protectedProcedure, adminProcedure etc. added as auth lands.
