/**
 * @build-unit BU-network-spread-gallery
 * @spec build/session-briefs/bu-network-spread-gallery.md
 * @spec adrs/0019-link-preview-store.md
 *
 * Wire-boundary types for the /network/spread surface — the
 * Photos-app-style gallery view of URLs spreading across WhatsApp
 * groups. Tiles are deduped by `normalizedUrl` (from
 * `bu-link-preview-store`); each tile aggregates all occurrences
 * of that URL within the rolling window.
 *
 * Schema mirror: this file is the contract consumed by the client.
 * Keep `LinkType` in sync with `server/lib/url-type.ts`.
 */

import type { NetworkCardSource } from '@/shared/network-card';

export type SpreadSort = 'mostSpread' | 'trending' | 'mostRecent';

export const SPREAD_SORT_OPTIONS: ReadonlyArray<SpreadSort> = [
  'mostSpread',
  'trending',
  'mostRecent',
];

export type SpreadLinkType = 'Social' | 'Video' | 'News' | 'Action' | 'Other';

export const SPREAD_LINK_TYPES: ReadonlyArray<SpreadLinkType> = [
  'Social',
  'Video',
  'News',
  'Action',
  'Other',
];

/**
 * One occurrence of a URL inside the spread window. Aggregated
 * across all groups + senders for a single tile in the gallery.
 */
export interface SpreadOccurrence {
  messageId: bigint;
  sentAt: Date;
  fromName: string | null;
  isForwarded: boolean;
  source: NetworkCardSource;
  /**
   * Raw WhatsApp message text accompanying the URL share. May be
   * null (forwarded with no comment) or empty after URL-strip. The
   * detail sheet renders a quote block only when the stripped text
   * is non-empty — most forwards collapse cleanly.
   */
  textBody: string | null;
}

/**
 * One tile in the gallery — one "thing being shared" across the
 * network. `firstSeenAt` and `lastSeenAt` are the bookends of its
 * spread; `occurrences` is the full timeline (used by the detail
 * sheet's spread-trace UI). `imageUrl` / `title` / `siteName` come
 * from the cached `LinkPreview` row (left join — null for URLs
 * with no cached preview yet; client renders the no-og fallback).
 */
export interface SpreadTile {
  /** Canonical dedup key. */
  normalizedUrl: string;
  /** Representative original URL (the most recently shared variant). */
  url: string;
  /** First-seen group's source metadata (drives the tile's source-chip overlay). */
  firstSeenSource: NetworkCardSource;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Number of distinct messages in the window. ×N badge shows when ≥2. */
  occurrenceCount: number;
  /** Distinct group count — `chip` count if a URL hit multiple groups. */
  distinctSourceCount: number;
  /** Trending velocity score (occurrences within 24h / hours since first seen). */
  trendingScore: number;
  /** OG metadata, when cached. Null until a `LinkPreview` row exists. */
  title: string | null;
  imageUrl: string | null;
  siteName: string | null;
  linkType: SpreadLinkType;
  /** Full occurrence timeline — sorted ascending by sentAt for the detail sheet. */
  occurrences: ReadonlyArray<SpreadOccurrence>;
}

export interface SpreadListResponse {
  tiles: ReadonlyArray<SpreadTile>;
  /** Echo of the window (days) applied — useful for "End of N-day window" UI copy. */
  windowDays: number;
  /** Echo of the trending window (hours) — informational. */
  trendingWindowHours: number;
}

/**
 * Serialised variant — bigint → string for the wire (matches
 * `serializeNetworkListResponse`'s pattern). Used by the route's
 * server component when handing initial data to the client.
 */
export interface SerializedSpreadOccurrence extends Omit<SpreadOccurrence, 'messageId' | 'sentAt'> {
  messageId: string;
  sentAt: string;
}

export interface SerializedSpreadTile extends Omit<
  SpreadTile,
  'firstSeenAt' | 'lastSeenAt' | 'occurrences'
> {
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: ReadonlyArray<SerializedSpreadOccurrence>;
}

export interface SerializedSpreadListResponse extends Omit<SpreadListResponse, 'tiles'> {
  tiles: ReadonlyArray<SerializedSpreadTile>;
}

export function serializeSpreadListResponse(
  resp: SpreadListResponse,
): SerializedSpreadListResponse {
  return {
    ...resp,
    tiles: resp.tiles.map((t) => ({
      ...t,
      firstSeenAt: t.firstSeenAt.toISOString(),
      lastSeenAt: t.lastSeenAt.toISOString(),
      occurrences: t.occurrences.map((o) => ({
        ...o,
        messageId: o.messageId.toString(),
        sentAt: o.sentAt.toISOString(),
      })),
    })),
  };
}

export function deserializeSpreadListResponse(
  resp: SerializedSpreadListResponse,
): SpreadListResponse {
  return {
    ...resp,
    tiles: resp.tiles.map((t) => ({
      ...t,
      firstSeenAt: new Date(t.firstSeenAt),
      lastSeenAt: new Date(t.lastSeenAt),
      occurrences: t.occurrences.map((o) => ({
        ...o,
        messageId: BigInt(o.messageId),
        sentAt: new Date(o.sentAt),
      })),
    })),
  };
}

export const NETWORK_SPREAD_DEFAULT_WINDOW_DAYS = 30;
export const NETWORK_SPREAD_MAX_WINDOW_DAYS = 90;
export const NETWORK_SPREAD_MAX_TILES = 200;
export const NETWORK_SPREAD_DEFAULT_TRENDING_WINDOW_HOURS = 24;
