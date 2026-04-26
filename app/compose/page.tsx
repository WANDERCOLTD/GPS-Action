/**
 * @build-unit BU-composer BU-fab-intent-picker
 * @spec product/design-philosophy.md
 * @spec product/scenarios.md (SCN-18)
 * @spec architecture/decision-log.md (D044, D062)
 *
 * Compose page — server component that renders the post form shell.
 * Redirects unauthenticated users to /dev/login. Reads ?intent= from
 * the URL (set by IntentFab tiles) to pre-fill type-specific defaults.
 */

import { redirect } from 'next/navigation';
import { createTRPCContext } from '@/server/routers/context';
import { PostForm } from '@/components/PostForm';
import { createPostAction } from '@/app/compose/actions';

export const metadata = {
  title: 'New post — GPS Action',
};

const KNOWN_INTENTS = new Set([
  'link_share',
  'call_to_action',
  'cultural',
  'outcome',
  'thought',
  'event',
  'meeting',
  'undecided',
]);

const INTENT_HEADINGS: Record<string, string> = {
  link_share: 'Share a link',
  call_to_action: 'Call to action',
  cultural: 'Cultural moment',
  outcome: 'Outcome — what happened',
  thought: 'Just a thought',
  event: 'Event',
  meeting: 'Meeting',
  undecided: 'New post',
};

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
  const heading = (intent && INTENT_HEADINGS[intent]) ?? 'New post';

  return (
    <main style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
      <h1
        className="gps-title"
        style={{ marginBottom: 'var(--space-6)' }}
        data-testid="compose-page-title"
      >
        {heading}
      </h1>
      <PostForm onSubmit={createPostAction} intent={intent} />
    </main>
  );
}
