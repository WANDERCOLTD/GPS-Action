/**
 * @build-unit BU-admin-crud
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-crud.md
 *
 * Confirmation-protected row mutation button. Calls the shared
 * `adminDeleteAction` server action with the appropriate mode:
 *
 * - `soft` → soft-delete; standard "Are you sure?" confirm
 * - `restore` → clears `deletedAt`; standard confirm
 * - `hard` → typed-confirmation modal ("type DELETE") per Q5
 *
 * The component is generic (no entity-specific code) and is mounted
 * inline on the EntityDetailPage.
 */

'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminDeleteAction } from '@/app/data/[entity]/actions';

type Mode = 'soft' | 'restore' | 'hard';

interface RowMutationButtonProps {
  readonly entity: string;
  readonly id: string;
  readonly mode: Mode;
}

const COPY: Record<
  Mode,
  { label: string; confirm: string; description: string; tone: 'danger' | 'neutral' }
> = {
  soft: {
    label: 'Delete',
    confirm: 'Soft-delete this row? It can be restored from the detail page.',
    description: 'Soft-delete — recoverable',
    tone: 'danger',
  },
  restore: {
    label: 'Restore',
    confirm: 'Restore this row to active state?',
    description: 'Restore from soft-delete',
    tone: 'neutral',
  },
  hard: {
    label: 'Hard delete',
    confirm: 'Type DELETE in the next prompt to confirm. This cannot be undone.',
    description: 'Hard-delete — cannot be undone',
    tone: 'danger',
  },
};

export function RowMutationButton({ entity, id, mode }: RowMutationButtonProps) {
  const router = useRouter();
  const labelId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[mode];

  const handleClick = () => {
    if (!confirm(copy.confirm)) return;
    if (mode === 'hard') {
      const typed = prompt('Type DELETE to confirm. This cannot be undone.');
      if (typed !== 'DELETE') {
        setError('Hard-delete cancelled — confirmation phrase did not match.');
        return;
      }
    }
    setError(null);
    startTransition(async () => {
      const result = await adminDeleteAction(entity, id, mode);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  const tokens = {
    danger: {
      bg: 'var(--colour-danger-subtle)',
      fg: 'var(--colour-danger)',
      border: 'var(--colour-danger)',
    },
    neutral: {
      bg: 'var(--colour-surface-raised)',
      fg: 'var(--colour-text-primary)',
      border: 'var(--colour-border-strong)',
    },
  } as const;
  const t = tokens[copy.tone];

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-describedby={labelId}
        data-testid="admin-detail-mutation-button"
        data-mutation-mode={mode}
        style={{
          padding: 'var(--space-2) var(--space-4)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-medium)',
          color: t.fg,
          background: t.bg,
          border: `1px solid ${t.border}`,
          borderRadius: 'var(--radius-sm)',
          cursor: pending ? 'wait' : 'pointer',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? 'Working…' : copy.label}
      </button>
      <span
        id={labelId}
        style={{ fontSize: 'var(--text-xs)', color: 'var(--colour-text-secondary)' }}
      >
        {copy.description}
      </span>
      {error ? (
        <span
          role="alert"
          data-testid="admin-detail-mutation-error"
          data-mutation-mode={mode}
          style={{ fontSize: 'var(--text-xs)', color: 'var(--colour-danger)' }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
