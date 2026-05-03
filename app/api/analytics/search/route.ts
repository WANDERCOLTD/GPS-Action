/**
 * @build-unit BU-search-surface
 * @spec product/analytics-events.md
 * @spec architecture/decision-log.md (D078)
 *
 * Stub analytics sink for the four BU-search-surface events. Mirrors
 * the `app/api/analytics/share-intent` pattern from BU-whatsapp-share
 * — logs a tagged line to stdout. The real PostHog sink lands in
 * BU-share-out; this stub remains in the meantime so the wire format
 * is exercised end-to-end and the privacy invariants (no raw query)
 * are checked at the boundary.
 *
 * Privacy: rejects any payload that smuggles a `q` field. Member
 * names commonly appear in queries — bouncing them at the boundary is
 * defence-in-depth alongside the client emitter never sending one.
 */

const VALID_EVENTS = new Set([
  'search_opened',
  'search_query_submitted',
  'search_result_clicked',
  'search_see_all_clicked',
] as const);
type SearchEventName = typeof VALID_EVENTS extends Set<infer T> ? T : never;

const VALID_SOURCES = new Set(['appnav', 'deep_link', 'scope_chip'] as const);
const VALID_ENTITY_TYPES = new Set(['posts', 'people', 'regions', 'partnerOrgs'] as const);

interface SearchEventPayload {
  event: SearchEventName;
  source?: string;
  q_length?: number;
  has_scope_chip?: boolean;
  entity_type?: string;
  position_in_group?: number;
  group_position?: number;
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!raw || typeof raw !== 'object') {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }
  const record = raw as Record<string, unknown>;

  // Privacy gate — refuse any payload containing the raw query string.
  if ('q' in record || 'query' in record) {
    return Response.json({ ok: false, error: 'pii_rejected' }, { status: 400 });
  }

  const eventName = record.event;
  if (typeof eventName !== 'string' || !VALID_EVENTS.has(eventName as SearchEventName)) {
    return Response.json({ ok: false, error: 'unknown_event' }, { status: 400 });
  }

  const payload: SearchEventPayload = { event: eventName as SearchEventName };

  if (eventName === 'search_opened') {
    if (typeof record.source !== 'string' || !VALID_SOURCES.has(record.source as never)) {
      return Response.json({ ok: false, error: 'invalid_source' }, { status: 400 });
    }
    payload.source = record.source;
  } else if (eventName === 'search_query_submitted') {
    if (typeof record.q_length !== 'number' || record.q_length < 0) {
      return Response.json({ ok: false, error: 'invalid_q_length' }, { status: 400 });
    }
    if (typeof record.has_scope_chip !== 'boolean') {
      return Response.json({ ok: false, error: 'invalid_has_scope_chip' }, { status: 400 });
    }
    payload.q_length = record.q_length;
    payload.has_scope_chip = record.has_scope_chip;
  } else if (eventName === 'search_result_clicked') {
    if (
      typeof record.entity_type !== 'string' ||
      !VALID_ENTITY_TYPES.has(record.entity_type as never)
    ) {
      return Response.json({ ok: false, error: 'invalid_entity_type' }, { status: 400 });
    }
    if (typeof record.position_in_group !== 'number' || record.position_in_group < 0) {
      return Response.json({ ok: false, error: 'invalid_position' }, { status: 400 });
    }
    if (typeof record.group_position !== 'number' || record.group_position < 0) {
      return Response.json({ ok: false, error: 'invalid_group_position' }, { status: 400 });
    }
    payload.entity_type = record.entity_type;
    payload.position_in_group = record.position_in_group;
    payload.group_position = record.group_position;
  } else if (eventName === 'search_see_all_clicked') {
    if (
      typeof record.entity_type !== 'string' ||
      !VALID_ENTITY_TYPES.has(record.entity_type as never)
    ) {
      return Response.json({ ok: false, error: 'invalid_entity_type' }, { status: 400 });
    }
    payload.entity_type = record.entity_type;
  }

  // eslint-disable-next-line no-console -- analytics stub; replaced by real sink in BU-share-out
  console.log(`[ANALYTICS] ${payload.event} ${JSON.stringify(payload)}`);
  return Response.json({ ok: true });
}
