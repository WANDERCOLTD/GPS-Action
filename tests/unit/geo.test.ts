/**
 * @build-unit BU-calendar-near-me BU-postcode-or-place
 * @spec architecture/decision-log.md (D076)
 *
 * Unit tests for shared/geo.ts.
 *
 *  - Haversine: London↔Manchester ≈ 263 km.
 *  - postcodes.io: M1 4BT resolves to ~53.48, -2.24; invalid postcode
 *    returns null; network failure returns null. Mocks `globalThis.fetch`.
 *  - isUkPostcodeShape: full postcodes match (with / without space, any
 *    case); outward-only / junk / non-UK don't.
 *  - geocodePlace: hits our /api/geocode/place proxy; success / 404 /
 *    rate-limit / upstream-error / short-input all handled.
 *  - resolveLocation: chains postcode-shape → postcodes.io → place;
 *    correct path for each scenario in the brief's S1–S20 table.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  haversineKm,
  geocodeUkPostcode,
  geocodePlace,
  isUkPostcodeShape,
  resolveLocation,
  MIN_PLACE_QUERY_LENGTH,
} from '@/shared/geo';

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    const p = { lat: 51.5074, lng: -0.1278 };
    expect(haversineKm(p, p)).toBeCloseTo(0, 5);
  });

  it('London ↔ Manchester is approximately 263 km', () => {
    const london = { lat: 51.5074, lng: -0.1278 };
    const manchester = { lat: 53.4808, lng: -2.2426 };
    const km = haversineKm(london, manchester);
    expect(km).toBeGreaterThan(258);
    expect(km).toBeLessThan(268);
  });

  it('is symmetric — d(a, b) == d(b, a)', () => {
    const a = { lat: 51.5074, lng: -0.1278 };
    const b = { lat: 53.4808, lng: -2.2426 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });

  it('handles antipodal points (~half-circumference)', () => {
    // ~20015 km is half the Earth's circumference.
    const km = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(km).toBeGreaterThan(20_000);
    expect(km).toBeLessThan(20_050);
  });
});

describe('geocodeUkPostcode', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('returns lat/lng for a known UK postcode', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        result: { latitude: 53.4808, longitude: -2.2426 },
      }),
    } as unknown as Response);

    const result = await geocodeUkPostcode('M1 4BT');
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(53.48, 1);
    expect(result!.lng).toBeCloseTo(-2.24, 1);
  });

  it('uppercases and strips whitespace before requesting', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        result: { latitude: 53.4808, longitude: -2.2426 },
      }),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    await geocodeUkPostcode('  m1   4bt  ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('M14BT');
  });

  it('returns null when the postcode is not found (404)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 404 }),
    } as unknown as Response);

    const result = await geocodeUkPostcode('ZZ99 9ZZ');
    expect(result).toBeNull();
  });

  it('returns null when fetch rejects (network error)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await geocodeUkPostcode('M1 4BT');
    expect(result).toBeNull();
  });

  it('returns null when the response shape is unexpected', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 200, result: { somethingElse: true } }),
    } as unknown as Response);

    const result = await geocodeUkPostcode('M1 4BT');
    expect(result).toBeNull();
  });

  it('returns null for empty / whitespace-only input', async () => {
    globalThis.fetch = vi.fn();
    const result = await geocodeUkPostcode('   ');
    expect(result).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('isUkPostcodeShape', () => {
  it.each([
    ['BS1 4DJ', true],
    ['bs1 4dj', true],
    ['BS14DJ', true],
    ['  BS1 4DJ  ', true],
    ['M1 1AA', true],
    ['EC1A 1BB', true],
    ['W1A 1HQ', true],
    ['SW1A 0AA', true],
  ])('matches a full UK postcode %s → %s', (input, expected) => {
    expect(isUkPostcodeShape(input)).toBe(expected);
  });

  it.each([
    ['BS1', false], // outward-only — falls through to place
    ['BS', false],
    ['B', false],
    ['Bristol', false],
    ['Manchester', false],
    ['12345', false], // US zip
    ['', false],
    ['   ', false],
    ['<script>alert(1)</script>', false],
    ['BS1 4D', false], // truncated inward
    ['1BS 4DJ', false], // wrong shape (digit-led outward)
  ])('does not match %s', (input, expected) => {
    expect(isUkPostcodeShape(input)).toBe(expected);
  });
});

describe('geocodePlace', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('returns lat/lng on a successful proxy response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lat: 51.4545, lng: -2.5879 }),
    } as unknown as Response);

    const result = await geocodePlace('Bristol');
    expect(result).toEqual({ lat: 51.4545, lng: -2.5879 });
  });

  it('hits the /api/geocode/place route with URL-encoded query', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lat: 51.4545, lng: -2.5879 }),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    await geocodePlace('North London');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toBe('/api/geocode/place?q=North%20London');
  });

  it('returns null on 404 (no-result)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'no-result' }),
    } as unknown as Response);

    expect(await geocodePlace('asdfjkl')).toBeNull();
  });

  it('returns null on 429 (rate-limited)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'rate-limited' }),
    } as unknown as Response);

    expect(await geocodePlace('Bristol')).toBeNull();
  });

  it('returns null on 502 (upstream-error)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'upstream-error' }),
    } as unknown as Response);

    expect(await geocodePlace('Bristol')).toBeNull();
  });

  it('returns null when fetch throws (network down)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    expect(await geocodePlace('Bristol')).toBeNull();
  });

  it('returns null when the response body is malformed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: true }),
    } as unknown as Response);

    expect(await geocodePlace('Bristol')).toBeNull();
  });

  it.each([
    ['', 0],
    [' ', 0],
    ['ab', 2],
    ['a', 1],
  ])(
    'returns null and skips fetch for input shorter than MIN_PLACE_QUERY_LENGTH (%j, %i chars)',
    async (input) => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;
      const result = await geocodePlace(input);
      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('exports MIN_PLACE_QUERY_LENGTH = 3 (locked decision Q6)', () => {
    expect(MIN_PLACE_QUERY_LENGTH).toBe(3);
  });
});

describe('resolveLocation', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('S1: full UK postcode → postcodes.io', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 200, result: { latitude: 51.4, longitude: -2.5 } }),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    const result = await resolveLocation('BS1 4DJ');
    expect(result).toEqual({ lat: 51.4, lng: -2.5 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('postcodes.io');
  });

  it('S5: free-text place → /api/geocode/place', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lat: 51.4545, lng: -2.5879 }),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    const result = await resolveLocation('Bristol');
    expect(result).toEqual({ lat: 51.4545, lng: -2.5879 });
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/geocode/place');
  });

  it('S4: partial postcode (BS1) → place lookup (regex rejects, single network call)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lat: 51.45, lng: -2.59 }),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    const result = await resolveLocation('BS1');
    expect(result).toEqual({ lat: 51.45, lng: -2.59 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/geocode/place');
  });

  it('falls through to place when postcodes.io 404s a valid-shaped postcode', async () => {
    const fetchMock = vi
      .fn()
      // postcodes.io 404
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      } as unknown as Response)
      // place lookup succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lat: 51.45, lng: -2.59 }),
      } as unknown as Response);
    globalThis.fetch = fetchMock;

    const result = await resolveLocation('ZZ99 9ZZ');
    expect(result).toEqual({ lat: 51.45, lng: -2.59 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('S14: junk text → place returns null → resolveLocation returns null', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'no-result' }),
    } as unknown as Response);

    expect(await resolveLocation('asdfjkl')).toBeNull();
  });

  it('S15: empty / whitespace input → null without any fetch', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    expect(await resolveLocation('   ')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('S20-equivalent: input shorter than min length → null without fetch', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    expect(await resolveLocation('ab')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
