/**
 * Shared visibility predicate for post-querying services.
 *
 * @build-unit BU-search-surface (precursor refactor)
 * @spec D078 §5 — search.query MUST reuse listPosts's visibility predicate.
 *
 * Three existing services compute the same caller-aware visibility filter
 * inline (listPosts, listUpcoming, listNearby in post.ts). Search will be
 * the fourth. Centralising the rule here means a single point of change
 * if the visibility model evolves (e.g. when partner-org-only posts land
 * with §3.30, or when private-thread posts ship).
 *
 * Rule: unauthenticated callers see only `public`; authenticated callers
 * additionally see `authenticated_only`. No other states exist today.
 */

import type { PostVisibility } from '@prisma/client';

/**
 * The set of `PostVisibility` values a given caller is allowed to see.
 *
 * @param callerId The authenticated user's id, or `null` / `undefined`
 *   for unauthenticated/logged-out callers. Accepts `null` because
 *   several existing call-site input types model the absence as
 *   `string | null` rather than `string | undefined`.
 * @returns Array suitable for use in a Prisma `visibility: { in: ... }`
 *   clause.
 *
 * @example
 *   const visibility = getPostVisibilityFilter(input.callerId);
 *   await prisma.post.findMany({
 *     where: { visibility: { in: visibility }, ... },
 *   });
 */
export function getPostVisibilityFilter(
  callerId: string | null | undefined,
): PostVisibility[] {
  return callerId ? ['public', 'authenticated_only'] : ['public'];
}
