/**
 * @build-unit BU-search-surface
 * @spec D078 (all 9 sub-decisions)
 * @spec ADR-0004 (pg_trgm + GIN indexes shipped in #183)
 *
 * App-wide member search service.
 *
 * Returns results grouped by entity in the order locked by **D078 §4**:
 * Posts → People → Regions → Partner orgs. Comments are intentionally
 * not searched in v1 (D078 §2 — privacy review parked). Partner orgs
 * always returns `[]` until §3.30 ships the entity (D078 §9).
 *
 * Visibility for posts uses the **shared `getPostVisibilityFilter`
 * helper** (D078 §5). This is a single point of change — `listPosts`,
 * `listUpcoming`, `listNearby` and this search service all consume the
 * same predicate, so adding a new visibility tier (e.g. partner-org-
 * only posts under §3.30) is a one-edit change.
 *
 * **v1 query style.** Uses Prisma's `contains` with `mode: 'insensitive'`
 * which compiles to `ILIKE '%q%'`. PostgreSQL's planner consumes the
 * `gin_trgm_ops` indexes from ADR-0004 to make these queries fast at
 * scale. **Typo tolerance** (`henden` → `hendon`) requires the `%`
 * operator with `similarity()` — that's a v2 follow-up. The current
 * indexes already support both query styles, so the upgrade is a
 * service-only change with no schema migration.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { getPostVisibilityFilter } from '@/server/services/visibility';
import type { SearchEntityType } from '@/shared/validation/search';

// ── Public types ─────────────────────────────────────────────────────────

/**
 * Generic result row. The router's UI renders all four groups with the
 * same shape so result rendering is one component, not four.
 */
export interface SearchHit {
  id: string;
  /** User-visible label. Post title, person displayName, region displayName, org displayName. */
  label: string;
  /** Where to navigate on tap. */
  href: string;
  /** Optional second-line metadata (e.g. region slug, post createdAt). */
  meta?: string;
}

export interface SearchResults {
  posts: SearchHit[];
  people: SearchHit[];
  regions: SearchHit[];
  /** Always `[]` in v1 — D078 §9 defers partner-orgs as a search entity to the §3.30 BU. */
  partnerOrgs: SearchHit[];
}

export interface SearchAllInput {
  q: string;
  /** Caller's user id, or `null` for unauthenticated. Drives `getPostVisibilityFilter`. */
  callerId: string | null;
  /** When set, only this group is populated and `limit` defaults to 20. */
  type?: SearchEntityType;
  /** Per-group cap. Defaults: 3 (typeahead), 20 (full mode). Caller schema caps at 50. */
  limit?: number;
}

// ── Constants (decisions live in D078; constants live here) ──────────────

const TYPEAHEAD_LIMIT = 3;
const FULL_MODE_DEFAULT_LIMIT = 20;
const MIN_QUERY_LENGTH = 2;

// ── Public API ───────────────────────────────────────────────────────────

export async function searchAll(input: SearchAllInput): Promise<SearchResults> {
  const q = input.q.trim();

  // Server-enforced min length per D078 §6 note. UI also enforces this to
  // avoid debounced chatter; defence-in-depth here.
  if (q.length < MIN_QUERY_LENGTH) {
    return emptyResults();
  }

  const typeahead = input.type === undefined;
  const limit = input.limit ?? (typeahead ? TYPEAHEAD_LIMIT : FULL_MODE_DEFAULT_LIMIT);

  // Run the four group queries concurrently. Group order in the response
  // is fixed (D078 §4) — clients render in receipt order.
  const [posts, people, regions, partnerOrgs] = await Promise.all([
    shouldSearch('posts', input.type) ? searchPosts(q, input.callerId, limit) : [],
    shouldSearch('people', input.type) ? searchPeople(q, limit) : [],
    shouldSearch('regions', input.type) ? searchRegions(q, limit) : [],
    // D078 §9: partner orgs deferred to §3.30. Group always empty in v1.
    [] as SearchHit[],
  ]);

  return { posts, people, regions, partnerOrgs };
}

// ── Per-entity queries ───────────────────────────────────────────────────

async function searchPosts(
  q: string,
  callerId: string | null,
  limit: number,
): Promise<SearchHit[]> {
  const visibilityFilter = getPostVisibilityFilter(callerId);

  const containsQ: Prisma.StringFilter = { contains: q, mode: 'insensitive' };

  const rows = await prisma.post.findMany({
    where: {
      deletedAt: null,
      status: 'published',
      visibility: { in: visibilityFilter },
      OR: [{ title: containsQ }, { body: containsQ }],
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: { id: true, title: true, createdAt: true },
  });

  return rows.map((row) => ({
    id: row.id,
    label: row.title,
    href: `/post/${row.id}`,
    meta: row.createdAt.toISOString(),
  }));
}

async function searchPeople(q: string, limit: number): Promise<SearchHit[]> {
  const rows = await prisma.user.findMany({
    where: {
      displayName: { contains: q, mode: 'insensitive' },
    },
    orderBy: [{ displayName: 'asc' }],
    take: limit,
    select: { id: true, displayName: true },
  });

  return rows.map((row) => ({
    id: row.id,
    label: row.displayName,
    href: `/profile/${row.id}`,
  }));
}

async function searchRegions(q: string, limit: number): Promise<SearchHit[]> {
  const rows = await prisma.region.findMany({
    where: {
      deletedAt: null,
      displayName: { contains: q, mode: 'insensitive' },
    },
    orderBy: [{ displayName: 'asc' }],
    take: limit,
    select: { id: true, slug: true, displayName: true },
  });

  return rows.map((row) => ({
    id: row.id,
    label: row.displayName,
    href: `/regions/${row.slug}`,
    meta: row.slug,
  }));
}

// ── Helpers ──────────────────────────────────────────────────────────────

function shouldSearch(group: SearchEntityType, requested: SearchEntityType | undefined): boolean {
  if (requested === undefined) return true; // typeahead: all groups
  return requested === group; // full mode: only the requested group
}

function emptyResults(): SearchResults {
  return { posts: [], people: [], regions: [], partnerOrgs: [] };
}
