/**
 * @build-unit BU-network-spread-gallery
 * @spec build/session-briefs/bu-network-spread-gallery.md
 *
 * /network/spread — Photos-app-style gallery of URLs spreading
 * across WhatsApp groups. Server component fetches the initial
 * tile set, hands off to the client grid for tile-tap → detail
 * sheet interaction.
 *
 * Gated by the same `network_feed` feature flag as /network.
 */

import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { NetworkSourceChipStrip, parseSourcesParam } from '@/components/NetworkSourceChipStrip';
import {
  NetworkSpreadTypeChipStrip,
  parseTypesParam,
} from '@/components/NetworkSpreadTypeChipStrip';
import {
  NetworkSpreadSortControl,
  parseSpreadSortParam,
} from '@/components/NetworkSpreadSortControl';
import { NetworkSpreadGrid } from '@/components/NetworkSpreadGrid';
import { PageHeader } from '@/components/PageHeader';

export const metadata = {
  title: 'What’s spreading — GPS Action',
};

interface SpreadPageProps {
  searchParams: Promise<{
    source?: string | string[];
    type?: string | string[];
    sort?: string | string[];
  }>;
}

export default async function SpreadPage({ searchParams }: SpreadPageProps) {
  const flagEnabled = await isFeatureEnabled('network_feed');
  if (!flagEnabled) {
    return (
      <>
        <PageHeader title="What’s spreading" description="Network gallery" />
        <main
          style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: 720, margin: '0 auto' }}
          data-testid="network-spread-flag-off"
        >
          <p style={{ color: 'var(--colour-text-secondary)' }}>
            The Network feed isn’t turned on yet.
          </p>
        </main>
      </>
    );
  }

  const ctx = await createTRPCContext();
  if (!ctx.user) {
    return (
      <>
        <PageHeader title="What’s spreading" description="Network gallery" />
        <main style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
          <p style={{ color: 'var(--colour-text-secondary)' }}>
            Please{' '}
            <a
              href="/dev/login"
              style={{ color: 'var(--colour-text-link)' }}
              data-testid="network-spread-login-link"
            >
              log in
            </a>{' '}
            to see the Network gallery.
          </p>
        </main>
      </>
    );
  }

  const caller = createCaller(ctx);
  const params = await searchParams;
  const activeSources = parseSourcesParam(params.source);
  const activeTypes = parseTypesParam(params.type);
  const activeSort = parseSpreadSortParam(params.sort);

  const [response, sources] = await Promise.all([
    caller.network.spread.list({
      sources: activeSources,
      types: activeTypes,
      sort: activeSort,
    }),
    caller.network.listSources({}),
  ]);

  // URL-state preservation: each control's links carry the others' state.
  const sourceQs = activeSources.length ? [...activeSources].sort().join(',') : undefined;
  const typeQs = activeTypes.length ? [...activeTypes].sort().join(',').toLowerCase() : undefined;
  const sortQs = activeSort !== 'mostSpread' ? activeSort : undefined;

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto' }} data-testid="network-spread-page">
      <PageHeader
        title="What’s spreading"
        description={`${response.tiles.length} ${response.tiles.length === 1 ? 'item' : 'items'} · last ${response.windowDays} days`}
        actions={
          <a
            href={sourceQs ? `/network?source=${sourceQs}` : '/network'}
            className="gps-chip"
            data-testid="network-spread-back-to-list"
          >
            List view
          </a>
        }
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          padding: '0 var(--space-3) var(--space-3)',
        }}
      >
        <NetworkSourceChipStrip
          sources={sources}
          active={activeSources}
          preserveParams={{ type: typeQs, sort: sortQs }}
        />
        <NetworkSpreadTypeChipStrip
          active={activeTypes}
          preserveParams={{ source: sourceQs, sort: sortQs }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <NetworkSpreadSortControl
            active={activeSort}
            preserveParams={{ source: sourceQs, type: typeQs }}
          />
        </div>
      </div>

      <NetworkSpreadGrid
        tiles={response.tiles}
        sort={activeSort}
        windowDays={response.windowDays}
      />
    </main>
  );
}
