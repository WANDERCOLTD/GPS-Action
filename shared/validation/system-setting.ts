/**
 * @build-unit bu-network-card-body-clamp
 * @spec build/session-briefs/bu-network-card-body-clamp.md
 *
 * Validation for the admin-edit SystemSetting surface. The key list
 * here is a whitelist: only these keys may be set via the admin UI.
 * Adding a new admin-tunable setting means adding its key here AND
 * extending the admin form. Anything else stays in code-as-default
 * or migration-as-seed.
 */

import { z } from 'zod';

/**
 * Whitelisted keys that the admin /settings UI can edit. Keep this
 * list small and meaningful. Each key carries an implicit value-shape
 * contract verified by the per-key parser at the read site
 * (e.g. `getSystemSettingInt` rejects non-numerics with a fallback).
 */
export const ADMIN_SETTABLE_KEYS = [
  'urgent_ttl_hours',
  'network_card_body_clamp_threshold_lines',
] as const;

export type AdminSettableKey = (typeof ADMIN_SETTABLE_KEYS)[number];

/** Mutation input for systemSetting.update. */
export const systemSettingUpdateInput = z.object({
  key: z.enum(ADMIN_SETTABLE_KEYS),
  /**
   * Stored as TEXT, parsed at the read site. The router accepts any
   * trimmed non-empty string here; the per-key value shape is the
   * read site's contract, not the router's.
   */
  value: z.string().trim().min(1).max(64),
});

export type SystemSettingUpdateInput = z.infer<typeof systemSettingUpdateInput>;
