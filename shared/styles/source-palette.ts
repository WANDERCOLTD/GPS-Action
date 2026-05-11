/**
 * @build-unit bu-network-source-chips
 *
 * Per-source colour overrides for the chip strip + card meta dot on
 * `/network`. Grant's `gps_chat_labels` view ships a `color` column as
 * a starter value; this map is the on-our-side override that aligns
 * each known source with a token from `styles/tokens.css`. Sources
 * not in this map render with Grant's `color` value verbatim (or a
 * neutral fallback if that's also null).
 *
 * Voice/tone consequence (per Grant Round 2): GPS Action Network!'s
 * starter `#3fb950` is a GitHub-success green that doesn't read as
 * "primary network" in our token palette. We override here without
 * needing Grant to coordinate.
 *
 * Lives in `shared/` so both server (NetworkCard meta row) and
 * client (chip strip) consume the same map without a layer-boundary
 * dance.
 */

/**
 * Map of `slug` → CSS colour expression (token reference or hex).
 * Add a new slug when a source warrants a deliberate visual identity;
 * sources without an entry fall back to Grant's `color` then to a
 * neutral.
 */
export const SOURCE_PALETTE: Readonly<Record<string, string>> = Object.freeze({
  'gps-action-network': 'var(--colour-primary)',
  // GPS Network ✅ or ❌ — verdict chat (Grant 2026-05-11, 1,096 historical
  // link shares backfilled). Maps to the tick-or-cross filter tone used on
  // /feed (success-green = community-validated). Token chosen to match the
  // existing `gps-chip--success` palette so the chip reads as "approved
  // signal" rather than competing with the urgent / cultural treatments.
  'gps-network-yes-no': 'var(--colour-success)',
  'test-group': 'var(--colour-text-tertiary)',
});

/** Neutral fallback when neither override nor Grant's `color` is available. */
export const SOURCE_PALETTE_FALLBACK = 'var(--colour-text-tertiary)';

interface SourceColourInput {
  slug: string;
  color: string | null;
}

/**
 * Resolve the chip dot / meta dot colour for a source. Override map
 * wins; Grant's `color` is the fallback; neutral is the last resort.
 */
export function getSourceColor(source: SourceColourInput): string {
  const override = SOURCE_PALETTE[source.slug];
  if (override) return override;
  if (source.color) return source.color;
  return SOURCE_PALETTE_FALLBACK;
}
