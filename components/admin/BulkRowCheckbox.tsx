/**
 * @build-unit BU-admin-bulk-ops
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-bulk-ops.md
 *
 * Per-row checkbox in the admin list table. Reads + writes
 * selection state via the BulkSelector context.
 *
 * Hidden when the caller can't edit (selection is moot).
 */

'use client';

import { useBulkSelection } from '@/components/admin/BulkSelector';

interface BulkRowCheckboxProps {
  readonly id: string;
}

export function BulkRowCheckbox({ id }: BulkRowCheckboxProps) {
  const { selected, toggle, canEdit } = useBulkSelection();
  if (!canEdit) return null;
  const isChecked = selected.has(id);
  return (
    <input
      type="checkbox"
      checked={isChecked}
      onChange={() => toggle(id)}
      data-testid="admin-bulk-row-checkbox"
      data-row-id={id}
      aria-label={isChecked ? 'Deselect row' : 'Select row'}
    />
  );
}

interface BulkSelectAllCheckboxProps {
  readonly visibleIds: ReadonlyArray<string>;
}

export function BulkSelectAllCheckbox({ visibleIds }: BulkSelectAllCheckboxProps) {
  const { selected, selectMany, canEdit } = useBulkSelection();
  if (!canEdit) return null;
  const total = visibleIds.length;
  const selectedCount = visibleIds.filter((id) => selected.has(id)).length;
  const isChecked = total > 0 && selectedCount === total;
  const isIndeterminate = selectedCount > 0 && selectedCount < total;
  return (
    <input
      type="checkbox"
      checked={isChecked}
      ref={(el) => {
        if (el) el.indeterminate = isIndeterminate;
      }}
      onChange={() => selectMany(visibleIds)}
      data-testid="admin-bulk-select-all-checkbox"
      aria-label={isChecked ? 'Deselect all visible rows' : 'Select all visible rows'}
      title="Select all visible rows"
    />
  );
}
