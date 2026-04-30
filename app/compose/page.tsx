/**
 * @build-unit BU-composer BU-fab-intent-picker BU-tick-or-cross BU-link-first-composer BU-publish-router
 * @spec product/design-philosophy.md
 * @spec product/scenarios.md (SCN-18, SCN-24, SCN-25)
 * @spec architecture/decision-log.md (D044, D062, D069, D072)
 * @spec build/session-briefs/bu-link-first-composer.md
 * @spec build/session-briefs/bu-publish-router.md
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
 * and passes it to <PostForm /> so the publish modal can dispatch
 * the share_to_gps_whatsapp action without re-validating in client.
 *
 * BU-publish-router (D072): also passes `kindConfigBySlug` (the four
 * publish-modal config columns) so `<PostPublishModal>` knows which
 * cards to render per kind without an extra round-trip.
 *
 * BU-link-first-composer: also reads ?linkUrl= and ?title= as prefill
 * params from the FAB starter card / paste-and-go shortcut. When
 * either is set and ?intent= is not, the default intent becomes
 * `link_share` (URL prefill) or `thought` (text prefill). linkUrl is
 * normalised through normalizeUrl() at the FAB before the page is
 * reached, so we receive a canonical https URL. Title prefill is
 * truncated to the schema's 200-char cap.
 */

import { redirect } from 'next/navigation';
import { createTRPCContext } from '@/server/routers/context';
import { createCaller } from '@/server/routers/_app';
import {
  PostForm,
  type KindMapEntry,
  type PublishModalKindConfigBySlug,
} from '@/components/PostForm';
import { ArrowLink } from '@/components/ArrowLink';
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

const TITLE_MAX = 200;

interface PageProps {
  searchParams: Promise<{
    intent?: string;
    linkUrl?: string;
    title?: string;
  }>;
}

export default async function ComposePage({ searchParams }: PageProps) {
  const ctx = await createTRPCContext();

  if (!ctx.user) {
    redirect('/dev/login?returnTo=/compose');
  }

  const params = await searchParams;
  const explicitIntent = params.intent && KNOWN_INTENTS.has(params.intent) ? params.intent : null;

  const prefilledLinkUrl = (params.linkUrl ?? '').trim();
  const prefilledTitleRaw = (params.title ?? '').trim();
  const prefilledTitle = prefilledTitleRaw.slice(0, TITLE_MAX);

  // BU-link-first-composer: when no explicit intent, derive a sensible
  // default from the prefill payload. URL → link_share. Text → thought.
  const intent =
    explicitIntent ?? (prefilledLinkUrl ? 'link_share' : prefilledTitle ? 'thought' : null);

  const caller = createCaller(ctx);
  const kinds = await caller.postKind.listActive();
  const kindMap: Record<string, KindMapEntry> = {};
  const kindConfigBySlug: PublishModalKindConfigBySlug = {};
  for (const k of kinds) {
    kindMap[k.slug] = { id: k.id, isAlertEligible: k.isAlertEligible, displayName: k.displayName };
    kindConfigBySlug[k.slug] = {
      actionSlugs: k.actionSlugs,
      reviewMode: k.reviewMode,
      canSelfPublish: k.canSelfPublish,
    };
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
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <ArrowLink href="/feed" direction="back" testIdArea="compose" testIdSuffix="back-feed">
          Back to feed
        </ArrowLink>
      </div>
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
        kindConfigBySlug={kindConfigBySlug}
        networkChannelUrl={networkChannelUrl}
        siteOrigin={siteOrigin}
        prefilledLinkUrl={prefilledLinkUrl || undefined}
        prefilledTitle={prefilledTitle || undefined}
      />
    </main>
  );
}
