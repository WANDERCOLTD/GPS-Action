/**
 * @build-unit BU-composer BU-fab-intent-picker BU-tick-or-cross
 * @spec product/design-philosophy.md
 * @spec product/scenarios.md (SCN-18)
 * @spec architecture/decision-log.md (D044, D062, D069)
 *
 * Compose page — server component that renders the post form shell.
 * Redirects unauthenticated users to /dev/login. Reads ?intent= from
 * the URL (set by IntentFab tiles) to pre-fill type-specific defaults
 * and fetches the active PostKind set so the form can resolve
 * intent slug → kindId at submit time.
 *
 * The page H1 is a stable "Create a post" — per-intent labelling
 * lives in the IntentBanner inside <PostForm /> to avoid the page
 * title duplicating the banner heading.
 *
 * BU-tick-or-cross: reads `WHATSAPP_NETWORK_CHANNEL_URL` server-side
 * and passes it to <PostForm /> so the post-publish handoff modal
 * has the channel deep-link without re-validating in the client.
 */

import { redirect } from 'next/navigation';
import { createTRPCContext } from '@/server/routers/context';
import { createCaller } from '@/server/routers/_app';
import { PostForm, type KindMapEntry } from '@/components/PostForm';
import { createPostAction } from '@/app/compose/actions';
import { whatsappNetworkChannelUrlOrNull } from '@/shared/env/whatsapp-network-channel';
import { getSiteOrigin } from '@/shared/site-origin';
import { REQUIRED_POST_KIND_SLUGS } from '@/shared/post-kinds';

export const metadata = {
  title: 'Create a post — GPS Action',
};

const KNOWN_INTENTS = new Set([
  'happening_now',
  'link_share',
  'call_to_action',
  'cultural',
  'outcome',
  'thought',
  'event',
  'meeting',
  'tick_or_cross',
  'undecided',
]);

interface PageProps {
  searchParams: Promise<{ intent?: string }>;
}

export default async function ComposePage({ searchParams }: PageProps) {
  const ctx = await createTRPCContext();

  if (!ctx.user) {
    redirect('/dev/login?returnTo=/compose');
  }

  const params = await searchParams;
  const intent = params.intent && KNOWN_INTENTS.has(params.intent) ? params.intent : null;

  const caller = createCaller(ctx);
  const kinds = await caller.postKind.listActive();
  const kindMap: Record<string, KindMapEntry> = {};
  for (const k of kinds) {
    kindMap[k.slug] = { id: k.id, isAlertEligible: k.isAlertEligible, displayName: k.displayName };
  }

  // D070: surface missing reference data with a specific error rather
  // than letting it fall through as a generic "Could not create post"
  // at the service layer. The CI reference-data gate is the real merge
  // blocker; this is the dev-experience improvement.
  const missingKinds = REQUIRED_POST_KIND_SLUGS.filter((slug) => !kindMap[slug]);
  if (missingKinds.length > 0) {
    throw new Error(
      `Required PostKind rows missing: ${missingKinds.join(
        ', ',
      )}. Apply pending migrations (npx prisma migrate deploy) or run npm run db:seed.`,
    );
  }

  const networkChannelUrl = whatsappNetworkChannelUrlOrNull();
  const siteOrigin = getSiteOrigin();

  return (
    <main style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
      <h1
        className="gps-title"
        style={{ marginBottom: 'var(--space-6)' }}
        data-testid="compose-page-title"
      >
        Create a post
      </h1>
      <PostForm
        onSubmit={createPostAction}
        intent={intent}
        kindMap={kindMap}
        networkChannelUrl={networkChannelUrl}
        siteOrigin={siteOrigin}
      />
    </main>
  );
}
