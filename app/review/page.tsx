/**
 * @build-unit bu-review-split
 * @spec adrs/0017-network-card-state.md
 *
 * /review — reviewer-facing slice of the network pipe. Three URL-driven
 * tabs covering the kind_review item lifecycle:
 *
 *   - `for-review` (default) — raw items from the review chat(s),
 *     awaiting a reviewer to claim and verdict. Queries the same
 *     network pipe as /network but with `mode: 'review'` (filters by
 *     chat_id allowlist from SystemSetting).
 *   - `approved` — items the reviewer has approved but the CSV batch
 *     hasn't shipped yet. Empty until bu-review-csv-batch wires the
 *     query against `Request(type=kind_review, resolution=approved,
 *     exportedAt IS NULL)`.
 *   - `sent` — items already included in a CSV batch sent to Grant.
 *     Same Request query with `exportedAt IS NOT NULL`. Empty until
 *     bu-review-csv-batch.
 *
 * Until Grant ships a per-message `kind` field upstream, the
 * for-review discriminator is chat_id-based. The plumbing stays the
 * same once the upstream gains a kind column — only the matching
 * predicate moves.
 *
 * Tab strip uses anchor links (not buttons) so the URL stays the
 * canonical state container — bookmarkable, shareable, back-button
 * compatible. Same idiom as `/network`'s source chips and sort.
 */

import { LayoutGrid } from 'lucide-react';
import Link from 'next/link';
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

const REVIEW_STATUSES = ['for-review', 'approved', 'sent'] as const;
type ReviewStatus = (typeof REVIEW_STATUSES)[number];

function parseStatusParam(raw: string | string[] | undefined): ReviewStatus {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return REVIEW_STATUSES.includes(value as ReviewStatus) ? (value as ReviewStatus) : 'for-review';
}

interface ReviewPageProps {
  searchParams: Promise<{
    status?: string | string[];
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

  const params = await searchParams;
  const status = parseStatusParam(params.status);

  const tabStrip = <ReviewTabStrip active={status} />;

  if (status === 'approved' || status === 'sent') {
    return (
      <main style={{ maxWidth: 1200, margin: '0 auto' }} data-testid={`review-page-${status}`}>
        <PageHeader title="Review" description="Links awaiting review" actions={null} />
        {tabStrip}
        <div
          style={{
            padding: 'var(--space-8) var(--space-5)',
            maxWidth: 720,
            margin: '0 auto',
            textAlign: 'center',
          }}
          data-testid={`review-${status}-empty`}
        >
          <p style={{ color: 'var(--colour-text-secondary)', marginBottom: 'var(--space-2)' }}>
            {status === 'approved' ? 'Outbox is empty.' : 'Nothing sent yet.'}
          </p>
          <p
            className="gps-caption"
            style={{ color: 'var(--colour-text-tertiary, var(--colour-text-secondary))' }}
          >
            {status === 'approved'
              ? 'Approved review items wait here until the next CSV batch ships to Grant.'
              : 'Items move here once a CSV batch has shipped to Grant.'}
            <br />
            <em>Wiring lands with bu-review-csv-batch.</em>
          </p>
        </div>
      </main>
    );
  }

  // status === 'for-review' — load the network pipe with mode='review'.
  const caller = createCaller(ctx);
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
      {tabStrip}
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

function ReviewTabStrip({ active }: { active: ReviewStatus }) {
  // Tab LABELS use email-app idiom (Outbox / Sent) for the post-decision
  // states. URL ?status= values stay as the data states (for-review /
  // approved / sent) so the URL preserves semantic fidelity — "approved"
  // is the Request.resolution value, "Outbox" is what reviewers call
  // that bucket on screen.
  const tabs: { value: ReviewStatus; label: string; testId: string; href: string }[] = [
    { value: 'for-review', label: 'For Review', testId: 'review-tab-for-review', href: '/review' },
    {
      value: 'approved',
      label: 'Outbox',
      testId: 'review-tab-outbox',
      href: '/review?status=approved',
    },
    {
      value: 'sent',
      label: 'Sent',
      testId: 'review-tab-sent',
      href: '/review?status=sent',
    },
  ];
  return (
    <div
      role="tablist"
      aria-label="Review status"
      data-testid="review-tabs"
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        borderBottom: '1px solid var(--colour-border-subtle)',
        padding: '0 var(--space-5)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.value;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            data-testid={tab.testId}
            data-active={isActive}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderBottom: isActive
                ? '2px solid var(--colour-text-link)'
                : '2px solid transparent',
              color: isActive ? 'var(--colour-text-primary)' : 'var(--colour-text-secondary)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-sm)',
              fontWeight: isActive ? 600 : 400,
              textDecoration: 'none',
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
