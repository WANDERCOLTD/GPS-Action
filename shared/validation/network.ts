/**
 * @build-unit BU-network-feed
 * @spec architecture/decision-log.md (D083)
 * @spec adrs/0017-network-card-state.md
 *
 * Zod validation schemas for the network tRPC router. Mirrors the
 * Prisma enum `NetworkCardStatus` and the upstream `messageId`
 * BigInt key (Grant's `gps_group_messages.id`).
 *
 * superjson is the tRPC transformer (server/lib/trpc.ts), so
 * z.bigint() at the boundary is honoured — clients pass real
 * bigints and zod validates them as such.
 */

import { z } from 'zod';

/** Mirrors Prisma's NetworkCardStatus enum. Keep in sync. */
export const NetworkCardStatusSchema = z.enum(['NEW', 'TRIAGED', 'PROMOTED', 'DISCARDED']);

export type NetworkCardStatusValue = z.infer<typeof NetworkCardStatusSchema>;

/** Upper bound on the rolling window (days). 90 was locked in the brief. */
export const NETWORK_LIST_MAX_WINDOW_DAYS = 90;

/** Upper bound on a single page. 50 keeps the wire payload tight at v1 volume. */
export const NETWORK_LIST_MAX_LIMIT = 50;

export const networkListSchema = z.object({
  limit: z.number().int().positive().max(NETWORK_LIST_MAX_LIMIT).default(NETWORK_LIST_MAX_LIMIT),
  /** Opaque cursor — encodes the last-seen `id` for pagination. */
  cursor: z.string().optional(),
  /** Days to look back. Defaults to the brief-locked 90-day window. */
  windowDays: z
    .number()
    .int()
    .positive()
    .max(NETWORK_LIST_MAX_WINDOW_DAYS)
    .default(NETWORK_LIST_MAX_WINDOW_DAYS),
  /** Bypass the cache and fetch fresh. Used by the manual-refresh affordance. */
  refresh: z.boolean().default(false),
});

export type NetworkListInput = z.infer<typeof networkListSchema>;

export const networkSetCardStateSchema = z.object({
  /** Grant's `gps_group_messages.id` — opaque BigInt join key (ADR-0017). */
  messageId: z.bigint(),
  status: NetworkCardStatusSchema,
  /** Optional explicit owner. Null clears ownership. */
  ownerUserId: z.string().uuid().nullable().optional(),
  /** Optional triage note (max 500 chars to keep the surface light). */
  notes: z.string().max(500).nullable().optional(),
});

export type NetworkSetCardStateInput = z.infer<typeof networkSetCardStateSchema>;
