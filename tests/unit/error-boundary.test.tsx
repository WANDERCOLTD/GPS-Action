/**
 * Unit tests for the ErrorBoundary class component.
 *
 * @build-unit BU-error-boundary
 * @spec docs/build/phase-0-foundations.md
 *
 * The project's vitest environment is `node` and no RTL is installed.
 * Rather than drag in jsdom + RTL for one component (out of scope per
 * the F11 brief), we exercise the class directly:
 *   - happy path: render() returns children when state is healthy
 *   - catch path: getDerivedStateFromError flips hasError and render()
 *     returns the fallback
 *   - reporting: componentDidCatch logs a structured JSON line via
 *     console.error with the boundary tag, error name, message, and
 *     component stack
 *
 * The reporter contract is the bit the rest of the system will rely
 * on (Better Stack ingest today, Sentry hook tomorrow), so it is the
 * most-tested surface here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // ── render() — happy path ──────────────────────────────────────────────

  it('renders children when no error has been caught', () => {
    const children = createElement('div', null, 'healthy');
    const fallback = createElement('div', null, 'fallback');
    const boundary = new ErrorBoundary({ name: 'root', fallback, children });

    const out = boundary.render();
    expect(out).toBe(children);
  });

  // ── render() — catch path ──────────────────────────────────────────────

  it('renders the fallback once an error is caught', () => {
    const children = createElement('div', null, 'healthy');
    const fallback = createElement('div', null, 'fallback');
    const boundary = new ErrorBoundary({ name: 'root', fallback, children });

    // Simulate the React lifecycle: derived state on error, then re-render.
    const nextState = ErrorBoundary.getDerivedStateFromError();
    expect(nextState).toEqual({ hasError: true });
    boundary.state = nextState;

    const out = boundary.render();
    expect(out).toBe(fallback);
  });

  // ── reporter — structured payload ──────────────────────────────────────

  it('logs a structured JSON payload via console.error when an error is caught', () => {
    const children = createElement('div', null, 'healthy');
    const fallback = createElement('div', null, 'fallback');
    const boundary = new ErrorBoundary({ name: 'feed', fallback, children });

    const error = new TypeError('something broke');
    boundary.componentDidCatch(error, { componentStack: '\n  in Feed\n  in App' });

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const raw = consoleErrorSpy.mock.calls[0]?.[0];
    expect(typeof raw).toBe('string');

    const payload = JSON.parse(raw as string) as Record<string, unknown>;
    expect(payload).toEqual({
      event_type: 'ui_error_boundary_caught',
      boundary: 'feed',
      error_name: 'TypeError',
      error_message: 'something broke',
      component_stack: '\n  in Feed\n  in App',
    });
  });

  it('falls back to null component_stack when ErrorInfo has no stack', () => {
    const children = createElement('div', null, 'healthy');
    const fallback = createElement('div', null, 'fallback');
    const boundary = new ErrorBoundary({ name: 'compose', fallback, children });

    const error = new Error('boom');
    // React's ErrorInfo.componentStack can be `null` in some test paths.
    boundary.componentDidCatch(error, { componentStack: null });

    const raw = consoleErrorSpy.mock.calls[0]?.[0];
    const payload = JSON.parse(raw as string) as Record<string, unknown>;
    expect(payload.component_stack).toBeNull();
    expect(payload.boundary).toBe('compose');
  });

  // ── name tagging ───────────────────────────────────────────────────────

  it('tags the log payload with the boundary name prop', () => {
    const fallback = createElement('div', null, 'fallback');
    const children = createElement('div', null, 'ok');

    const cases = ['root', 'feed', 'compose', 'post'];
    for (const name of cases) {
      consoleErrorSpy.mockClear();
      const boundary = new ErrorBoundary({ name, fallback, children });
      boundary.componentDidCatch(new Error('x'), { componentStack: '' });

      const raw = consoleErrorSpy.mock.calls[0]?.[0];
      const payload = JSON.parse(raw as string) as Record<string, unknown>;
      expect(payload.boundary).toBe(name);
    }
  });
});
