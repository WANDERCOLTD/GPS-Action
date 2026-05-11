'use client';

/**
 * @build-unit BU-keyboard-shortcuts
 * @spec build/session-briefs/bu-keyboard-shortcuts.md
 *
 * Global keyboard listener. Mounted once in the root layout when a
 * user is signed in. Reads its bindings from `shared/shortcuts.ts`
 * so the help overlay can never drift from the actual behaviour.
 *
 * The state machine is the pure `resolveKey` function in
 * `shared/shortcuts.ts`. This component is a thin DOM wrapper:
 * inertness checks (typing target / modifier keys / defaultPrevented),
 * sequence-state ref, and effect dispatch.
 *
 * Inertness rules — bindings do NOT fire when:
 *   - target is INPUT, TEXTAREA, SELECT, or contenteditable
 *   - any modifier key is held (except Shift, which is needed for
 *     `?` since `?` = Shift+`/` on most layouts)
 *   - event was already handled by something else (defaultPrevented)
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ShortcutHelp } from '@/components/ShortcutHelp';
import { resolveKey, type SequenceState } from '@/shared/shortcuts';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function KeyboardShortcuts(): React.ReactElement {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = React.useState(false);

  // Sequence state held in a ref so the keydown handler always sees
  // the current value without re-binding the listener every render.
  const sequenceRef = React.useRef<SequenceState | null>(null);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.defaultPrevented) return;
      // Esc closes the help overlay regardless of typing target —
      // a stuck modal blocking text input would be worse than the
      // tiny ergonomics cost of intercepting Esc inside fields.
      if (event.key === 'Escape') {
        setHelpOpen((open) => {
          if (!open) return open;
          event.preventDefault();
          return false;
        });
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const outcome = resolveKey({
        key: event.key,
        sequence: sequenceRef.current,
        now: Date.now(),
      });

      switch (outcome.kind) {
        case 'navigate':
          event.preventDefault();
          sequenceRef.current = null;
          router.push(outcome.href);
          return;
        case 'help':
          event.preventDefault();
          sequenceRef.current = null;
          setHelpOpen((open) => !open);
          return;
        case 'event':
          // Non-navigation action — dispatch a CustomEvent on `window`
          // so a peer component (e.g. DevBannerToggle) can subscribe.
          // Keeps the registry the single source of truth for both
          // routes AND toggle-style actions.
          event.preventDefault();
          sequenceRef.current = null;
          window.dispatchEvent(new CustomEvent(outcome.eventName));
          return;
        case 'arm-sequence':
          sequenceRef.current = { prefix: outcome.prefix, expiresAt: outcome.expiresAt };
          return;
        case 'noop':
          // If we were mid-sequence, the resolver consumed the live
          // state — clear it so a stale prefix doesn't linger.
          if (sequenceRef.current && sequenceRef.current.expiresAt > Date.now()) {
            sequenceRef.current = null;
          }
          return;
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [router]);

  return <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />;
}
