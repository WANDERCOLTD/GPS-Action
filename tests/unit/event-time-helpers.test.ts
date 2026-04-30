/**
 * Unit tests for the BU-event-time shared helpers.
 *
 * @build-unit BU-event-time
 * @spec architecture/decision-log.md (D073)
 * @spec docs/adrs/0001-post-event-time-fields.md
 *
 * Covers:
 *  - kindIsTimeBearing — single source of truth for time-bearing kinds.
 *  - postCreateSchema cross-field invariant (eventEndsAt >= eventAt).
 *  - format-event-time helpers (UTC ↔ Europe/London round-trip,
 *    formatEventStart / formatEventRange single-day + multi-day,
 *    todayStartLondonUtc).
 */

import { describe, it, expect } from 'vitest';
import {
  kindIsTimeBearing,
  TIME_BEARING_KIND_SLUGS,
  REQUIRED_POST_KIND_SLUGS,
} from '@/shared/post-kinds';
import { postCreateSchema, postUpdateSchema } from '@/shared/validation/post';
import {
  eventInputToUtc,
  utcToEventInput,
  formatEventStart,
  formatEventRange,
  todayStartLondonUtc,
} from '@/shared/format-event-time';

describe('kindIsTimeBearing', () => {
  it.each(['meeting', 'event', 'happening_now'] as const)('returns true for %s', (slug) => {
    expect(kindIsTimeBearing(slug)).toBe(true);
  });

  it.each(['cultural', 'outcome', 'thought', 'link_share', 'call_to_action', 'tick_or_cross'])(
    'returns false for %s',
    (slug) => {
      expect(kindIsTimeBearing(slug)).toBe(false);
    },
  );

  it('returns false for null / undefined / unknown', () => {
    expect(kindIsTimeBearing(null)).toBe(false);
    expect(kindIsTimeBearing(undefined)).toBe(false);
    expect(kindIsTimeBearing('not-a-real-kind')).toBe(false);
  });

  it('TIME_BEARING_KIND_SLUGS is a subset of REQUIRED_POST_KIND_SLUGS', () => {
    const required = new Set<string>(REQUIRED_POST_KIND_SLUGS);
    for (const slug of TIME_BEARING_KIND_SLUGS) {
      expect(required.has(slug)).toBe(true);
    }
  });
});

describe('postCreateSchema event-time fields', () => {
  const valid = {
    title: 'Test event',
    body: 'A body that is long enough to clear the minimum.',
    visibility: 'public' as const,
  };

  it('accepts event with both timestamps in valid order', () => {
    const result = postCreateSchema.safeParse({
      ...valid,
      eventAt: '2026-05-03T17:00:00.000Z',
      eventEndsAt: '2026-05-03T19:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects event where end is before start', () => {
    const result = postCreateSchema.safeParse({
      ...valid,
      eventAt: '2026-05-03T19:00:00.000Z',
      eventEndsAt: '2026-05-03T17:00:00.000Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'eventEndsAt');
      expect(issue).toBeDefined();
    }
  });

  it('accepts event with only the start (end optional)', () => {
    const result = postCreateSchema.safeParse({
      ...valid,
      eventAt: '2026-05-03T17:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts no event fields at all (optional for all kinds)', () => {
    const result = postCreateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts a Date instance, not just an ISO string', () => {
    const result = postCreateSchema.safeParse({
      ...valid,
      eventAt: new Date('2026-05-03T17:00:00.000Z'),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date strings', () => {
    const result = postCreateSchema.safeParse({
      ...valid,
      eventAt: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty-string eventAt as undefined', () => {
    const result = postCreateSchema.safeParse({
      ...valid,
      eventAt: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventAt).toBeUndefined();
    }
  });

  it('truncates locationText at 500 chars (rejects over)', () => {
    const result = postCreateSchema.safeParse({
      ...valid,
      locationText: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('postUpdateSchema event-time fields', () => {
  const validId = '00000000-0000-4000-8000-000000000000';

  it('accepts a valid update with event fields', () => {
    const result = postUpdateSchema.safeParse({
      id: validId,
      eventAt: '2026-05-03T17:00:00.000Z',
      eventEndsAt: '2026-05-03T19:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an update where end is before start', () => {
    const result = postUpdateSchema.safeParse({
      id: validId,
      eventAt: '2026-05-03T19:00:00.000Z',
      eventEndsAt: '2026-05-03T17:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an update with only an id (no fields changed)', () => {
    const result = postUpdateSchema.safeParse({ id: validId });
    expect(result.success).toBe(true);
  });
});

describe('eventInputToUtc / utcToEventInput round-trip', () => {
  it('converts a London wall-clock time to UTC', () => {
    // BST (May): UTC+1, so 18:00 London → 17:00 UTC
    const utc = eventInputToUtc('2026-05-03', '18:00');
    expect(utc).toBeInstanceOf(Date);
    expect(utc?.toISOString()).toBe('2026-05-03T17:00:00.000Z');
  });

  it('converts a wintertime London wall-clock to UTC (no offset)', () => {
    // GMT (January): UTC+0, so 18:00 London = 18:00 UTC
    const utc = eventInputToUtc('2026-01-15', '18:00');
    expect(utc?.toISOString()).toBe('2026-01-15T18:00:00.000Z');
  });

  it('round-trips a UTC Date through utcToEventInput', () => {
    const utc = new Date('2026-05-03T17:00:00.000Z');
    const input = utcToEventInput(utc);
    expect(input).toEqual({ date: '2026-05-03', time: '18:00' });
  });

  it('returns null for empty / null inputs', () => {
    expect(eventInputToUtc(null, null)).toBeNull();
    expect(eventInputToUtc('', '')).toBeNull();
  });

  it('utcToEventInput returns empty strings for null', () => {
    expect(utcToEventInput(null)).toEqual({ date: '', time: '' });
    expect(utcToEventInput(undefined)).toEqual({ date: '', time: '' });
  });

  it('defaults missing time to 00:00', () => {
    const utc = eventInputToUtc('2026-05-03', null);
    // 2026-05-03T00:00 BST = 2026-05-02T23:00 UTC
    expect(utc?.toISOString()).toBe('2026-05-02T23:00:00.000Z');
  });
});

describe('formatEventStart', () => {
  it('renders point-in-time at the top of the hour with no minutes', () => {
    // 2026-05-03 18:00 BST
    const utc = new Date('2026-05-03T17:00:00.000Z');
    expect(formatEventStart(utc)).toBe('Sun 3 May · 6pm');
  });

  it('renders mixed-minute times with the colon form', () => {
    // 2026-05-03 18:30 BST
    const utc = new Date('2026-05-03T17:30:00.000Z');
    expect(formatEventStart(utc)).toBe('Sun 3 May · 6:30pm');
  });

  it('returns empty string for null', () => {
    expect(formatEventStart(null)).toBe('');
  });
});

describe('formatEventRange', () => {
  it('collapses single-day ranges', () => {
    // 2026-05-03 18:00–20:00 BST
    const start = new Date('2026-05-03T17:00:00.000Z');
    const end = new Date('2026-05-03T19:00:00.000Z');
    expect(formatEventRange(start, end)).toBe('Sun 3 May · 6–8pm');
  });

  it('spells both ends for multi-day ranges', () => {
    // Start 2026-05-03 18:00 BST, end 2026-05-04 09:00 BST
    const start = new Date('2026-05-03T17:00:00.000Z');
    const end = new Date('2026-05-04T08:00:00.000Z');
    expect(formatEventRange(start, end)).toBe('Sun 3 May 6pm – Mon 4 May 9am');
  });

  it('falls back to formatEventStart when end is null', () => {
    const start = new Date('2026-05-03T17:00:00.000Z');
    expect(formatEventRange(start, null)).toBe('Sun 3 May · 6pm');
  });

  it('returns empty string when start is null', () => {
    expect(formatEventRange(null, null)).toBe('');
  });
});

describe('todayStartLondonUtc', () => {
  it('returns 23:00 UTC on the previous calendar day during BST', () => {
    // Mid-May, BST (UTC+1). Today's wall-clock 00:00 London = previous-day 23:00 UTC.
    const someBSTMoment = new Date('2026-05-15T15:00:00.000Z'); // 16:00 London
    const cutoff = todayStartLondonUtc(someBSTMoment);
    expect(cutoff.toISOString()).toBe('2026-05-14T23:00:00.000Z');
  });

  it('returns 00:00 UTC during GMT (no offset)', () => {
    // Mid-January, GMT (UTC+0). Today 00:00 London = same-day 00:00 UTC.
    const someGMTMoment = new Date('2026-01-15T15:00:00.000Z'); // 15:00 London
    const cutoff = todayStartLondonUtc(someGMTMoment);
    expect(cutoff.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });
});
