/**
 * Ping router — hello-world tRPC router.
 * Remove once real routers exist.
 */

import { z } from 'zod';
import { router, publicProcedure } from '@/server/lib/trpc';
import { createPing, listPings } from '@/server/services/ping';

export const pingRouter = router({
  hello: publicProcedure.query(() => {
    return { message: 'GPS Action is alive.' };
  }),

  create: publicProcedure
    .input(z.object({ message: z.string().min(1).max(500) }))
    .mutation(async ({ input }) => {
      return createPing(input.message);
    }),

  list: publicProcedure.query(async () => {
    return listPings();
  }),
});
