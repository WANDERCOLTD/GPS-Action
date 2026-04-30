'use client';

/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Compact "Saved · 2s ago" indicator that lives in the compose form's
 * header. Three honest states (D072 §8 — never claim "Saved" when a
 * save hasn't actually succeeded):
 *
 *   - editing — the form has unsaved keystrokes
 *   - saved   — last server-promoted save succeeded
 *   - failed  — last save failed; "Retry" is offered
 *
 * Tap reveals a tiny menu with two actions:
 *   - "View all drafts" — Phase 2 placeholder; rendered disabled until
 *     `BU-drafts-inbox` ships
 *   - "Discard draft" — opens the parent's confirm sheet via
 *     `onDiscardClick`
 *
 * The indicator itself is presentational: state and timestamps come
 * from the autosave hook (next commit). It owns its menu open/closed
 * state only.
 */

import { useState, type CSSProperties, type ReactElement } from 'react';

export type DraftSavedState = 'editing' | 'saved' | 'failed';

interface DraftSavedIndicatorProps {
  readonly state: DraftSavedState;
  /** When `state === 'saved'`, the timestamp shown as "Saved · 2s ago". */
  readonly lastSavedAt?: Date | null;
  readonly onRetry?: () => void | Promise<void>;
  readonly onDiscardClick: () => void;
  /** When provided, renders the View-all-drafts menu item enabled with this href. */
  readonly viewDraftsHref?: string;
  /** Override "now" for deterministic relative-time rendering in tests. */
  readonly now?: Date;
}

export function DraftSavedIndicator({
  state,
  lastSavedAt,
  onRetry,
  onDiscardClick,
  viewDraftsHref,
  now,
}: DraftSavedIndicatorProps): ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);

  const label = renderLabel(state, lastSavedAt, now ?? new Date());

  return (
    <div data-testid="compose-draft-saved-indicator" data-state={state} style={containerStyle}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        data-testid="compose-draft-saved-indicator-toggle"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Draft options"
        style={triggerStyle}
      >
        <span data-testid="compose-draft-saved-indicator-label" style={labelStyle(state)}>
          {label}
        </span>
        {state === 'failed' && onRetry ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void Promise.resolve(onRetry());
            }}
            data-testid="compose-draft-saved-indicator-retry"
            className="gps-btn gps-btn--ghost"
            style={retryStyle}
          >
            Retry
          </button>
        ) : null}
      </button>

      {menuOpen ? (
        <div role="menu" data-testid="compose-draft-saved-indicator-menu" style={menuStyle}>
          <a
            role="menuitem"
            href={viewDraftsHref ?? '#'}
            aria-disabled={viewDraftsHref ? undefined : 'true'}
            data-testid="compose-draft-saved-indicator-view-all"
            data-disabled={viewDraftsHref ? 'false' : 'true'}
            style={menuItemStyle(!viewDraftsHref)}
            onClick={(e) => {
              if (!viewDraftsHref) {
                e.preventDefault();
                return;
              }
              setMenuOpen(false);
            }}
          >
            View all drafts
          </a>
          <button
            type="button"
            role="menuitem"
            data-testid="compose-draft-saved-indicator-discard"
            onClick={() => {
              setMenuOpen(false);
              onDiscardClick();
            }}
            style={menuItemStyle(false)}
            className="gps-btn gps-btn--ghost"
          >
            Discard draft
          </button>
        </div>
      ) : null}
    </div>
  );
}

function renderLabel(
  state: DraftSavedState,
  lastSavedAt: Date | null | undefined,
  now: Date,
): string {
  if (state === 'editing') return 'Editing…';
  if (state === 'failed') return "Couldn't save";
  if (!lastSavedAt) return 'Saved';
  return `Saved · ${formatRelativeShort(lastSavedAt, now)}`;
}

function formatRelativeShort(at: Date, now: Date): string {
  const deltaSec = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const deltaMin = Math.round(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.round(deltaMin / 60);
  return `${deltaHr}h ago`;
}

const containerStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  fontFamily: 'var(--font-ui)',
};

const triggerStyle: CSSProperties = {
  background: 'transparent',
  border: 0,
  padding: 'var(--space-1) var(--space-2)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  cursor: 'pointer',
};

function labelStyle(state: DraftSavedState): CSSProperties {
  return {
    fontSize: 'var(--text-xs)',
    color:
      state === 'failed'
        ? 'var(--colour-danger)'
        : state === 'editing'
          ? 'var(--colour-text-secondary)'
          : 'var(--colour-text-tertiary)',
    fontWeight: 500,
  };
}

const retryStyle: CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  padding: '2px var(--space-2)',
};

const menuStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + var(--space-1))',
  right: 0,
  minWidth: '12rem',
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-1) 0',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 'var(--z-popover)' as unknown as number,
  boxShadow: '0 4px 12px color-mix(in srgb, var(--colour-text-primary) 12%, transparent)',
};

function menuItemStyle(disabled: boolean): CSSProperties {
  return {
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--text-sm)',
    color: disabled ? 'var(--colour-text-disabled)' : 'var(--colour-text-primary)',
    background: 'transparent',
    border: 0,
    textDecoration: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
  };
}
