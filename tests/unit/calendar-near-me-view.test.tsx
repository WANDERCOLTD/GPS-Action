/**
 * Unit tests for NearMeView (BU-calendar-near-me).
 *
 * @build-unit BU-calendar-near-me
 * @spec architecture/decision-log.md (D076)
 * @spec docs/build/session-briefs/bu-calendar-near-me.md
 *
 * Same plain-call tree-walker pattern AgendaView uses — exercise
 * `NearMeViewBody` directly so we don't need RTL. Asserts:
 *
 *  - `prompt` state shows the call-to-action panel and no list.
 *  - `located` state hides the prompt, renders the sort toggle, and
 *    sorts by ascending distance by default.
 *  - Switching sort to `date` re-orders by event start time.
 *  - Empty list renders the "No in-person events near you" message.
 *  - permission_denied surfaces the postcode-only copy.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { NearMeViewBody, sortNearMePosts, type NearMeCandidate } from '@/app/calendar/NearMeView';
import { CalendarRow } from '@/app/calendar/CalendarRow';

type AnyElement = ReactElement<Record<string, unknown>>;

function flatChildren(el: AnyElement): AnyElement[] {
  const acc: AnyElement[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const e = node as AnyElement;
    acc.push(e);
    const c = e.props.children;
    walk(c);
  };
  walk(el);
  return acc;
}

function findAllByTestId(el: AnyElement, testId: string): AnyElement[] {
  return flatChildren(el).filter((e) => e.props['data-testid'] === testId);
}

function findByTestId(el: AnyElement, testId: string): AnyElement | undefined {
  return findAllByTestId(el, testId)[0];
}

function findAllByType(el: AnyElement, fn: unknown): AnyElement[] {
  return flatChildren(el).filter((e) => (e as { type?: unknown }).type === fn);
}

function makePost(overrides: Partial<NearMeCandidate> = {}): NearMeCandidate {
  return {
    id: 'p1',
    title: 'Vigil',
    body: 'Meet at the corner.',
    kindSlug: 'event',
    kindDisplayName: 'Event',
    urgency: false,
    eventAt: '2026-05-03T17:00:00.000Z',
    eventEndsAt: null,
    locationText: 'Cheddar Road, Bristol',
    latitude: 51.4537,
    longitude: -2.5919,
    ...overrides,
  };
}

describe('sortNearMePosts', () => {
  const callerCoords = { lat: 53.4808, lng: -2.2426 };
  const manchester = makePost({
    id: 'manchester',
    eventAt: '2026-05-15T10:00:00.000Z',
    latitude: 53.4225,
    longitude: -2.2305,
  });
  const bristol = makePost({
    id: 'bristol',
    eventAt: '2026-05-03T10:00:00.000Z',
    latitude: 51.4537,
    longitude: -2.5919,
  });
  const london = makePost({
    id: 'london',
    eventAt: '2026-05-10T10:00:00.000Z',
    latitude: 51.5074,
    longitude: -0.1278,
  });

  it('falls back to date-sort when located is null', () => {
    const sorted = sortNearMePosts([london, bristol, manchester], null, 'distance');
    // No coords ⇒ distance sort meaningless; sorted by date asc.
    expect(sorted.map((s) => s.post.id)).toEqual(['bristol', 'london', 'manchester']);
    expect(sorted.every((s) => s.distanceKm === null)).toBe(true);
  });

  it('orders by distance ascending when located is set and sort=distance', () => {
    const sorted = sortNearMePosts([london, bristol, manchester], callerCoords, 'distance');
    expect(sorted.map((s) => s.post.id)).toEqual(['manchester', 'bristol', 'london']);
    expect(sorted[0]!.distanceKm!).toBeLessThan(sorted[1]!.distanceKm!);
  });

  it('orders by event start when sort=date even with coords', () => {
    const sorted = sortNearMePosts([london, bristol, manchester], callerCoords, 'date');
    expect(sorted.map((s) => s.post.id)).toEqual(['bristol', 'london', 'manchester']);
  });
});

describe('NearMeViewBody — prompt state', () => {
  it('renders the prompt panel and no list when no coords supplied', () => {
    const tree = NearMeViewBody({
      posts: [makePost()],
      state: { kind: 'prompt' },
      sort: 'distance',
      onUseGeolocation: () => undefined,
      onPostcode: () => undefined,
      onChangeSort: () => undefined,
    }) as AnyElement;

    expect(findByTestId(tree, 'calendar-near-prompt')).toBeDefined();
    expect(findByTestId(tree, 'calendar-near-list')).toBeUndefined();
    expect(findByTestId(tree, 'calendar-near-sort-toggle')).toBeUndefined();
  });

  it('hides the geolocation button after permission is denied', () => {
    const tree = NearMeViewBody({
      posts: [],
      state: { kind: 'permission_denied' },
      sort: 'distance',
      onUseGeolocation: () => undefined,
      onPostcode: () => undefined,
      onChangeSort: () => undefined,
    }) as AnyElement;

    expect(findByTestId(tree, 'calendar-near-prompt')).toBeDefined();
    expect(findByTestId(tree, 'calendar-near-use-geolocation')).toBeUndefined();
    // Permission-denied prompt switches the copy from the "Allow your
    // location" line to the "We need a location" fallback that
    // signposts the postcode-or-place option (BU-postcode-or-place).
    const promptCopy = flatChildren(tree).filter(
      (e) => typeof e.type === 'string' && e.type === 'p',
    );
    const haystack = promptCopy.map((p) => JSON.stringify(p.props['children'])).join(' ');
    expect(haystack).toMatch(/postcode, town or city instead/);
  });
});

describe('NearMeViewBody — located state', () => {
  // Caller in central Manchester. Three candidates with real UK coords.
  const callerCoords = { lat: 53.4808, lng: -2.2426 };
  const manchester = makePost({
    id: 'manchester',
    eventAt: '2026-05-15T10:00:00.000Z',
    latitude: 53.4225,
    longitude: -2.2305,
  });
  const bristol = makePost({
    id: 'bristol',
    eventAt: '2026-05-03T10:00:00.000Z',
    latitude: 51.4537,
    longitude: -2.5919,
  });
  const london = makePost({
    id: 'london',
    eventAt: '2026-05-10T10:00:00.000Z',
    latitude: 51.5074,
    longitude: -0.1278,
  });

  it('sorts by ascending distance by default', () => {
    const tree = NearMeViewBody({
      posts: [london, bristol, manchester],
      state: { kind: 'located', coords: callerCoords },
      sort: 'distance',
      onUseGeolocation: () => undefined,
      onPostcode: () => undefined,
      onChangeSort: () => undefined,
    }) as AnyElement;

    expect(findByTestId(tree, 'calendar-near-prompt')).toBeUndefined();
    expect(findByTestId(tree, 'calendar-near-sort-toggle')).toBeDefined();

    const distances = findAllByTestId(tree, 'calendar-near-row-distance').map((el) =>
      Number(el.props['data-distance-km']),
    );
    expect(distances).toHaveLength(3);
    expect(distances[0]!).toBeLessThan(distances[1]!);
    expect(distances[1]!).toBeLessThan(distances[2]!);
  });

  it('sorts by event start when sort=date', () => {
    const tree = NearMeViewBody({
      posts: [london, bristol, manchester],
      state: { kind: 'located', coords: callerCoords },
      sort: 'date',
      onUseGeolocation: () => undefined,
      onPostcode: () => undefined,
      onChangeSort: () => undefined,
    }) as AnyElement;

    // bristol = May 3, london = May 10, manchester = May 15.
    const rows = findAllByType(tree, CalendarRow);
    const ids = rows.map((r) => (r.props['post'] as { id: string }).id);
    expect(ids).toEqual(['bristol', 'london', 'manchester']);
  });

  it('renders the empty state link to /compose when no candidates', () => {
    const tree = NearMeViewBody({
      posts: [],
      state: { kind: 'located', coords: callerCoords },
      sort: 'distance',
      onUseGeolocation: () => undefined,
      onPostcode: () => undefined,
      onChangeSort: () => undefined,
    }) as AnyElement;

    expect(findByTestId(tree, 'calendar-near-empty')).toBeDefined();
    expect(findByTestId(tree, 'calendar-near-empty-compose')).toBeDefined();
    expect(findByTestId(tree, 'calendar-near-list')).toBeUndefined();
  });

  it('attaches a distance pill to every row', () => {
    const tree = NearMeViewBody({
      posts: [bristol],
      state: { kind: 'located', coords: callerCoords },
      sort: 'distance',
      onUseGeolocation: () => undefined,
      onPostcode: () => undefined,
      onChangeSort: () => undefined,
    }) as AnyElement;

    expect(findAllByTestId(tree, 'calendar-near-row-distance')).toHaveLength(1);
  });
});
