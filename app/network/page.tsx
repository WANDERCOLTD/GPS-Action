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
import { serializeNetworkListResponse } from '@/shared/network-card';

export const metadata = {
  title: 'Network — GPS Action',
};

export default async function NetworkPage() {
  const flagEnabled = await isFeatureEnabled('network_feed');
  if (!flagEnabled) {
    return (
      <main
        style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}
        data-testid="network-flag-off"
      >
        <h1 className="gps-title" style={{ marginBottom: 'var(--space-3)' }}>
          Network
        </h1>
        <p style={{ color: 'var(--colour-text-secondary)' }}>
          The Network feed isn&rsquo;t turned on yet.
        </p>
      </main>
    );
  }

  const ctx = await createTRPCContext();
  if (!ctx.user) {
    return (
      <main style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
        <h1 className="gps-title" style={{ marginBottom: 'var(--space-3)' }}>
          Network
        </h1>
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
    );
  }

  const caller = createCaller(ctx);
  const initial = await caller.network.list({});
  const initialSerialised = serializeNetworkListResponse(initial);

  return (
    <main
      style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}
      data-testid="network-page"
    >
      <NetworkFeed initial={initialSerialised} />
    </main>
  );
}
