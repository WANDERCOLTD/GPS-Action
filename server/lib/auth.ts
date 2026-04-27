/**
 * @build-unit BU-001-lite
 * @spec architecture/admin-surface.md
 * @spec architecture/environments.md
 *
 * DEV-ONLY auth cookie helpers. Refuses in production. Real auth lands
 * in BU-002. No database imports here — user resolution lives in
 * server/services/auth.ts (boundary: lib cannot import db).
 */

import { cookies } from 'next/headers';
import { isDemoMode } from '@/shared/demo-mode';

export const DEV_COOKIE_NAME = 'gps_dev_user_id';

function assertNotProduction(label: string): void {
  if (process.env.NODE_ENV === 'production' && !isDemoMode()) {
    throw new Error(`[auth] ${label} invoked in production. Real auth (BU-002) is required.`);
  }
}

/** Read the dev user ID from the cookie. Returns null if absent. */
export async function getUserIdFromCookie(): Promise<string | null> {
  assertNotProduction('getUserIdFromCookie');
  const jar = await cookies();
  return jar.get(DEV_COOKIE_NAME)?.value ?? null;
}

/** Set the dev user cookie. httpOnly, lax, no expiry. */
export async function setDevUserCookie(userId: string): Promise<void> {
  assertNotProduction('setDevUserCookie');
  const jar = await cookies();
  jar.set(DEV_COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

/** Clear the dev user cookie. */
export async function clearDevUserCookie(): Promise<void> {
  assertNotProduction('clearDevUserCookie');
  const jar = await cookies();
  jar.delete(DEV_COOKIE_NAME);
}
