/**
 * @build-unit BU-001-lite
 * @spec architecture/environments.md
 *
 * Server actions for the dev login page. Sets/clears the dev auth
 * cookie and writes audit entries via routers/dev helpers.
 */

'use server';

import { redirect } from 'next/navigation';
import { performDevLogin, performDevLogout } from '@/server/routers/dev';

/** Log in as the specified user. Sets cookie, writes audit, redirects to /. */
export async function loginAs(userId: string): Promise<never> {
  await performDevLogin(userId);
  redirect('/');
}

/** Log out. Clears cookie, writes audit, redirects to /dev/login. */
export async function logout(): Promise<never> {
  await performDevLogout();
  redirect('/dev/login');
}
