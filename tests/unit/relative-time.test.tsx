/**
 * @build-unit BU-hydration-fixes
 * @spec build/session-briefs/bu-hydration-fixes.md
 * @spec architecture/decision-log.md (D080)
 *
 * Unit tests for <RelativeTime>. We render via `renderToString` from
 * `react-dom/server` — that exercises the SSR pass exactly the way
 * Next.js does it: `useEffect` does not fire, `useState` returns the
 * initial value, the <ClientOnly> wrapper picks the fallback branch.
 *
 * That gives us a behaviour-accurate test of the contract that matters
 * for hydration safety:
 *
 *   - the SSR markup contains a `<time>` element
 *   - the `<time>`'s `dateTime` attribute carries the canonical ISO
 *     string (accessibility + indexer contract)
 *   - the body of the `<time>` is the deterministic absolute fallback
 *     (the ISO by default, or a caller-supplied string), NOT the
 *     output of `formatDistanceToNow` (which is non-deterministic
 *     across SSR vs CSR)
 *   - `className` and `style` props pass through
 *
 * The post-mount swap to `formatDistanceToNow` is React + date-fns
 * behaviour — not the surface this BU adds — so it isn't re-tested
 * here.
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { RelativeTime } from '@/components/RelativeTime';

describe('RelativeTime — server render', () => {
  it('wraps the fallback in a <time dateTime={iso}>', () => {
    const iso = '2026-04-27T10:00:00.000Z';
    const html = renderToString(createElement(RelativeTime, { date: iso }));
    expect(html).toContain('<time');
    expect(html).toContain(`dateTime="${iso}"`);
    // Default fallback is the ISO string itself.
    expect(html).toContain(iso);
  });

  it('honours a custom fallback string', () => {
    const iso = '2026-04-27T10:00:00.000Z';
    const html = renderToString(createElement(RelativeTime, { date: iso, fallback: 'just now' }));
    expect(html).toContain('just now');
    expect(html).toContain(`dateTime="${iso}"`);
  });

  it('accepts a Date instance and serialises it to the canonical ISO on `dateTime`', () => {
    const date = new Date('2026-04-27T10:00:00.000Z');
    const html = renderToString(createElement(RelativeTime, { date }));
    expect(html).toContain('dateTime="2026-04-27T10:00:00.000Z"');
  });

  it('passes className through to the rendered <time>', () => {
    const html = renderToString(
      createElement(RelativeTime, {
        date: '2026-04-27T10:00:00.000Z',
        className: 'gps-meta',
      }),
    );
    expect(html).toContain('class="gps-meta"');
  });

  it('passes style through to the rendered <time>', () => {
    const html = renderToString(
      createElement(RelativeTime, {
        date: '2026-04-27T10:00:00.000Z',
        style: { marginLeft: 'auto' },
      }),
    );
    expect(html).toContain('margin-left:auto');
  });

  it('emits a deterministic string across two server renders for the same input', () => {
    const make = (): string =>
      renderToString(createElement(RelativeTime, { date: '2026-04-27T10:00:00.000Z' }));
    expect(make()).toBe(make());
  });

  it('does NOT include a "X ago" relative form in the SSR markup', () => {
    // The SSR fallback must be deterministic — the relative form depends
    // on `Date.now()` at render time, which would diverge between server
    // and client. The ISO fallback wins on SSR.
    const iso = '2020-01-01T00:00:00.000Z';
    const html = renderToString(createElement(RelativeTime, { date: iso }));
    expect(html).not.toMatch(/ago/i);
    expect(html).not.toMatch(/years/i);
  });
});
