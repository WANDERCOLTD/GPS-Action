/**
 * @build-unit BU-fab-intent-picker BU-composer
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D062)
 *
 * PostKind tRPC router. Read-only surface used by the composer to
 * resolve `?intent=<slug>` → `kindId` UUID at form-render time.
 *
 * Admin CRUD for PostKind lives under the admin router.
 */

import { router, publicProcedure } from '@/server/lib/trpc';
import { listActivePostKinds } from '@/server/services/post-kind';

export const postKindRouter = router({
  listActive: publicProcedure.query(async () => {
    return listActivePostKinds();
  }),
});
