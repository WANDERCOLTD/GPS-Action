/**
 * @build-unit BU-admin-bulk-ops
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-bulk-ops.md
 *
 * Inline banner shown after a bulk action completes. Reports
 * `succeeded` count and lists `failed` ids with their messages.
 *
 * Persists until admin dismisses, navigates, or runs another bulk
 * action (Q5 locked) — don't auto-dismiss; admin needs to see what
 * failed.
 */

'use client';

import { useBulkSelection } from '@/components/admin/BulkSelector';

export function BulkResultBanner() {
  const { result, dismissResult } = useBulkSelection();
  if (!result) return null;
  const allSucceeded = result.failed.length === 0;
  const allFailed = result.succeeded === 0 && result.failed.length > 0;

  const tone = allSucceeded ? 'success' : allFailed ? 'danger' : 'warning';
  const tokens = {
    success: {
      bg: 'var(--colour-success-subtle)',
      border: 'var(--colour-success)',
    },
    danger: {
      bg: 'var(--colour-danger-subtle)',
      border: 'var(--colour-danger)',
    },
    warning: {
      bg: 'var(--colour-warning-subtle)',
      border: 'var(--colour-warning)',
    },
  } as const;
  const t = tokens[tone];

  return (
    <div
      role="status"
      data-testid="admin-bulk-result-banner"
      data-tone={tone}
      style={{
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-4)',
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--text-sm)',
        color: 'var(--colour-text-primary)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 'var(--space-3)',
        }}
      >
        <div>
          <p style={{ margin: 0, fontWeight: 'var(--weight-medium)' }}>
            {allSucceeded
              ? `${result.succeeded} ${result.succeeded === 1 ? 'row' : 'rows'} processed.`
              : allFailed
                ? `Could not process ${result.failed.length} ${result.failed.length === 1 ? 'row' : 'rows'}.`
                : `${result.succeeded} succeeded · ${result.failed.length} failed.`}
          </p>
          {result.failed.length > 0 ? (
            <ul
              data-testid="admin-bulk-result-failed-list"
              style={{
                margin: 'var(--space-2) 0 0',
                padding: '0 0 0 var(--space-5)',
                fontSize: 'var(--text-xs)',
                color: 'var(--colour-text-secondary)',
              }}
            >
              {result.failed.map((f) => (
                <li
                  key={f.id}
                  data-testid="admin-bulk-result-failed-row"
                  data-row-id={f.id}
                  style={{ wordBreak: 'break-all' }}
                >
                  <code style={{ fontFamily: 'var(--font-mono)' }}>{f.id}</code> — {f.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismissResult}
          data-testid="admin-bulk-result-dismiss"
          aria-label="Dismiss"
          style={{
            padding: 'var(--space-1) var(--space-2)',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
