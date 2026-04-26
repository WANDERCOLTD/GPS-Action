'use client';

/**
 * @build-unit BU-error-boundary
 * @spec docs/build/phase-0-foundations.md
 * @spec architecture/decision-log.md (D037)
 *
 * Reusable React error boundary. Catches render-time errors in any
 * descendant client subtree, renders a caller-supplied fallback, and
 * routes the error through a private `reportError` seam.
 *
 * The seam currently logs a structured JSON line via console.error
 * (Better Stack ingests JSON). When @sentry/nextjs lands per D037,
 * swap reportError to call Sentry.captureException — public API does
 * not change.
 *
 * Server-component errors are handled by Next.js's `error.tsx` route
 * convention, not by this boundary. By design.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Tag for the boundary — flows into the structured log payload. */
  name: string;
  /** What to render when the boundary catches an error. */
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.reportError(error, info);
  }

  private reportError(error: Error, info: ErrorInfo): void {
    // TODO(D037): swap to Sentry.captureException once @sentry/nextjs is
    // installed. Structured JSON now so Better Stack can parse it the
    // moment shipping lands.
    console.error(
      JSON.stringify({
        event_type: 'ui_error_boundary_caught',
        boundary: this.props.name,
        error_name: error.name,
        error_message: error.message,
        component_stack: info.componentStack ?? null,
      }),
    );
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
