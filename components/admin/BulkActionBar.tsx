/**
 * @build-unit BU-admin-bulk-ops
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-bulk-ops.md
 *
 * Sticky-bottom bar shown when ≥1 row is selected. Renders the
 * selected count + a dropdown of available bulk actions per
 * metadata's `bulkActions`. Hidden when no rows are selected.
 */

'use client';

import { useState } from 'react';
import { labelFor, useBulkSelection, type BulkVerb } from '@/components/admin/BulkSelector';

export function BulkActionBar() {
  const { selected, availableActions, run, pending, clear, canEdit } = useBulkSelection();
  const [verb, setVerb] = useState<BulkVerb | ''>('');

  if (!canEdit) return null;
  const count = selected.size;
  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      data-testid="admin-bulk-action-bar"
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 'var(--z-raised)',
        marginTop: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--colour-surface-raised)',
        borderTop: '1px solid var(--colour-border-strong)',
        boxShadow: 'var(--shadow-md)',
        borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
        display: 'flex',
        gap: 'var(--space-3)',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <span
        data-testid="admin-bulk-action-count"
        style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}
      >
        {count} {count === 1 ? 'row' : 'rows'} selected
      </span>

      <div style={{ flex: 1 }} />

      <select
        value={verb}
        onChange={(e) => setVerb(e.target.value as BulkVerb | '')}
        disabled={pending}
        data-testid="admin-bulk-action-menu"
        aria-label="Choose bulk action"
        style={{
          padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-ui)',
          color: 'var(--colour-text-primary)',
          background: 'var(--colour-surface-sunken)',
          border: '1px solid var(--colour-border-strong)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <option value="">Choose action…</option>
        {availableActions.map((v) => (
          <option key={v} value={v}>
            {labelFor(v)}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={!verb || pending}
        onClick={() => {
          if (verb) run(verb);
        }}
        data-testid="admin-bulk-action-submit"
        style={{
          padding: 'var(--space-2) var(--space-4)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-medium)',
          color: 'var(--colour-primary-contrast)',
          background: verb && !pending ? 'var(--colour-primary)' : 'var(--colour-text-disabled)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: verb && !pending ? 'pointer' : 'not-allowed',
        }}
      >
        {pending ? 'Working…' : 'Apply'}
      </button>

      <button
        type="button"
        onClick={clear}
        disabled={pending}
        data-testid="admin-bulk-action-clear"
        aria-label="Clear selection"
        style={{
          padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--text-sm)',
          color: 'var(--colour-text-secondary)',
          background: 'transparent',
          border: '1px solid var(--colour-border-subtle)',
          borderRadius: 'var(--radius-sm)',
          cursor: pending ? 'not-allowed' : 'pointer',
        }}
      >
        Clear
      </button>
    </div>
  );
}
