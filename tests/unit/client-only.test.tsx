/**
 * @build-unit BU-hydration-fixes
 * @spec build/session-briefs/bu-hydration-fixes.md
 * @spec architecture/decision-log.md (D080)
 *
 * Unit tests for the <ClientOnly> primitive. The vitest environment is
 * `node` and no DOM is available — but we don't need one. The whole
 * point of <ClientOnly> is that it renders the `fallback` on the
 * server (and on first client paint). `renderToString` from
 * `react-dom/server` IS the server pass: `useEffect` doesn't fire,
 * `useState` returns the initial value (`mounted=false`), and the
 * fallback branch wins.
 *
 * That covers the contract that matters for hydration safety:
 *   - what bytes the server emits (the fallback)
 *   - that those bytes don't depend on `Date.now()` or `window.*`
 *
 * The post-mount swap is React's responsibility (tiny `setMounted(true)`
 * inside `useEffect`); we don't re-test React itself.
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { ClientOnly } from '@/components/ClientOnly';

describe('ClientOnly — server render', () => {
  it('emits the fallback markup on the server', () => {
    const html = renderToString(
      createElement(ClientOnly, {
        fallback: createElement('span', { 'data-testid': 'fallback' }, 'loading…'),
        children: createElement('span', { 'data-testid': 'live' }, 'live'),
      }),
    );
    expect(html).toContain('data-testid="fallback"');
    expect(html).toContain('loading…');
    expect(html).not.toContain('data-testid="live"');
  });

  it('emits a deterministic string for the same fallback across two renders', () => {
    const make = (): string =>
      renderToString(
        createElement(ClientOnly, {
          fallback: createElement('span', null, 'stable'),
          children: createElement('span', null, 'live'),
        }),
      );
    expect(make()).toBe(make());
  });

  it('treats children as the post-mount branch (not part of SSR output)', () => {
    const html = renderToString(
      createElement(ClientOnly, {
        fallback: createElement('span', null, 'placeholder'),
        children: createElement('span', { id: 'should-not-appear' }, 'live'),
      }),
    );
    expect(html).not.toContain('should-not-appear');
  });

  it('renders nothing when the fallback is null (still SSR-safe)', () => {
    const html = renderToString(
      createElement(ClientOnly, {
        fallback: null,
        children: createElement('span', null, 'live'),
      }),
    );
    expect(html).toBe('');
  });
});
