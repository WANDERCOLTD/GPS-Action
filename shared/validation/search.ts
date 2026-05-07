/**
 * @build-unit BU-search-surface
 * @spec D078 §1, §4
 *
 * Zod schemas for the search router. Centralised so the router and any
 * client-side caller share the contract.
 */

import { z } from 'zod';

export const SEARCH_ENTITY_TYPES = [
  'posts',
  'people',
  'regions',
  'partnerOrgs',
  'tickets',
] as const;
export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

export const searchQuerySchema = z.object({
  /** Free-text query. Server enforces min 2 chars (returns empty groups below). */
  q: z.string().min(1).max(120),
  /** When set, return only this entity group (full-results mode). When omitted, typeahead mode returns top 3 of each. */
  type: z.enum(SEARCH_ENTITY_TYPES).optional(),
  /** Per-group cap. Defaults to 3 in typeahead mode and 20 in full mode. Capped at 50. */
  limit: z.number().int().min(1).max(50).optional(),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
