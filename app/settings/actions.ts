'use server';

/**
 * @build-unit bu-network-card-body-clamp
 * @spec build/session-briefs/bu-network-card-body-clamp.md
 *
 * Server actions for /settings admin edit forms. Wraps the
 * `systemSetting.update` tRPC procedure for use from client form
 * components. Admin auth is enforced by the procedure itself.
 */

import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import type { AdminSettableKey } from '@/shared/validation/system-setting';

export async function setSystemSettingAction(input: {
  key: AdminSettableKey;
  value: string;
}): Promise<{ ok: true }> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  return caller.systemSetting.update(input);
}
