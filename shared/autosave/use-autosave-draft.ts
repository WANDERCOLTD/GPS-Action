'use client';

/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * React hook for draft autosave to the IndexedDB cache. Phase 1
 * ships only the client-side layer per D072 §8 stage 1 — debounced
 * writes on every change, hydration on mount, an honest state
 * machine for the indicator. Stages 2 (server-promote) and 3
 * (server-only autosave) land in `bu-drafts-inbox` (Phase 2) once
 * the recall surface exists.
 *
 * Contract:
 *   - `value` is the form's current state (any JSON-serialisable shape)
 *   - On mount, we read the cache; the caller hydrates its own state
 *     via the returned `hydrated` value (null when no draft cached)
 *   - On `value` change, we debounce writes by `debounceMs` (default
 *     500ms per D072 §8) and update `state` to 'saved' on success or
 *     'failed' on a write error
 *   - The caller calls `clear()` after a successful publish so a
 *     reload doesn't restore an obsolete draft
 *
 * The caller decides whether to render `<DraftSavedIndicator>` from
 * the returned state — the hook does not own UI.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { autosaveCacheDelete, autosaveCacheGet, autosaveCacheSet } from './indexeddb-cache';

export type AutosaveStatus = 'idle' | 'editing' | 'saved' | 'failed';

export interface UseAutosaveDraftResult<T> {
  /** null until hydration completes; the cached value when present. */
  readonly hydrated: T | null;
  /** True when the initial cache read has resolved (regardless of hit/miss). */
  readonly hasHydrated: boolean;
  readonly status: AutosaveStatus;
  readonly lastSavedAt: Date | null;
  /** Caller invokes after a successful publish/discard to drop the cached draft. */
  readonly clear: () => Promise<void>;
}

interface UseAutosaveDraftInput<T> {
  /** Stable cache key. The caller picks one (e.g. `compose-draft-current`). */
  readonly key: string;
  /** The form's current state. Pass a stable reference per render. */
  readonly value: T;
  /**
   * When false, the hook neither hydrates nor writes — used to suspend
   * autosave entirely (e.g. while a publish action is in flight).
   */
  readonly enabled?: boolean;
  /** Debounce window for writes. Default 500ms per D072 §8 stage 1. */
  readonly debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 500;

export function useAutosaveDraft<T>(input: UseAutosaveDraftInput<T>): UseAutosaveDraftResult<T> {
  const enabled = input.enabled ?? true;
  const debounceMs = input.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  const [hydrated, setHydrated] = useState<T | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWrittenJsonRef = useRef<string | null>(null);

  // Hydrate once on mount. Subsequent key changes intentionally do not
  // re-hydrate — the caller manages keys at construction time.
  useEffect(() => {
    if (!enabled) {
      setHasHydrated(true);
      return;
    }
    let cancelled = false;
    void autosaveCacheGet<T>(input.key).then((cached) => {
      if (cancelled) return;
      if (cached !== null) {
        setHydrated(cached);
        // Treat a hydrated cache as the latest saved state — the user
        // hasn't typed yet, so 'saved' is honest.
        lastWrittenJsonRef.current = JSON.stringify(cached);
        setStatus('saved');
        setLastSavedAt(new Date());
      }
      setHasHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced write on value change.
  useEffect(() => {
    if (!enabled || !hasHydrated) return;
    const json = JSON.stringify(input.value);
    if (json === lastWrittenJsonRef.current) return;

    setStatus('editing');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void (async () => {
        const ok = await autosaveCacheSet(input.key, input.value);
        if (ok) {
          lastWrittenJsonRef.current = json;
          setStatus('saved');
          setLastSavedAt(new Date());
        } else {
          setStatus('failed');
        }
      })();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, hasHydrated, input.key, input.value, debounceMs]);

  const clear = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await autosaveCacheDelete(input.key);
    lastWrittenJsonRef.current = null;
    setStatus('idle');
    setLastSavedAt(null);
  }, [input.key]);

  return { hydrated, hasHydrated, status, lastSavedAt, clear };
}
