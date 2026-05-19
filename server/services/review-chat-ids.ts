/**
 * @build-unit bu-review-split
 * @spec architecture/admin-surface.md
 * @spec adrs/0017-network-card-state.md
 *
 * Discriminator for the `/network` vs `/review` split. Until Grant
 * ships a per-message `kind` field upstream, the discriminator is
 * chat_id-based: items posted in a designated "review" WhatsApp chat
 * route to `/review`; everything else stays on `/network`.
 *
 * Source of truth: `SystemSetting` key `network_review_chat_ids`,
 * value is a JSON array of chat_id strings (admin-tunable). Empty /
 * unset = no chats are review channels, so `/review` is empty and
 * `/network` is unchanged.
 *
 * Layer boundary: services → db + lib + shared only.
 */

import { getSystemSetting } from '@/server/services/system-setting';

export const REVIEW_CHAT_IDS_KEY = 'network_review_chat_ids';

/**
 * Returns the set of chat_ids that route to `/review`. Returns an
 * empty Set when the setting is missing or malformed (silent —
 * malformed setting shouldn't break the surface).
 */
export async function getReviewChatIds(): Promise<Set<string>> {
  const raw = await getSystemSetting(REVIEW_CHAT_IDS_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const ids = parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
    return new Set(ids);
  } catch {
    return new Set();
  }
}
