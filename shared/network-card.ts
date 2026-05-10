/**
 * @build-unit BU-network-feed
 * @spec architecture/decision-log.md (D083)
 * @spec adrs/0017-network-card-state.md
 *
 * Wire-boundary types for the /network surface. The cards themselves
 * are read from Grant (AIFA)'s external Supabase view
 * `public.gps_group_messages`; the workflow state comes from our own
 * `NetworkCardState` table (ADR-0017). The shape returned to the
 * client is a join of the two — this file is the contract.
 *
 * `id` is a bigint at the schema level (Grant's column type).
 * superjson handles bigint at the tRPC wire boundary, so the client
 * receives a real bigint primitive — not a stringified one.
 *
 * The status union mirrors the Prisma enum `NetworkCardStatus`. Keep
 * this file and `prisma/schema.prisma` in sync, same convention as
 * the reaction `ReactionEmojiSchema` mirror.
 */

/** Mirrors Prisma's NetworkCardStatus enum. Keep in sync. */
export type NetworkCardStatus = 'NEW' | 'TRIAGED' | 'PROMOTED' | 'DISCARDED';

export const NETWORK_CARD_STATUSES: ReadonlyArray<NetworkCardStatus> = [
  'NEW',
  'TRIAGED',
  'PROMOTED',
  'DISCARDED',
];

export interface NetworkCardWorkflowState {
  status: NetworkCardStatus;
  ownerUserId: string | null;
  ownerDisplayName: string | null;
  notes: string | null;
  updatedAt: Date | null;
}

export interface NetworkCard {
  id: bigint;
  sentAt: Date;
  url: string;
  linkTitle: string | null;
  textBody: string | null;
  fromName: string | null;
  senderHash: string;
  chatId: string;
  state: NetworkCardWorkflowState;
}

export interface NetworkListResponse {
  items: NetworkCard[];
  nextCursor: string | null;
  fetchedAt: Date;
  fromCache: boolean;
}

// ── Wire-serialised variants (server-component → client-component boundary)
//
// React Server Components support bigint at the props boundary, but
// stringifying keeps the client surface portable across test environments
// (jsdom + serialised snapshots) and matches the existing FeedPost pattern
// in `components/PostCard.tsx`. Server actions also accept the string form
// and convert at the boundary.

export interface SerializedNetworkCardWorkflowState {
  status: NetworkCardStatus;
  ownerUserId: string | null;
  ownerDisplayName: string | null;
  notes: string | null;
  /** ISO 8601 string. Null when no state row exists. */
  updatedAt: string | null;
}

export interface SerializedNetworkCard {
  /** Stringified bigint. */
  messageId: string;
  /** ISO 8601 string. */
  sentAt: string;
  url: string;
  linkTitle: string | null;
  textBody: string | null;
  fromName: string | null;
  senderHash: string;
  chatId: string;
  state: SerializedNetworkCardWorkflowState;
}

export interface SerializedNetworkListResponse {
  items: SerializedNetworkCard[];
  nextCursor: string | null;
  /** ISO 8601 string — when the upstream fetch completed. */
  fetchedAt: string;
  fromCache: boolean;
}

export function serializeNetworkCard(card: NetworkCard): SerializedNetworkCard {
  return {
    messageId: card.id.toString(),
    sentAt: card.sentAt.toISOString(),
    url: card.url,
    linkTitle: card.linkTitle,
    textBody: card.textBody,
    fromName: card.fromName,
    senderHash: card.senderHash,
    chatId: card.chatId,
    state: {
      status: card.state.status,
      ownerUserId: card.state.ownerUserId,
      ownerDisplayName: card.state.ownerDisplayName,
      notes: card.state.notes,
      updatedAt: card.state.updatedAt ? card.state.updatedAt.toISOString() : null,
    },
  };
}

export function serializeNetworkListResponse(
  response: NetworkListResponse,
): SerializedNetworkListResponse {
  return {
    items: response.items.map(serializeNetworkCard),
    nextCursor: response.nextCursor,
    fetchedAt: response.fetchedAt.toISOString(),
    fromCache: response.fromCache,
  };
}
