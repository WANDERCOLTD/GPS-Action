/**
 * @build-unit BU-keyboard-shortcuts
 * @spec build/session-briefs/bu-keyboard-shortcuts.md
 *
 * Single source of truth for keyboard bindings. Both
 * `KeyboardShortcuts` (the listener) and `ShortcutHelp` (the help
 * overlay) read from this file so the rendered help can never drift
 * from what the listener actually does.
 *
 * Three binding shapes:
 *   - `sequence`:   two keys typed in order ("g" then a letter)
 *   - `single`:     one bare key
 *   - `contextual`: documentation-only — keys handled inside a
 *                   specific input/widget, not by the global listener
 *                   (e.g. Cmd+Enter inside the ticket editor). Listed
 *                   in the help overlay so members can discover them.
 *
 * For `sequence` and `single`: the destination is either a route
 * string (`router.push(href)`), the literal `'help'` (opens the help
 * overlay), or an `eventName` (the listener dispatches a
 * `CustomEvent` on `window` for a peer component to handle —
 * non-navigation toggles).
 *
 * Notes that may belong on a binding row are kept inline so the
 * help overlay can render them as small dimmer text.
 */

export interface SequenceBinding {
  kind: 'sequence';
  /** First key in the sequence — always lower-case. */
  prefix: string;
  /** Second key in the sequence — always lower-case. */
  key: string;
  /**
   * Where to go OR what event to dispatch. Exactly one is required.
   *
   * - `href`: the listener calls `router.push(href)`.
   * - `eventName`: the listener dispatches `new CustomEvent(eventName)`
   *   on `window`. Peer components subscribe (e.g. DevBannerToggle
   *   listens for `gps:toggle-dev-banner`).
   */
  href?: string;
  eventName?: string;
  /** Display label (the destination's user-facing name). */
  label: string;
  /** Optional dimmer subtext shown in the help overlay. */
  note?: string;
}

export interface SingleBinding {
  kind: 'single';
  /** The bare key — exact `event.key` value, not lower-cased. */
  key: string;
  /** Where to go, or `'help'` to open the help overlay. */
  action: string | 'help';
  /** Display label. */
  label: string;
  /** Optional dimmer subtext. */
  note?: string;
}

/**
 * Documentation-only entry for shortcuts handled inside a specific
 * widget (not by the global listener). The help overlay renders
 * `macKeys` on Apple platforms and `pcKeys` elsewhere; the resolver
 * ignores `contextual` bindings entirely.
 */
export interface ContextualBinding {
  kind: 'contextual';
  /** Mac display (e.g. "⌘ Enter"). Tokens separated by spaces. */
  macKeys: string;
  /** Non-Mac display (e.g. "Ctrl Enter"). */
  pcKeys: string;
  /** Display label. */
  label: string;
  /** Optional dimmer subtext. */
  note?: string;
}

export type ShortcutBinding = SequenceBinding | SingleBinding | ContextualBinding;

/**
 * Locked binding registry. Order here is the order the help overlay
 * renders. Keep route bindings together, then single-key actions.
 */
/** Event name for the dev banner toggle dispatched on `g u`. */
export const TOGGLE_DEV_BANNER_EVENT = 'gps:toggle-dev-banner';

export const SHORTCUT_BINDINGS: ReadonlyArray<ShortcutBinding> = [
  { kind: 'sequence', prefix: 'g', key: 'n', href: '/network', label: 'Network' },
  { kind: 'sequence', prefix: 'g', key: 'f', href: '/feed', label: 'Feed' },
  { kind: 'sequence', prefix: 'g', key: 'b', href: '/board', label: 'Board' },
  { kind: 'sequence', prefix: 'g', key: 'c', href: '/calendar', label: 'Calendar' },
  {
    kind: 'sequence',
    prefix: 'g',
    key: 'r',
    href: '/requests',
    label: 'Requests',
    note: 'or /notifications when coord_board_v1 is on',
  },
  { kind: 'sequence', prefix: 'g', key: 's', href: '/settings', label: 'Settings' },
  {
    kind: 'sequence',
    prefix: 'g',
    key: 'u',
    eventName: TOGGLE_DEV_BANNER_EVENT,
    label: 'Show/hide dev banner',
    note: 'dev/demo only',
  },
  { kind: 'single', key: '/', action: '/search', label: 'Search' },
  { kind: 'single', key: 'c', action: '/compose', label: 'Compose post' },
  { kind: 'single', key: '?', action: 'help', label: 'Show this help' },
  {
    kind: 'contextual',
    macKeys: '⌘ Enter',
    pcKeys: 'Ctrl Enter',
    label: 'Save edit · Post comment',
    note: 'while editing a ticket or composing a comment',
  },
];

/** Window in milliseconds that the second key of a sequence must land. */
export const SEQUENCE_TIMEOUT_MS = 1500;

// ── Pure resolver ─────────────────────────────────────────────────────────
//
// The DOM listener (`KeyboardShortcuts`) is a thin wrapper around this
// resolver. Keeping the state machine pure means it can be tested
// without faking a document/keyboard.

export interface SequenceState {
  prefix: string;
  expiresAt: number;
}

export type ResolveOutcome =
  | { kind: 'navigate'; href: string }
  | { kind: 'help' }
  | { kind: 'event'; eventName: string }
  | { kind: 'arm-sequence'; prefix: string; expiresAt: number }
  | { kind: 'noop' };

export interface ResolveInput {
  /** The raw event.key value. */
  key: string;
  /** Current sequence state, if any. */
  sequence: SequenceState | null;
  /** Current time in epoch ms (allow injection so tests don't need to mock Date.now). */
  now: number;
}

/**
 * Resolve a single keydown into the action the listener should take.
 * Pure: same input → same output, no side effects, no DOM.
 *
 * Caller is responsible for the inertness checks (typing target /
 * modifier keys / defaultPrevented) — those are DOM-shaped and live
 * in the React component.
 */
export function resolveKey(input: ResolveInput): ResolveOutcome {
  const { key, sequence, now } = input;
  const seqLive = sequence !== null && sequence.expiresAt > now;

  // Single-key bindings only fire when no sequence is mid-flight.
  // Otherwise typing `g c` would trigger both the `g` arming and
  // then the single `c` for compose, instead of `g c` → /calendar.
  if (!seqLive) {
    const single = SHORTCUT_BINDINGS.find(
      (b): b is Extract<ShortcutBinding, { kind: 'single' }> =>
        b.kind === 'single' && b.key === key,
    );
    if (single) {
      return single.action === 'help'
        ? { kind: 'help' }
        : { kind: 'navigate', href: single.action };
    }
  }

  if (seqLive && sequence) {
    const lower = key.toLowerCase();
    const binding = SHORTCUT_BINDINGS.find(
      (b): b is Extract<ShortcutBinding, { kind: 'sequence' }> =>
        b.kind === 'sequence' && b.prefix === sequence.prefix && b.key === lower,
    );
    if (!binding) return { kind: 'noop' };
    if (binding.eventName) return { kind: 'event', eventName: binding.eventName };
    if (binding.href) return { kind: 'navigate', href: binding.href };
    return { kind: 'noop' };
  }

  const lower = key.toLowerCase();
  const isPrefix = SHORTCUT_BINDINGS.some((b) => b.kind === 'sequence' && b.prefix === lower);
  if (isPrefix) {
    return { kind: 'arm-sequence', prefix: lower, expiresAt: now + SEQUENCE_TIMEOUT_MS };
  }

  return { kind: 'noop' };
}
