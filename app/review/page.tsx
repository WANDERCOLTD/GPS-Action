/**
 * @build-unit bu-review-split
 * @spec adrs/0017-network-card-state.md
 *
 * /review — reviewer-facing slice of the network pipe. Same Whapi →
 * Supabase ingest as /network, but filtered to items whose chat_id
 * appears in the admin-tunable SystemSetting `network_review_chat_ids`.
 *
 * Until Grant ships a per-message `kind` field upstream, the
 * discriminator is chat_id-based. The plumbing stays the same once
 * the upstream gains a kind column — only the matching predicate moves.
 *
 * Reuses NetworkFeed for interactivity. Distinct from /network only by
 * the mode flag passed to the tRPC list call + the route slug + the
 * page title.
 */

import { LayoutGrid } from 'lucide-react';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import { isFeatureEnabled } from '@/server/services/flags';
import { NetworkFeed } from '@/app/network/network-feed';
import { NetworkSortControl, parseSortParam } from '@/components/NetworkSortControl';
import { NetworkSourceChipStrip, parseSourcesParam } from '@/components/NetworkSourceChipStrip';
import { NetworkUnreadChip, parseUnreadParam } from '@/components/NetworkUnreadChip';
import { PageHeader } from '@/components/PageHeader';
import { serializeNetworkListResponse } from '@/shared/network-card';

export const metadata = {
  title: 'Review — GPS Action',
};

interface ReviewPageProps {
  searchParams: Promise<{
    source?: string | string[];
    sort?: string | string[];
    unread?: string | string[];
  }>;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const flagEnabled = await isFeatureEnabled('network_feed');
  if (!flagEnabled) {
    return (
      <>
        <PageHeader title="Review" description="Links awaiting review" />
        <main
          style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: 720, margin: '0 auto' }}
          data-testid="review-flag-off"
        >
          <p style={{ color: 'var(--colour-text-secondary)' }}>
            The Review queue isn&rsquo;t turned on yet.
          </p>
        </main>
      </>
    );
  }

  const ctx = await createTRPCContext();
  if (!ctx.user) {
    return (
      <>
        <PageHeader title="Review" description="Links awaiting review" />
        <main style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
          <p style={{ color: 'var(--colour-text-secondary)' }}>
            Please{' '}
            <a
              href="/dev/login"
              style={{ color: 'var(--colour-text-link)' }}
              data-testid="review-login-link"
            >
              log in
            </a>{' '}
            to see the Review queue.
          </p>
        </main>
      </>
    );
  }

  const caller = createCaller(ctx);
  const params = await searchParams;
  const activeSources = parseSourcesParam(params.source);
  const activeSort = parseSortParam(params.sort);
  const unreadOnly = parseUnreadParam(params.unread);
  const unreadChipEnabled = await isFeatureEnabled('network_unread_chip');

  const [initial, sources] = await Promise.all([
    caller.network.list({ sources: activeSources, sort: activeSort, mode: 'review' }),
    caller.network.listSources({ mode: 'review' }),
  ]);
  const initialSerialised = serializeNetworkListResponse(initial);

  const sourceQs = activeSources.length ? [...activeSources].sort().join(',') : undefined;
  const sortQs = activeSort !== 'recent' ? activeSort : undefined;
  const unreadQs = unreadOnly ? '1' : undefined;

  const chipStrip = (
    <NetworkSourceChipStrip
      sources={sources}
      active={activeSources}
      preserveParams={{ sort: sortQs, unread: unreadQs }}
    />
  );
  const sortControl = (
    <div
      key="sort-cluster"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
    >
      {unreadChipEnabled && (
        <NetworkUnreadChip
          active={unreadOnly}
          preserveParams={{ source: sourceQs, sort: sortQs }}
        />
      )}
      <NetworkSortControl
        active={activeSort}
        preserveParams={{ source: sourceQs, unread: unreadQs }}
      />
    </div>
  );
  const galleryButton = (
    <a
      key="gallery-button"
      href={sourceQs ? `/network/spread?source=${sourceQs}` : '/network/spread'}
      className="gps-chip"
      data-testid="review-view-gallery"
      aria-label="Switch to gallery view"
      title="Gallery view"
    >
      <LayoutGrid size={16} aria-hidden="true" />
    </a>
  );

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto' }} data-testid="review-page">
      <NetworkFeed
        initial={initialSerialised}
        chipStrip={chipStrip}
        sortControl={sortControl}
        galleryButton={galleryButton}
        unreadOnly={unreadOnly}
      />
    </main>
  );
}
