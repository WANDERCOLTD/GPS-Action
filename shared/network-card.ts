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
