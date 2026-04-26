/**
 * @build-unit BU-admin-bulk-ops
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-bulk-ops.md
 *
 * Bulk-selection state provider for the admin EntityListPage.
 *
 * Holds the selected-id Set, the in-flight transition state, and
 * the most recent action result (for the banner). State is mirrored
 * to the URL hash (`#sel=id1,id2`) so a refresh preserves selection.
 * URL hash, not search-param, so shareable URLs stay clean.
 *
 * Mounts as a client component wrapping the server-rendered table
 * + bar + banner. Children consume via `useBulkSelection()`.
 */

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';

export interface BulkActionResult {
  readonly succeeded: number;
  readonly failed: ReadonlyArray<{ readonly id: string; readonly message: string }>;
}

export type BulkVerb = 'softDelete' | 'restore' | 'hardDelete' | 'forceRelease';

export type BulkActionFn = (
  verb: BulkVerb,
  ids: ReadonlyArray<string>,
) => Promise<BulkActionResult>;

interface BulkSelectionContextValue {
  readonly selected: ReadonlySet<string>;
  readonly toggle: (id: string) => void;
  readonly selectMany: (ids: ReadonlyArray<string>) => void;
  readonly clear: () => void;
  readonly pending: boolean;
  readonly result: BulkActionResult | null;
  readonly availableActions: ReadonlyArray<BulkVerb>;
  readonly run: (verb: BulkVerb) => void;
  readonly canEdit: boolean;
  readonly entity: string;
  readonly dismissResult: () => void;
}

const Ctx = createContext<BulkSelectionContextValue | null>(null);

export function useBulkSelection(): BulkSelectionContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useBulkSelection() must be used inside <BulkSelector>');
  }
  return ctx;
}

interface BulkSelectorProps {
  readonly entity: string;
  readonly bulkActions: ReadonlyArray<string>;
  readonly canEdit: boolean;
  readonly action: BulkActionFn;
  readonly children: ReactNode;
}

const HASH_PREFIX = 'sel=';

function readHash(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  const raw = window.location.hash.slice(1);
  if (!raw.startsWith(HASH_PREFIX)) return new Set();
  return new Set(raw.slice(HASH_PREFIX.length).split(',').filter(Boolean));
}

function writeHash(ids: ReadonlySet<string>): void {
  if (typeof window === 'undefined') return;
  const list = [...ids];
  if (list.length === 0) {
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return;
  }
  const next = `#${HASH_PREFIX}${list.join(',')}`;
  if (window.location.hash !== next) {
    history.replaceState(null, '', window.location.pathname + window.location.search + next);
  }
}

export function BulkSelector({
  entity,
  bulkActions,
  canEdit,
  action,
  children,
}: BulkSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkActionResult | null>(null);

  // Hydrate from URL hash on mount.
  useEffect(() => {
    setSelected(readHash());
  }, []);

  // Mirror selection to URL hash.
  useEffect(() => {
    writeHash(selected);
  }, [selected]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectMany = useCallback((ids: ReadonlyArray<string>) => {
    setSelected((prev) => {
      // If every id is already selected, deselect them. Otherwise add.
      const all = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (all) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const dismissResult = useCallback(() => {
    setResult(null);
  }, []);

  // Filter the metadata's bulkActions to the typed BulkVerb set.
  const availableActions: ReadonlyArray<BulkVerb> = useMemo(() => {
    const known: ReadonlyArray<BulkVerb> = ['softDelete', 'restore', 'hardDelete', 'forceRelease'];
    return known.filter((v) => bulkActions.includes(v));
  }, [bulkActions]);

  const run = useCallback(
    (verb: BulkVerb) => {
      const ids = [...selected];
      if (ids.length === 0) return;
      // Hard-delete uses a typed-confirmation (per Q5 of BU-admin-crud).
      if (verb === 'hardDelete') {
        const typed = window.prompt(
          `Hard-delete ${ids.length} ${ids.length === 1 ? 'row' : 'rows'}? This cannot be undone. Type DELETE to confirm.`,
        );
        if (typed !== 'DELETE') return;
      } else if (
        !window.confirm(`${labelFor(verb)} ${ids.length} ${ids.length === 1 ? 'row' : 'rows'}?`)
      ) {
        return;
      }
      startTransition(async () => {
        try {
          const r = await action(verb, ids);
          setResult(r);
          // Clear selections that succeeded so the bar dismisses naturally.
          setSelected((prev) => {
            const next = new Set(prev);
            const failedIds = new Set(r.failed.map((f) => f.id));
            for (const id of ids) {
              if (!failedIds.has(id)) next.delete(id);
            }
            return next;
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Bulk action failed.';
          setResult({ succeeded: 0, failed: ids.map((id) => ({ id, message })) });
        }
      });
    },
    [action, selected],
  );

  const value: BulkSelectionContextValue = useMemo(
    () => ({
      selected,
      toggle,
      selectMany,
      clear,
      pending,
      result,
      availableActions,
      run,
      canEdit,
      entity,
      dismissResult,
    }),
    [
      selected,
      toggle,
      selectMany,
      clear,
      pending,
      result,
      availableActions,
      run,
      canEdit,
      entity,
      dismissResult,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function labelFor(verb: BulkVerb): string {
  switch (verb) {
    case 'softDelete':
      return 'Soft-delete';
    case 'restore':
      return 'Restore';
    case 'hardDelete':
      return 'Hard-delete';
    case 'forceRelease':
      return 'Force-release';
  }
}
