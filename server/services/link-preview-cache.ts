/**
 * @build-unit BU-link-preview-store
 * @spec adrs/0019-link-preview-store.md
 *
 * Persistent server-side cache for URL preview metadata.
 *
 * Read-through pattern: lookup by exact `url`; on miss or expired
 * row, call `fetchLinkMetadata` and upsert. Failures cache too
 * (status `fetch_error`, shorter TTL) so a temporarily-broken URL
 * doesn't hammer upstream on every render.
 *
 * Shared across all surfaces:
 *   /network        list cards (existing consumer)
 *   /network/spread gallery tiles (bu-network-spread-gallery)
 *   /compose        link previews (D060)
 *   /feed           post link cards
 *
 * Boundary preserved: callers continue to use
 * `getLinkPreview(url)` and receive `LinkMetadata | null`. The swap
 * from in-memory `Map` to Postgres is invisible.
 *
 * Forward-compat: stampede coalescer + L1 in-front-of-DB cache are
 * v2 follow-ups, not blocking the gallery. See ADR-0019 §6.
 */

import { prisma } from '@/server/db/client';
import {
  fetchLinkMetadata,
  type LinkMetadata,
  type LinkMetadataResult,
} from '@/server/services/link-metadata';
import { normalizeUrl } from '@/server/lib/url-normalize';
import { classifyUrl } from '@/server/lib/url-type';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function readTtlMs(envName: string, defaultDays: number): number {
  const raw = process.env[envName];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : defaultDays;
  return days * MS_PER_DAY;
}

function ttlForStatus(status: FetchStatus): number {
  if (status === 'ok' || status === 'no_og') {
    return readTtlMs('LINK_PREVIEW_OK_TTL_DAYS', 30);
  }
  return readTtlMs('LINK_PREVIEW_ERROR_TTL_DAYS', 3);
}

type FetchStatus = 'ok' | 'no_og' | 'fetch_error' | 'blocked';

function classifyResult(result: LinkMetadataResult): FetchStatus {
  if (!result.ok) {
    if (result.reason === 'http_403' || result.reason === 'http_429') {
      return 'blocked';
    }
    return 'fetch_error';
  }
  // Successful HTTP, but maybe no useful OG image / title.
  const { title, imageUrl } = result.data;
  if (!title && !imageUrl) return 'no_og';
  return 'ok';
}

function rowToMetadata(row: {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  faviconUrl: string | null;
  fetchStatus: string;
}): LinkMetadata | null {
  // Failures are stored to short-circuit re-fetches but surface as
  // `null` to callers — preview is decorative, never load-bearing.
  if (row.fetchStatus !== 'ok' && row.fetchStatus !== 'no_og') return null;
  if (row.fetchStatus === 'no_og') return null;
  return {
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    siteName: row.siteName,
    faviconUrl: row.faviconUrl,
  };
}

/** Wholesale cache invalidation. Used by admin escape hatch + tests. */
export async function invalidateLinkPreviewCache(): Promise<void> {
  await prisma.linkPreview.deleteMany({});
}

interface GetLinkPreviewDeps {
  /** Override the underlying fetcher. Tests inject; production uses default. */
  fetcher?: typeof fetchLinkMetadata;
}

/**
 * Returns OpenGraph metadata for `url`, or `null` when the fetch
 * fails or the page has no parseable metadata. Result is persisted;
 * a null is also recorded so a broken URL doesn't re-fetch on every
 * list call. TTL by `fetchStatus`: 30 days for ok/no_og, 3 days for
 * fetch_error/blocked.
 */
export async function getLinkPreview(
  url: string,
  deps: GetLinkPreviewDeps = {},
): Promise<LinkMetadata | null> {
  const existing = await prisma.linkPreview.findUnique({ where: { url } });
  const now = new Date();

  if (existing && existing.expiresAt > now) {
    return rowToMetadata(existing);
  }

  const fetcher = deps.fetcher ?? fetchLinkMetadata;
  const result = await fetcher({ url });
  const status = classifyResult(result);
  const data: LinkMetadata = result.ok
    ? result.data
    : { title: null, description: null, imageUrl: null, siteName: null, faviconUrl: null };

  const expiresAt = new Date(now.getTime() + ttlForStatus(status));
  const normalizedUrl = normalizeUrl(url);
  const linkType = classifyUrl(url);

  await prisma.linkPreview.upsert({
    where: { url },
    create: {
      url,
      normalizedUrl,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      siteName: data.siteName,
      faviconUrl: data.faviconUrl,
      linkType,
      fetchStatus: status,
      fetchedAt: now,
      expiresAt,
    },
    update: {
      normalizedUrl,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      siteName: data.siteName,
      faviconUrl: data.faviconUrl,
      linkType,
      fetchStatus: status,
      fetchedAt: now,
      expiresAt,
    },
  });

  return status === 'ok' ? data : null;
}
