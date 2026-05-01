/**
 * @build-unit BU-calendar-near-me
 * @spec architecture/decision-log.md (D076)
 *
 * Unit tests for shared/geo.ts.
 *
 *  - Haversine: London↔Manchester ≈ 263 km.
 *  - postcodes.io: M1 4BT resolves to ~53.48, -2.24; invalid postcode
 *    returns null; network failure returns null. Mocks `globalThis.fetch`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { haversineKm, geocodeUkPostcode } from '@/shared/geo';

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
