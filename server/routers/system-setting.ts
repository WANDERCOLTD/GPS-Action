/**
 * @build-unit bu-network-card-body-clamp
 * @spec build/session-briefs/bu-network-card-body-clamp.md
 *
 * SystemSetting admin router. One mutation: `update`. Admin-only;
 * the underlying service writes the audit log entry on every
 * successful upsert.
 *
 * Per the admin-surface convention, role check is inline (no
 * entity-metadata gating). SystemSettings is a small handful of
 * known keys, all whitelisted in
 * `shared/validation/system-setting.ts`.
 *
 * Layer boundary: routers → services + shared + lib only.
 */

import { TRPCError } from '@trpc/server';
import { router, authedProcedure } from '@/server/lib/trpc';
import { setSystemSetting } from '@/server/services/system-setting';
import { systemSettingUpdateInput } from '@/shared/validation/system-setting';

export const systemSettingRouter = router({
  update: authedProcedure.input(systemSettingUpdateInput).mutation(async ({ ctx, input }) => {
    if (!ctx.activeRoles.includes('admin')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only admins can update system settings.',
      });
    }
    await setSystemSetting({
      key: input.key,
      value: input.value,
      updatedByUserId: ctx.user.id,
    });
    return { ok: true } as const;
  }),
});
