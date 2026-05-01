/**
 * @build-unit BU-000-scaffold BU-feed
 * @spec architecture/decision-log.md (D003)
 *
 * Landing page — routes by auth state:
 *   - Authenticated users → /feed (their app home)
 *   - Logged-out visitors → /capabilities (the showcase mockup; better
 *     first impression than the bare "please log in" placeholder)
 */

import { redirect } from 'next/navigation';
import { createTRPCContext } from '@/server/routers/context';

export default async function Page() {
  const ctx = await createTRPCContext();

  if (ctx.user) {
    redirect('/feed');
  }

  redirect('/capabilities');
}
