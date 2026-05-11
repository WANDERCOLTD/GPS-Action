/**
 * @build-unit BU-network-feed
 * @spec adrs/0017-network-card-state.md
 *
 * Supabase REST client for Grant (AIFA)'s read-only view
 * `public.gps_group_messages`. Server-only — the anon key is read
 * from `SUPABASE_ANON_KEY` (NOT `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
 * so it never lands in the browser bundle.
 *
 * We deliberately avoid the `@supabase/supabase-js` SDK at this layer:
 * the surface we need is a single PostgREST GET, plain `fetch` keeps
 * the dependency footprint clean, and the typed query builder is
 * unnecessary at one query site. If a second consumer ever lands,
 * lift this into a thin SDK wrapper then.
 *
 * Lib boundary: this file imports nothing from `/server/db` or
 * `/server/services` — it's a pure HTTP edge talking to an external
 * Postgres-as-a-service. The service layer composes it with our
 * own state-row joins.
 *
 * Threat model (per Grant 2026-05-10): the boundary is grant scoping,
 * not RLS. The anon role on Grant's project has SELECT only on
 * `gps_group_messages` + `gps_chat_labels`, EXECUTE on
 * `gps_ingest_whapi_webhook`, and nothing else. PostgREST returns
 * `PGRST205` ("Could not find the table") for any other table —
 * including agent-state — rather than an empty result. RLS exists as
 * a backstop on agent-state tables in case grants are ever broadened,
 * but it is not the GPS read-path boundary.
 */

import type { NetworkCardStatusValue } from '@/shared/validation/network';

/**
 * The shape of a row returned from `public.gps_group_messages`.
 * Mirrors Grant's column projection (PAUL_INTEGRATION.md, §"Columns")
 * after the 2026-05-10 column-shape change: `from_jid` was dropped,
 * `sender_hash` (SHA-256 of the JID) takes its place.
 *
 * bu-network-source-chips (Round 2 + 3, 2026-05-11):
 * - `is_forwarded` exposed for the "↪ forwarded" meta-row badge
 *   (~28% of feed rows).
 * - Source metadata (slug, label, color, etc.) is fetched separately
 *   via `listGpsChatLabels` and joined in the service layer on
 *   `chat_id`. PostgREST embedded-resource selects require a
 *   declared FK relationship; `gps_chat_labels` is a view (not a
 *   base table), so PostgREST returns PGRST200 for the embed.
 *   The service-side join is cheap (24h-cached labels Map keyed by
 *   chat_id) and decouples the two queries cleanly.
 */
export interface GpsChatLabelRow {
  chat_id: string;
  slug: string;
  label: string;
  description: string | null;
  display_order: number;
  color: string | null;
  icon: string | null;
  member_count: number | null;
}

export interface GpsGroupMessageRow {
  id: number;
  sent_at: string;
  from_name: string | null;
  sender_hash: string;
  url: string;
  link_title: string | null;
  text_body: string | null;
  chat_id: string;
  is_forwarded: boolean;
}

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

export class SupabaseFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'SupabaseFetchError';
  }
}

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

function readConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new SupabaseConfigError(
      'SUPABASE_URL and SUPABASE_ANON_KEY must be set. See .env.example.',
    );
  }
  return { url, anonKey };
}

interface ListGpsGroupMessagesArgs {
  /** Days to look back from now. */
  windowDays: number;
  /** Page size — capped upstream at 50. */
  limit: number;
  /**
   * Compound cursor for keyset pagination. When set, fetches rows
   * strictly older than (cursor.sentAt, cursor.id) in
   * `(sent_at DESC, id DESC)` ordering. Both fields required together —
   * `sent_at` is the primary sort key, `id` is the tiebreaker for rows
   * sharing a sent_at (rare but possible at ms resolution).
   *
   * Replaces the id-only cursor used pre-backfill — id-only ordering
   * placed Grant's recent 1,096-row backfill ahead of older live rows
   * because their IDs were higher even though their sent_at was older.
   */
  cursor?: { sentAt: string; id: number };
  /**
   * bu-network-sort-options — sort direction on the compound
   * (sent_at, id) sort key. `desc` (default) = newest first.
   * `asc` = oldest first. Cursor predicates flip with this.
   */
  direction?: 'desc' | 'asc';
  /**
   * bu-network-source-chips — optional chat_id allowlist. When non-empty,
   * PostgREST `chat_id=in.(...)` filters to just these chats. Pushing the
   * filter upstream is essential: without it, a 50-row page can be
   * dominated by one chat (e.g. after a backfill into one source) and the
   * service-side filter would surface zero rows from the desired source.
   */
  chatIds?: string[];
  /** Optional fetch override — primarily for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

interface ListGpsChatLabelsArgs {
  /** Optional fetch override — primarily for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetch a window of rows from `public.gps_group_messages`. Sort is
 * `sent_at DESC, id DESC` — the time-ordered feed members expect,
 * with `id` as a deterministic tiebreaker for rows sharing a sent_at
 * (ms-resolution collisions are rare but possible).
 *
 * Backfills change the id column behaviour (Grant's 1,096-row import
 * into gps-network-yes-no got id range 178–1236 even though sent_at
 * stretches back to February), so id-DESC alone surfaces backfilled-
 * but-old rows ahead of newer live rows — broken UX. sent_at-DESC
 * orders by actual chat time. Compound cursor handles tiebreakers.
 */
export async function listGpsGroupMessages(
  args: ListGpsGroupMessagesArgs,
): Promise<GpsGroupMessageRow[]> {
  const config = readConfig();
  const fetchImpl = args.fetchImpl ?? fetch;

  const sinceIso = new Date(Date.now() - args.windowDays * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams();
  params.set(
    'select',
    'id,sent_at,from_name,sender_hash,url,link_title,text_body,chat_id,is_forwarded',
  );
  const direction = args.direction ?? 'desc';
  // Keyset predicate flips with sort direction. For DESC: rows past
  // the cursor are STRICTLY OLDER — `sent_at.lt` / `id.lt`. For ASC:
  // rows past the cursor are STRICTLY NEWER — `sent_at.gt` / `id.gt`.
  const cmp = direction === 'desc' ? 'lt' : 'gt';

  params.set('sent_at', `gte.${sinceIso}`);
  if (args.cursor) {
    const sentAt = args.cursor.sentAt;
    const id = args.cursor.id;
    params.set('or', `(sent_at.${cmp}.${sentAt},and(sent_at.eq.${sentAt},id.${cmp}.${id}))`);
  }
  if (args.chatIds && args.chatIds.length > 0) {
    // PostgREST `in.(v1,v2)`. Each value gets wrapped in double quotes
    // (chat_ids contain `@` and `.`, so quoting keeps the parser happy)
    // and the inner quotes inside the value are escaped — though our
    // chat_ids don't contain quotes, do the escape defensively.
    const quoted = args.chatIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
    params.set('chat_id', `in.(${quoted})`);
  }
  params.set('order', direction === 'desc' ? 'sent_at.desc,id.desc' : 'sent_at.asc,id.asc');
  params.set('limit', String(args.limit));

  const response = await fetchImpl(`${config.url}/rest/v1/gps_group_messages?${params}`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new SupabaseFetchError(
      `Supabase REST query failed (${response.status}): ${body.slice(0, 200)}`,
      response.status,
    );
  }

  const rows = (await response.json()) as GpsGroupMessageRow[];
  return rows;
}

/**
 * bu-network-source-chips — fetch the source set for the chip strip.
 * Returns every row in `public.gps_chat_labels` ordered by
 * `display_order ASC, label ASC` (Grant 2026-05-11). Per the Round 2
 * visibility decision, no server-side role filtering — callers do
 * their own gating against `RoleGrant` if/when a coordinator-only
 * source ships.
 */
export async function listGpsChatLabels(
  args: ListGpsChatLabelsArgs = {},
): Promise<GpsChatLabelRow[]> {
  const config = readConfig();
  const fetchImpl = args.fetchImpl ?? fetch;

  const params = new URLSearchParams();
  params.set('select', 'chat_id,slug,label,description,display_order,color,icon,member_count');
  // PostgREST multi-column order: `display_order.asc,label.asc`.
  params.set('order', 'display_order.asc,label.asc');

  const response = await fetchImpl(`${config.url}/rest/v1/gps_chat_labels?${params}`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new SupabaseFetchError(
      `Supabase REST query failed (${response.status}): ${body.slice(0, 200)}`,
      response.status,
    );
  }

  return (await response.json()) as GpsChatLabelRow[];
}

/**
 * Re-export the workflow status union so the service layer can talk
 * about Supabase rows + state in the same module without crossing
 * the validation barrel.
 */
export type { NetworkCardStatusValue };
