/**
 * @build-unit BU-whatsapp-share bu-network-shares
 * @spec build/session-briefs/bu-whatsapp-share.md
 * @spec build/session-briefs/bu-network-shares.md
 * @spec adrs/0018-share-event-polymorphic.md
 * @spec architecture/decision-log.md (D065, D077)
 * @spec product/analytics-events.md
 *
 * Share-intent endpoint. Accepts two shapes for back-compat:
 *
 *   1. Legacy (BU-whatsapp-share):
 *      `{ postId: string, destination: 'whatsapp' | ... }`
 *      → stub analytics: hashes postId, logs `[ANALYTICS] post_shared_out`.
 *      No DB write. Preserved verbatim so the existing WhatsApp button
 *      and its tests continue to pass while BU-share-out's real sink
 *      ships separately.
 *
 *   2. Polymorphic (bu-network-shares):
 *      `{ targetType: 'post' | 'network_card', targetId: string,
 *         destination: ShareDestination, verified?: boolean }`
 *      → writes to ShareEvent via `share-event.ts` service. When
 *      `verified: true` is set, also stamps `confirmedAt`. Requires
 *      an authenticated session (dev cookie); refused 401 otherwise.
 *
 * The legacy and polymorphic shapes are distinguished by which keys
 * are present: `postId` ⇒ legacy, `targetType + targetId` ⇒ polymorphic.
 * Payloads mixing both keys take the polymorphic path (forward-leaning).
 *
 * Privacy: legacy path hashes the postId (matches catalogue
 * `post_id_hash`). Polymorphic path does NOT log raw targetIds — the
 * DB write itself is the analytics record, and queries against
 * ShareEvent are aggregate-only.
 */

import { createHash } from 'crypto';
import { getUserIdFromCookie } from '@/server/lib/auth';
import { isDemoMode } from '@/shared/demo-mode';
import { recordShareIntent, confirmShareSent } from '@/server/services/share-event';
import type { ShareDestination, ShareTargetType } from '@prisma/client';

// ── Legacy shape (preserved verbatim) ────────────────────────────────────

const VALID_DESTINATIONS = new Set([
  'whatsapp',
  'x',
  'instagram',
  'facebook',
  'email',
  'copy_link',
  'other',
] as const);
type Destination = typeof VALID_DESTINATIONS extends Set<infer T> ? T : never;

interface LegacyPayload {
  kind: 'legacy';
  postId: string;
  destination: Destination;
}

interface PolymorphicPayload {
  kind: 'polymorphic';
  targetType: ShareTargetType;
  targetId: string;
  destination: ShareDestination;
  verified: boolean;
}

type Payload = LegacyPayload | PolymorphicPayload;

const VALID_TARGET_TYPES = new Set<ShareTargetType>(['post', 'network_card']);

// ── Handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = parsePayload(body);
  if (!parsed) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  if (parsed.kind === 'legacy') {
    emitLegacyIntent(parsed);
    return Response.json({ ok: true });
  }

  // Polymorphic path — auth-gated. In production w/o demo mode the
  // dev cookie helper refuses; gate explicitly first to give a
  // proper 401 rather than a 500.
  if (process.env.NODE_ENV === 'production' && !isDemoMode()) {
    return Response.json({ ok: false, error: 'auth_unavailable' }, { status: 401 });
  }

  const userId = await getUserIdFromCookie();
  if (!userId) {
    return Response.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  if (parsed.verified) {
    await confirmShareSent({
      userId,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      destination: parsed.destination,
    });
  } else {
    await recordShareIntent({
      userId,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      destination: parsed.destination,
    });
  }

  return Response.json({ ok: true });
}

// ── Parsing ──────────────────────────────────────────────────────────────

function parsePayload(value: unknown): Payload | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const destination = record.destination;
  if (typeof destination !== 'string') return null;
  if (!VALID_DESTINATIONS.has(destination as Destination)) return null;

  // Polymorphic shape takes precedence — if both keys are present,
  // treat it as polymorphic (forward-leaning during the BU rollout).
  if (typeof record.targetType === 'string' && typeof record.targetId === 'string') {
    const targetType = record.targetType as ShareTargetType;
    if (!VALID_TARGET_TYPES.has(targetType)) return null;
    if (record.targetId.length === 0) return null;
    const verified = record.verified === true;
    return {
      kind: 'polymorphic',
      targetType,
      targetId: record.targetId,
      destination: destination as ShareDestination,
      verified,
    };
  }

  // Legacy shape — `{ postId, destination }`.
  if (typeof record.postId === 'string' && record.postId.length > 0) {
    return {
      kind: 'legacy',
      postId: record.postId,
      destination: destination as Destination,
    };
  }

  return null;
}

// ── Legacy emitter (verbatim from BU-whatsapp-share) ─────────────────────

function emitLegacyIntent({ postId, destination }: LegacyPayload): void {
  const postIdHash = hashPostId(postId);
  // eslint-disable-next-line no-console -- analytics stub; replaced by real sink in BU-share-out
  console.log(`[ANALYTICS] post_shared_out destination=${destination} post_id_hash=${postIdHash}`);
}

function hashPostId(postId: string): string {
  return createHash('sha256').update(postId).digest('base64url').slice(0, 12);
}
