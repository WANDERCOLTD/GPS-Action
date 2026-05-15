/**
 * @build-unit BU-network-spread-gallery
 * @spec build/session-briefs/bu-network-spread-gallery.md
 * @spec adrs/0019-link-preview-store.md
 *
 * Service backing `/network/spread` — the deduped "what's spreading"
 * gallery. Reads Grant (AIFA)'s `gps_group_messages` view, joins with
 * our local `LinkPreview` cache (`bu-link-preview-store`), groups by
 * `normalizedUrl`, and returns aggregated tiles + per-tile spread
 * traces.
 *
 * Pipeline:
 *   1. Resolve source-chip filter into chat_ids via the cached label set
 *   2. Fetch upstream rows in the window (single batch up to 1000 —
 *      v1 volume of ~5–10 messages/day × 30 days ≈ 300 rows means
 *      one batch is plenty; cap is defensive)
 *   3. Compute `normalizedUrl` per row (via `lib/url-normalize`)
 *   4. Read `LinkPreview` rows for the distinct exact URLs we saw
 *      (one Prisma query, `IN` clause); these supply OG metadata +
 *      `linkType`. Rows without a cached preview fall through to
 *      "no-og" tiles
 *   5. groupBy `normalizedUrl` in memory; build `SpreadTile`s
 *   6. Apply type-chip filter post-aggregation (so a multi-URL group
 *      still counts even if its preview is uncached)
 *   7. Sort, cap at `NETWORK_SPREAD_MAX_TILES`
 *
 * Deliberately NOT in scope:
 *   - Multi-URL extraction from `gps_group_messages.urls text[]`
 *     (separate BU).
 *   - Real-time invalidation on new messages — the spread query
 *     re-runs on each page render; staleness window = TTL of the
 *     /network upstream cache.
 *   - Stampede protection for `LinkPreview` lookups (ADR-0019 §6).
 */

import { prisma } from '@/server/db/client';
import {
  listGpsChatLabels,
  listGpsGroupMessages,
  type GpsChatLabelRow,
  type GpsGroupMessageRow,
} from '@/server/lib/supabase';
import { normalizeUrl } from '@/server/lib/url-normalize';
import { classifyUrl, type LinkType } from '@/server/lib/url-type';
import type {
  SpreadLinkType,
  SpreadListResponse,
  SpreadOccurrence,
  SpreadSort,
  SpreadTile,
} from '@/shared/network-spread';
import {
  NETWORK_SPREAD_DEFAULT_TRENDING_WINDOW_HOURS,
  NETWORK_SPREAD_MAX_TILES,
} from '@/shared/network-spread';
import type { NetworkCardSource } from '@/shared/network-card';

const UPSTREAM_FETCH_CAP = 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

interface ListSpreadInput {
  windowDays: number;
  sources: ReadonlyArray<string>;
  types: ReadonlyArray<SpreadLinkType>;
  sort: SpreadSort;
}

interface ListSpreadDeps {
  fetchUpstream?: typeof listGpsGroupMessages;
  fetchLabels?: typeof listGpsChatLabels;
}

function trendingWindowHours(): number {
  const raw = process.env.NETWORK_SPREAD_TRENDING_WINDOW_HOURS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : NETWORK_SPREAD_DEFAULT_TRENDING_WINDOW_HOURS;
}

function labelToSource(label: GpsChatLabelRow): NetworkCardSource {
  return {
    slug: label.slug,
    label: label.label,
    description: label.description,
    displayOrder: label.display_order,
    color: label.color,
    icon: label.icon,
    memberCount: label.member_count,
  };
}

function isSpreadLinkType(t: LinkType): t is SpreadLinkType {
  // LinkType and SpreadLinkType are structurally identical; this
  // keeps the boundary explicit.
  return t === 'Social' || t === 'Video' || t === 'News' || t === 'Action' || t === 'Other';
}

export async function listNetworkSpread(
  input: ListSpreadInput,
  deps: ListSpreadDeps = {},
): Promise<SpreadListResponse> {
  const fetchUpstream = deps.fetchUpstream ?? listGpsGroupMessages;
  const fetchLabels = deps.fetchLabels ?? listGpsChatLabels;

  // ── 1. Labels ────────────────────────────────────────────────
  const labels = await fetchLabels();
  const sourceByChatId = new Map<string, NetworkCardSource>();
  for (const l of labels) sourceByChatId.set(l.chat_id, labelToSource(l));

  // ── 2. Source-filter → chat_id allowlist ─────────────────────
  let chatIds: string[] | undefined;
  if (input.sources.length > 0) {
    const allowed = new Set(input.sources);
    chatIds = [];
    for (const [chatId, source] of sourceByChatId) {
      if (allowed.has(source.slug)) chatIds.push(chatId);
    }
    if (chatIds.length === 0) {
      return {
        tiles: [],
        windowDays: input.windowDays,
        trendingWindowHours: trendingWindowHours(),
      };
    }
  }

  // ── 3. Upstream fetch ────────────────────────────────────────
  let rows: GpsGroupMessageRow[];
  try {
    rows = await fetchUpstream({
      windowDays: input.windowDays,
      limit: UPSTREAM_FETCH_CAP,
      direction: 'desc',
      chatIds,
    });
  } catch (err) {
    // Upstream config / fetch errors degrade to empty rather than
    // throwing — preview surfaces never load-bearing.
    console.error('[network-spread] upstream fetch failed', err);
    return {
      tiles: [],
      windowDays: input.windowDays,
      trendingWindowHours: trendingWindowHours(),
    };
  }

  if (rows.length === 0) {
    return {
      tiles: [],
      windowDays: input.windowDays,
      trendingWindowHours: trendingWindowHours(),
    };
  }

  // ── 4. LinkPreview join ──────────────────────────────────────
  const exactUrls = Array.from(new Set(rows.map((r) => r.url)));
  const previews =
    exactUrls.length > 0
      ? await prisma.linkPreview.findMany({
          where: { url: { in: exactUrls } },
          select: {
            url: true,
            normalizedUrl: true,
            title: true,
            imageUrl: true,
            siteName: true,
            linkType: true,
          },
        })
      : [];
  const previewByUrl = new Map(previews.map((p) => [p.url, p]));

  // ── 5. Group by normalizedUrl ────────────────────────────────
  interface Bucket {
    normalizedUrl: string;
    /** Most-recent exact URL (drives the tile's outbound link). */
    representativeUrl: string;
    occurrences: SpreadOccurrence[];
    /** Source set keyed by slug for distinct-source count. */
    sourceSlugs: Set<string>;
    /** Cached preview, if any. */
    title: string | null;
    imageUrl: string | null;
    siteName: string | null;
    linkType: SpreadLinkType;
  }

  const buckets = new Map<string, Bucket>();
  for (const row of rows) {
    const norm = previewByUrl.get(row.url)?.normalizedUrl ?? normalizeUrl(row.url);
    const cachedType = previewByUrl.get(row.url)?.linkType ?? classifyUrl(row.url);
    const linkType: SpreadLinkType = isSpreadLinkType(cachedType as LinkType)
      ? (cachedType as SpreadLinkType)
      : 'Other';

    const source = sourceByChatId.get(row.chat_id);
    if (!source) continue; // orphan row — no chat label

    const occurrence: SpreadOccurrence = {
      messageId: BigInt(row.id),
      sentAt: new Date(row.sent_at),
      fromName: row.from_name,
      isForwarded: row.is_forwarded,
      source,
    };

    const existing = buckets.get(norm);
    if (existing) {
      existing.occurrences.push(occurrence);
      existing.sourceSlugs.add(source.slug);
      // Representative URL = the one with the most-recent sentAt.
      // Iteration is sentAt-DESC so first wins.
    } else {
      const cached = previewByUrl.get(row.url);
      buckets.set(norm, {
        normalizedUrl: norm,
        representativeUrl: row.url,
        occurrences: [occurrence],
        sourceSlugs: new Set([source.slug]),
        title: cached?.title ?? row.link_title ?? null,
        imageUrl: cached?.imageUrl ?? null,
        siteName: cached?.siteName ?? null,
        linkType,
      });
    }
  }

  // ── 6. Build tiles + apply type filter ───────────────────────
  const now = Date.now();
  const trendingHours = trendingWindowHours();
  const trendingCutoff = now - trendingHours * MS_PER_HOUR;

  const allowedTypes = input.types.length > 0 ? new Set<SpreadLinkType>(input.types) : null;

  const tiles: SpreadTile[] = [];
  for (const bucket of buckets.values()) {
    if (allowedTypes && !allowedTypes.has(bucket.linkType)) continue;

    // Sort occurrences ascending by sentAt (for the detail-sheet trace).
    const sortedOccurrences = [...bucket.occurrences].sort(
      (a, b) => a.sentAt.getTime() - b.sentAt.getTime(),
    );
    const firstSeen = sortedOccurrences[0]!;
    const lastSeen = sortedOccurrences[sortedOccurrences.length - 1]!;

    const recentCount = sortedOccurrences.filter(
      (o) => o.sentAt.getTime() >= trendingCutoff,
    ).length;
    const hoursSinceFirst = Math.max(1, (now - firstSeen.sentAt.getTime()) / MS_PER_HOUR);
    const trendingScore = recentCount / hoursSinceFirst;

    tiles.push({
      normalizedUrl: bucket.normalizedUrl,
      url: bucket.representativeUrl,
      firstSeenSource: firstSeen.source,
      firstSeenAt: firstSeen.sentAt,
      lastSeenAt: lastSeen.sentAt,
      occurrenceCount: sortedOccurrences.length,
      distinctSourceCount: bucket.sourceSlugs.size,
      trendingScore,
      title: bucket.title,
      imageUrl: bucket.imageUrl,
      siteName: bucket.siteName,
      linkType: bucket.linkType,
      occurrences: sortedOccurrences,
    });
  }

  // ── 7. Sort + cap ────────────────────────────────────────────
  switch (input.sort) {
    case 'mostSpread':
      tiles.sort(
        (a, b) =>
          b.occurrenceCount - a.occurrenceCount || b.lastSeenAt.getTime() - a.lastSeenAt.getTime(),
      );
      break;
    case 'trending':
      tiles.sort(
        (a, b) => b.trendingScore - a.trendingScore || b.occurrenceCount - a.occurrenceCount,
      );
      break;
    case 'mostRecent':
      tiles.sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
      break;
  }

  const capped = tiles.slice(0, NETWORK_SPREAD_MAX_TILES);

  return {
    tiles: capped,
    windowDays: input.windowDays,
    trendingWindowHours: trendingHours,
  };
}
