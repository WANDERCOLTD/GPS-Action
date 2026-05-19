/**
 * @build-unit BU-network-feed
 * @spec architecture/decision-log.md (D083)
 * @spec adrs/0017-network-card-state.md
 * @spec architecture/api-contract.md
 *
 * Network feed tRPC router. Two procedures:
 *
 *   - `list`        — public read, returns the joined upstream + state cards
 *                     for the /network surface. Feature-flag gated.
 *   - `setCardState` — authed mutation, upserts triage state on a card.
 *
 * Flag gate: both procedures throw FORBIDDEN when `network_feed` is
 * off (D036). The flag default is OFF in both prod and dev — see
 * `docs/product/feature-flag-register.md`.
 *
 * `list` is a `publicProcedure` — the surface is meant to be readable
 * by any authenticated coordinator without role gating beyond the
 * flag. `setCardState` requires auth via `authedProcedure` (any
 * coordinator can triage; per-user ownership is a v2 concern per
 * ADR-0017 §4).
 */

import { TRPCError } from '@trpc/server';
import { router, publicProcedure, authedProcedure } from '@/server/lib/trpc';
import { isFeatureEnabled } from '@/server/services/flags';
import {
  listNetworkCards,
  listNetworkSources,
  setNetworkCardState,
} from '@/server/services/network';
import { listNetworkSpread } from '@/server/services/network-spread';
import {
  networkListSchema,
  networkListSourcesSchema,
  networkSetCardStateSchema,
  networkSpreadListSchema,
} from '@/shared/validation/network';

const FLAG_NAME = 'network_feed';

async function assertFlagEnabled(): Promise<void> {
  if (!(await isFeatureEnabled(FLAG_NAME))) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Network feed is disabled.',
    });
  }
}

export const networkRouter = router({
  list: publicProcedure.input(networkListSchema).query(async ({ input }) => {
    await assertFlagEnabled();
    return listNetworkCards(input);
  }),

  /**
   * bu-network-source-chips — return the active source set for the
   * chip strip on `/network`. Behind the same `network_feed` flag as
   * `list`; same public-read posture (any authenticated coordinator
   * can read; no role gating per Round 2 visibility model).
   */
  listSources: publicProcedure.input(networkListSourcesSchema).query(async ({ input }) => {
    await assertFlagEnabled();
    return listNetworkSources({ mode: input.mode });
  }),

  setCardState: authedProcedure
    .input(networkSetCardStateSchema)
    .mutation(async ({ ctx, input }) => {
      await assertFlagEnabled();
      const state = await setNetworkCardState({
        ...input,
        callerId: ctx.user.id,
      });
      return { ok: true as const, state };
    }),

  /**
   * bu-network-spread-gallery — Photos-app-style gallery on
   * `/network/spread`. Deduped URL tiles within a rolling window
   * (default 30 days). Behind the same `network_feed` flag.
   *
   * Nested as `spread: { list }` to group future spread-only
   * procedures (e.g. per-tile detail fetch with full occurrence
   * timeline) without polluting the top-level surface.
   */
  spread: router({
    list: publicProcedure.input(networkSpreadListSchema).query(async ({ input }) => {
      await assertFlagEnabled();
      return listNetworkSpread(input);
    }),
  }),
});
