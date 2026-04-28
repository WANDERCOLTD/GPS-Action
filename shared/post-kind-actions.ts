/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Per-kind publish-modal action registry. The slug list ships in
 * `PostKind.actionSlugs` (DB-side configuration); the handler
 * implementations live here in code (TypeScript that calls server
 * actions, opens URLs, formats clipboard messages, etc.).
 *
 * Phase 1 (this BU) registers exactly one entry —
 * `share_to_gps_whatsapp` — preserving the existing tick_or_cross
 * handoff. Other slug values that appear in `PostKind.actionSlugs`
 * (e.g. `schedule_for_sundown`, `share_to_socials`) have no entry
 * yet; the modal renders them as disabled "Coming soon" cards via
 * `getPostKindAction(slug)` returning `null`.
 *
 * To add a kind-specific action: implement a handler in
 * `shared/post-kind-actions/<slug>.ts`, then register it here.
 */

import { shareToGpsWhatsappAction } from './post-kind-actions/share-to-gps-whatsapp';
import type { PostKindAction } from './post-kind-actions/types';

export type { PostKindAction, PostForAction, ActionContext } from './post-kind-actions/types';

export const POST_KIND_ACTION_REGISTRY: Readonly<Record<string, PostKindAction>> = Object.freeze({
  share_to_gps_whatsapp: shareToGpsWhatsappAction,
});

export function getPostKindAction(slug: string): PostKindAction | null {
  return POST_KIND_ACTION_REGISTRY[slug] ?? null;
}
