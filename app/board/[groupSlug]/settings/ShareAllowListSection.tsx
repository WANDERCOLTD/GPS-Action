'use client';

/**
 * @build-unit bu-coord-board-share-allowlist-ui
 * @spec docs/build/session-briefs/bu-coord-board-share-allowlist-ui.md
 *
 * Share-with-team allow-list editor. Two sub-sections:
 *
 *   - Allowed targets: the current GroupShareWorkflow rows. Each has
 *     a Remove button → removeWorkflowAction → revalidatePath.
 *   - Add target: a <select> of pickable groups + an Add button →
 *     addWorkflowAction → revalidatePath.
 *
 * Inline error rendering on action failure; transitions disable
 * controls during in-flight requests.
 */

import { useState, useTransition } from 'react';
import { addWorkflowAction, removeWorkflowAction } from './actions';

export interface AllowedTarget {
  groupId: string;
  displayName: string;
  slug: string;
  /** ISO timestamp of when this row was added. */
  addedAt: string;
}

export interface AddableTarget {
  groupId: string;
  displayName: string;
  slug: string;
}

export interface ShareAllowListSectionProps {
  sourceGroupId: string;
  groupSlug: string;
  allowedTargets: AllowedTarget[];
  addableTargets: AddableTarget[];
}

export function ShareAllowListSection({
  sourceGroupId,
  groupSlug,
  allowedTargets,
  addableTargets,
}: ShareAllowListSectionProps) {
  const [pendingAdd, startAdd] = useTransition();
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    addableTargets[0]?.groupId ?? '',
  );

  const onAdd = (): void => {
    if (!selectedTargetId) return;
    setError(null);
    startAdd(async () => {
      const result = await addWorkflowAction({
        sourceGroupId,
        targetGroupId: selectedTargetId,
        groupSlug,
      });
      if (!result.ok) {
        setError(result.error ?? 'Could not add target.');
      }
    });
  };

  const onRemove = (targetGroupId: string): void => {
    setError(null);
    setPendingRemoveId(targetGroupId);
    void (async () => {
      const result = await removeWorkflowAction({
        sourceGroupId,
        targetGroupId,
        groupSlug,
      });
      if (!result.ok) {
        setError(result.error ?? 'Could not remove target.');
      }
      setPendingRemoveId(null);
    })();
  };

  return (
    <section
      data-testid="board-settings-share-allow-list"
      aria-label="Share allow-list"
      style={{ marginBottom: 'var(--space-5)' }}
    >
      <h2
        style={{
          margin: '0 0 var(--space-2) 0',
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: 'var(--colour-text-primary)',
        }}
      >
        Share allow-list
      </h2>
      <p
        style={{
          margin: '0 0 var(--space-3) 0',
          fontSize: 'var(--text-sm)',
          color: 'var(--colour-text-secondary)',
        }}
      >
        Members of this group can share tickets to any group on this list. Other groups don&apos;t
        appear in the share picker until you add them here.
      </p>

      {error !== null && (
        <p
          data-testid="board-settings-share-allow-list-error"
          role="alert"
          style={{
            marginBottom: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--colour-surface-error-subtle)',
            color: 'var(--colour-text-error)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {error}
        </p>
      )}

      <h3
        style={{
          margin: '0 0 var(--space-2) 0',
          fontSize: 'var(--text-xs)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--colour-text-secondary)',
        }}
      >
        Allowed targets
      </h3>
      {allowedTargets.length === 0 ? (
        <p
          data-testid="board-settings-share-allow-list-empty"
          style={{
            margin: '0 0 var(--space-4) 0',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-secondary)',
          }}
        >
          No allow-list yet — pick a target below to start.
        </p>
      ) : (
        <ul
          data-testid="board-settings-share-allow-list-rows"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 0 var(--space-4) 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          {allowedTargets.map((t) => (
            <li
              key={t.groupId}
              data-testid="board-settings-share-allow-list-row"
              data-target-group-id={t.groupId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--colour-surface-raised)',
                border: '1px solid var(--colour-border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span style={{ fontSize: 'var(--text-sm)' }}>{t.displayName}</span>
              <button
                type="button"
                data-testid="board-settings-share-allow-list-remove"
                onClick={() => onRemove(t.groupId)}
                disabled={pendingRemoveId === t.groupId}
                style={{
                  padding: '4px 10px',
                  background: 'transparent',
                  border: '1px solid var(--colour-border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--colour-text-link)',
                  fontSize: 'var(--text-sm)',
                  cursor: pendingRemoveId === t.groupId ? 'not-allowed' : 'pointer',
                  opacity: pendingRemoveId === t.groupId ? 0.6 : 1,
                }}
              >
                {pendingRemoveId === t.groupId ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3
        style={{
          margin: '0 0 var(--space-2) 0',
          fontSize: 'var(--text-xs)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--colour-text-secondary)',
        }}
      >
        Add target
      </h3>
      {addableTargets.length === 0 ? (
        <p
          data-testid="board-settings-share-allow-list-no-addable"
          style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-secondary)',
          }}
        >
          All other groups are already on the allow-list.
        </p>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <select
            data-testid="board-settings-share-allow-list-add-select"
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value)}
            disabled={pendingAdd}
            style={{
              flex: 1,
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--colour-border-subtle)',
              fontSize: 'var(--text-sm)',
              background: 'var(--colour-surface-raised)',
            }}
          >
            {addableTargets.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.displayName}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="board-settings-share-allow-list-add"
            onClick={onAdd}
            disabled={pendingAdd || !selectedTargetId}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--colour-surface-action)',
              color: 'var(--colour-text-on-action)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-sm)',
              cursor: pendingAdd ? 'not-allowed' : 'pointer',
              opacity: pendingAdd ? 0.6 : 1,
            }}
          >
            {pendingAdd ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
    </section>
  );
}
