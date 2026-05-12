/**
 * @build-unit bu-page-header-system
 * @spec docs/build/session-briefs/bu-page-header-system.md
 *
 * Reusable page-level header. Title (h1) + optional one-line
 * description + optional actions slot. Sticks under the AppNav.
 *
 * Sticky offset comes from a CSS variable `--app-nav-height` set on
 * the document by `HeaderShell` (measures the actual rendered nav
 * height). When `HeaderShell` toggles `body.nav-hidden` on
 * sustained scroll-down, the same hook collapses `--app-nav-height` to
 * 0px so PageHeader naturally rises into the freed space.
 *
 * Renders as a server component — no client JS needed. All sticky +
 * collapse behaviour is CSS-driven.
 *
 * F14 testids: page-header, page-header-title, page-header-description,
 * page-header-actions.
 */

import type { CSSProperties, ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

const wrapperStyle: CSSProperties = {
  position: 'sticky',
  top: 'var(--app-nav-height, 56px)',
  zIndex: 40,
  background: 'var(--colour-surface-raised)',
  borderBottom: '1px solid var(--colour-border-subtle)',
  padding: 'var(--space-3) var(--space-4)',
  transition: 'top 180ms ease',
};

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
};

const titleColStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-2xl)',
  fontWeight: 'var(--weight-bold)',
  color: 'var(--colour-text-primary)',
  lineHeight: 'var(--line-tight)',
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  marginTop: 'var(--space-1)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-text-secondary)',
  lineHeight: 'var(--line-normal)',
};

const actionsStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header data-testid="page-header" style={wrapperStyle}>
      <div style={titleRowStyle}>
        <div style={titleColStyle}>
          <h1 data-testid="page-header-title" style={titleStyle}>
            {title}
          </h1>
          {description && (
            <p data-testid="page-header-description" style={descriptionStyle}>
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div data-testid="page-header-actions" style={actionsStyle}>
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
