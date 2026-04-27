/**
 * @build-unit BU-whatsapp-share
 * @spec build/session-briefs/bu-whatsapp-share.md
 * @spec architecture/decision-log.md (D065)
 * @spec product/analytics-events.md
 *
 * Stub analytics sink for the catalogued `post_shared_out` event.
 *
 * Accepts POST with `{ postId: string, destination: 'whatsapp' }` and
 * logs a tagged line to stdout. No real analytics infrastructure is
 * wired in this BU; BU-share-out (when it lands) replaces this stub
 * with the real sink.
 *
 * Privacy: the post id is one-way hashed before logging so logs do
 * not carry raw post identifiers. Matches the catalogue's
 * `post_id_hash` property name.
 */

import { createHash } from 'crypto';

const VALID_DESTINATIONS = new Set(['whatsapp', 'x', 'email', 'copy_link', 'other'] as const);
type Destination = typeof VALID_DESTINATIONS extends Set<infer T> ? T : never;

interface ShareIntentPayload {
  postId: string;
  destination: Destination;
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = parsePayload(payload);
  if (!parsed) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  emitShareIntent(parsed);
  return Response.json({ ok: true });
}

function parsePayload(value: unknown): ShareIntentPayload | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const postId = record.postId;
  const destination = record.destination;
  if (typeof postId !== 'string' || postId.length === 0) return null;
  if (typeof destination !== 'string') return null;
  if (!VALID_DESTINATIONS.has(destination as Destination)) return null;
  return { postId, destination: destination as Destination };
}

function emitShareIntent({ postId, destination }: ShareIntentPayload): void {
  const postIdHash = hashPostId(postId);
  // eslint-disable-next-line no-console -- analytics stub; replaced by real sink in BU-share-out
  console.log(`[ANALYTICS] post_shared_out destination=${destination} post_id_hash=${postIdHash}`);
}

function hashPostId(postId: string): string {
  return createHash('sha256').update(postId).digest('base64url').slice(0, 12);
}
