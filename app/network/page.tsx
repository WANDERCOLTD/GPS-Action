/**
 * @build-unit BU-network-feed
 * @spec adrs/0017-network-card-state.md
 * @spec product/design-philosophy.md
 *
 * /network — read-only feed of links shared in the GPS Action Network!
 * WhatsApp group, joined with our own NetworkCardState (ADR-0017).
 *
 * Server component. Fetches the initial 90-day window server-side,
 * serialises for the client boundary, and hands off to NetworkFeed
 * for interactivity (refresh, triage, load more).
 *
 * Three gates, in order:
 *   1. `network_feed` feature flag (D036 / D083) — off → "not available" stub.
 *   2. Auth — unauthenticated → login prompt (matches /feed pattern).
 *   3. Initial fetch — also flag-gated at the tRPC procedure level
 *      (defence in depth).
 *
 * Sharon-warmth posture: empty state and pipe-quiet copy are calm,
 * not "no results, try again." Members get permission to close.
 */

import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { NetworkFeed } from '@/app/network/network-feed';
import { NetworkSortControl, parseSortParam } from '@/components/NetworkSortControl';
import { NetworkSourceChipStrip, parseSourcesParam } from '@/components/NetworkSourceChipStrip';
import { PageHeader } from '@/components/PageHeader';
import { serializeNetworkListResponse } from '@/shared/network-card';

export const metadata = {
  title: 'Network — GPS Action',
};

interface NetworkPageProps {
  /**
   * Next 15 App Router: `searchParams` is a Promise (per the App Router
   * async API change). The page reads `?source=slug-a,slug-b` and
   * `?sort=recent|oldest` and threads both through to the chip strip
   * (active state), the sort control (active state), and the tRPC
   * `list` call (server-side filter + sort).
   */
  searchParams: Promise<{ source?: string | string[]; sort?: string | string[] }>;
}

export default async function NetworkPage({ searchParams }: NetworkPageProps) {
  const flagEnabled = await isFeatureEnabled('network_feed');
  if (!flagEnabled) {
    return (
      <>
        <PageHeader title="Network" description="Live from WhatsApp" />
        <main
          style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: 720, margin: '0 auto' }}
          data-testid="network-flag-off"
        >
          <p style={{ color: 'var(--colour-text-secondary)' }}>
            The Network feed isn&rsquo;t turned on yet.
          </p>
        </main>
      </>
    );
  }

  const ctx = await createTRPCContext();
  if (!ctx.user) {
    return (
      <>
        <PageHeader title="Network" description="Live from WhatsApp" />
        <main style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
          <p style={{ color: 'var(--colour-text-secondary)' }}>
            Please{' '}
            <a
              href="/dev/login"
              style={{ color: 'var(--colour-text-link)' }}
              data-testid="network-login-link"
            >
              log in
            </a>{' '}
            to see the Network feed.
          </p>
        </main>
      </>
    );
  }

  const caller = createCaller(ctx);
  const params = await searchParams;
  const activeSources = parseSourcesParam(params.source);
  const activeSort = parseSortParam(params.sort);
  const [initial, sources] = await Promise.all([
    caller.network.list({ sources: activeSources, sort: activeSort }),
    caller.network.listSources({}),
  ]);
  const initialSerialised = serializeNetworkListResponse(initial);

  // Each filter surface must preserve the other's URL state when its
  // own links are clicked — otherwise toggling a source chip would
  // silently reset sort to default, and vice versa.
  const sourceQs = activeSources.length ? [...activeSources].sort().join(',') : undefined;
  const sortQs = activeSort !== 'recent' ? activeSort : undefined;

  const chipStrip = (
    <NetworkSourceChipStrip
      sources={sources}
      active={activeSources}
      preserveParams={{ sort: sortQs }}
    />
  );
  const sortControl = (
    <NetworkSortControl active={activeSort} preserveParams={{ source: sourceQs }} />
  );

  return (
    <main style={{ maxWidth: 720, margin: '0 auto' }} data-testid="network-page">
      <NetworkFeed initial={initialSerialised} chipStrip={chipStrip} sortControl={sortControl} />
    </main>
  );
}
