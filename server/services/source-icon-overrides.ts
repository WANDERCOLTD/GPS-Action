/**
 * @build-unit BU-source-and-kind-icons
 * @spec adrs/0020-source-and-kind-icons.md
 *
 * Service: fetch SourceIconOverride rows and serve them as a
 * slug-keyed map. Used by `listNetworkSources` and `listNetworkSpread`
 * to decorate each `NetworkCardSource` with its override.
 *
 * Cached per-process for the request lifecycle — the override table
 * is small (<50 rows) and rarely changes; a per-request fetch is
 * cheap and avoids invalidation logic.
 */

import { prisma } from '@/server/db/client';
import type { SourceIconOverrideValue } from '@/shared/network-card';

export async function listSourceIconOverrides(): Promise<
  ReadonlyMap<string, SourceIconOverrideValue>
> {
  const rows = await prisma.sourceIconOverride.findMany({
    select: {
      slug: true,
      iconKind: true,
      imageUrl: true,
      lucideKey: true,
    },
  });
  const map = new Map<string, SourceIconOverrideValue>();
  for (const r of rows) {
    if (r.iconKind !== 'image' && r.iconKind !== 'lucide') continue;
    map.set(r.slug, {
      iconKind: r.iconKind,
      imageUrl: r.imageUrl,
      lucideKey: r.lucideKey,
    });
  }
  return map;
}
