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
 */
export interface GpsGroupMessageRow {
  id: number;
  sent_at: string;
  from_name: string | null;
  sender_hash: string;
  url: string;
  link_title: string | null;
  text_body: string | null;
  chat_id: string;
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
  /** Optional cursor — when set, fetch rows with `id` strictly less than this. */
  cursorId?: number;
  /** Optional fetch override — primarily for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetch a window of rows from `public.gps_group_messages`. Sort is
 * `id DESC` (PostgREST orders by the bigint primary key for stable
 * cursor pagination — `sent_at` ties on bulk imports).
 */
export async function listGpsGroupMessages(
  args: ListGpsGroupMessagesArgs,
): Promise<GpsGroupMessageRow[]> {
  const config = readConfig();
  const fetchImpl = args.fetchImpl ?? fetch;

  const sinceIso = new Date(Date.now() - args.windowDays * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams();
  params.set('select', 'id,sent_at,from_name,sender_hash,url,link_title,text_body,chat_id');
  params.set('sent_at', `gte.${sinceIso}`);
  if (args.cursorId !== undefined) {
    params.set('id', `lt.${args.cursorId}`);
  }
  params.set('order', 'id.desc');
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
 * Re-export the workflow status union so the service layer can talk
 * about Supabase rows + state in the same module without crossing
 * the validation barrel.
 */
export type { NetworkCardStatusValue };
