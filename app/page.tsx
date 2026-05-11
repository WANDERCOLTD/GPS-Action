/**
 * @build-unit BU-000-scaffold BU-feed
 * @spec architecture/decision-log.md (D003)
 *
 * Landing page — routes by auth state:
 *   - Authenticated users → `/network` when `network_first` is on,
 *     else `/feed`. The flag lets us flip the primary surface without
 *     a deploy (D036).
 *   - Logged-out visitors → /capabilities (the showcase mockup; better
 *     first impression than the bare "please log in" placeholder)
 */

import { redirect } from 'next/navigation';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';

export default async function Page() {
  const ctx = await createTRPCContext();

  if (ctx.user) {
    const networkFirst = await isFeatureEnabled('network_first');
    redirect(networkFirst ? '/network' : '/feed');
  }

  redirect('/capabilities');
}
