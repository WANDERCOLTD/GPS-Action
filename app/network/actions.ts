'use server';

/**
 * @build-unit BU-network-feed BU-network-reactions
 * @spec adrs/0017-network-card-state.md
 *
 * Server actions for /network. Wraps the tRPC procedures from Chunk A
 * with the wire-string ↔ bigint conversion and re-serialises the
 * response for the client component boundary.
 *
 * Auth + flag gates live on the underlying tRPC procedures
 * (`server/routers/network.ts`); these wrappers do no extra checks.
 *
 * BU-network-reactions added the three reaction actions at the bottom
 * — they wrap the new `reaction.{add,remove,list}NetworkCard*`
 * procedures so NetworkCard can take callbacks as props.
 */

import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import {
  serializeNetworkListResponse,
  type NetworkCardStatus,
  type SerializedNetworkCardReaction,
  type SerializedNetworkCardWorkflowState,
  type SerializedNetworkListResponse,
} from '@/shared/network-card';
import type { FeedReactionEmoji } from '@/components/PostCard';

export async function refreshNetworkList(args: {
  cursor?: string;
}): Promise<SerializedNetworkListResponse> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  const result = await caller.network.list({
    refresh: true,
    cursor: args.cursor,
  });
  return serializeNetworkListResponse(result);
}

export async function loadMoreNetworkCards(cursor: string): Promise<SerializedNetworkListResponse> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  const result = await caller.network.list({ cursor });
  return serializeNetworkListResponse(result);
}

export async function setNetworkCardStateAction(args: {
  messageId: string;
  status: NetworkCardStatus;
  ownerUserId?: string | null;
  notes?: string | null;
}): Promise<SerializedNetworkCardWorkflowState> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  const result = await caller.network.setCardState({
    messageId: BigInt(args.messageId),
    status: args.status,
    ownerUserId: args.ownerUserId ?? undefined,
    notes: args.notes ?? undefined,
  });
  return {
    status: result.state.status,
    ownerUserId: result.state.ownerUserId,
    ownerDisplayName: result.state.ownerDisplayName,
    notes: result.state.notes,
    updatedAt: result.state.updatedAt ? result.state.updatedAt.toISOString() : null,
  };
}

// ── BU-network-reactions ─────────────────────────────────────────────────

export async function addReactionToNetworkCardAction(
  messageId: string,
  emoji: FeedReactionEmoji,
): Promise<void> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  await caller.reaction.addToNetworkCard({ messageId, emoji });
}

export async function removeReactionFromNetworkCardAction(
  messageId: string,
  emoji: FeedReactionEmoji,
): Promise<void> {
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  await caller.reaction.removeFromNetworkCard({ messageId, emoji });
}

/**
 * Bulk-fetch aggregate reactions for the visible card window — keeps
 * the surface N+1-free. Returns a plain Record keyed by messageId
 * (string). Cards with zero reactions render as an empty array.
 */
export async function listReactionsForNetworkCardsAction(
  messageIds: string[],
): Promise<Record<string, SerializedNetworkCardReaction[]>> {
  if (messageIds.length === 0) return {};
  const ctx = await createTRPCContext();
  const caller = createCaller(ctx);
  return caller.reaction.listForNetworkCards({ messageIds });
}
