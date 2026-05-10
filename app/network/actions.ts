'use server';

/**
 * @build-unit BU-network-feed
 * @spec adrs/0017-network-card-state.md
 *
 * Server actions for /network. Wraps the tRPC procedures from Chunk A
 * with the wire-string ↔ bigint conversion and re-serialises the
 * response for the client component boundary.
 *
 * Auth + flag gates live on the underlying tRPC procedures
 * (`server/routers/network.ts`); these wrappers do no extra checks.
 */

import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';
import {
  serializeNetworkListResponse,
  type NetworkCardStatus,
  type SerializedNetworkCardWorkflowState,
  type SerializedNetworkListResponse,
} from '@/shared/network-card';

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
