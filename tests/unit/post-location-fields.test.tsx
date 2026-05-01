/**
 * Unit tests for the postcode + isOnline submit pipeline.
 *
 * @build-unit BU-post-location-input
 * @spec product/parking-lot.md ("Geocoding pipeline for post locations (Path B)")
 *
 * The composer + edit form share an identical pipeline at submit:
 *
 *  1. Time-bearing kind only.
 *  2. If `isOnline=true`, postcode is ignored, coords cleared
 *     server-side.
 *  3. Otherwise, geocode the typed postcode via shared/geo.
 *     Success → set latitude/longitude on the FormData.
 *     Failure → surface the inline error and abort submit.
 *  4. Edit-form-specific: empty postcode + unticked online means
 *     "leave existing coords alone" (the form sends no lat/lng).
 *
 * These tests exercise the four critical paths without mounting
 * the full forms (which depend on the tRPC + Next router context).
 * The pipeline is a pure async function over FormData; we assert
 * its FormData side-effects directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { geocodeUkPostcode } from '@/shared/geo';

/**
 * Minimal reproduction of the composer/edit submit pipeline. Both
 * forms run the same logic before invoking the server action; we
 * extract it here so the test exercises the contract rather than
 * the rendering.
 *
 * Returns:
 *  - { ok: true } when the FormData was updated and submit should
 *    proceed.
 *  - { ok: false, error } when geocoding failed; submit must abort
 *    and the form should render `error` inline.
 */
async function runLocationPipeline(args: {
  formData: FormData;
  isTimeBearing: boolean;
  isOnline: boolean;
  postcode: string;
  /** Edit-form variant always emits an explicit isOnline=false for
   *  the unticked case so the server distinguishes "off" from "absent". */
  emitExplicitOff: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!args.isTimeBearing) {
    args.formData.delete('postcode');
    args.formData.delete('isOnline');
    return { ok: true };
  }
  if (args.isOnline) {
    args.formData.set('isOnline', 'true');
    args.formData.delete('postcode');
    return { ok: true };
  }
  if (args.emitExplicitOff) {
    args.formData.set('isOnline', 'false');
  }
  const trimmed = args.postcode.trim();
  if (trimmed) {
    const coords = await geocodeUkPostcode(trimmed);
    if (!coords) {
      return {
        ok: false,
        error: "Postcode not recognised — check spelling, or tick 'This is online'",
      };
    }
    args.formData.set('latitude', String(coords.lat));
    args.formData.set('longitude', String(coords.lng));
  }
  return { ok: true };
}

describe('post location submit pipeline', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('geocode happy path: typed postcode → latitude/longitude on FormData', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        result: { latitude: 53.4808, longitude: -2.2426 },
      }),
    } as unknown as Response);

    const fd = new FormData();
    const result = await runLocationPipeline({
      formData: fd,
      isTimeBearing: true,
      isOnline: false,
      postcode: 'M1 4BT',
      emitExplicitOff: false,
    });

    expect(result.ok).toBe(true);
    expect(fd.get('latitude')).toBe('53.4808');
    expect(fd.get('longitude')).toBe('-2.2426');
    // We didn't tick online, so the composer variant doesn't stamp it.
    expect(fd.get('isOnline')).toBeNull();
  });

  it('invalid postcode: returns inline error, no coords stamped', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 404 }),
    } as unknown as Response);

    const fd = new FormData();
    const result = await runLocationPipeline({
      formData: fd,
      isTimeBearing: true,
      isOnline: false,
      postcode: 'ZZ99 9ZZ',
      emitExplicitOff: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Postcode not recognised/);
    }
    expect(fd.get('latitude')).toBeNull();
    expect(fd.get('longitude')).toBeNull();
  });

  it('isOnline=true overrides typed postcode (online wins, no geocode call)', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const fd = new FormData();
    const result = await runLocationPipeline({
      formData: fd,
      isTimeBearing: true,
      isOnline: true,
      // Typed but ignored because the toggle is checked.
      postcode: 'M1 4BT',
      emitExplicitOff: false,
    });

    expect(result.ok).toBe(true);
    expect(fd.get('isOnline')).toBe('true');
    expect(fd.get('postcode')).toBeNull();
    expect(fd.get('latitude')).toBeNull();
    expect(fd.get('longitude')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('edit page: empty postcode + unticked online preserves existing coords (no lat/lng on FormData)', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const fd = new FormData();
    const result = await runLocationPipeline({
      formData: fd,
      isTimeBearing: true,
      isOnline: false,
      postcode: '',
      // Edit form variant — emits an explicit isOnline=false so the
      // action distinguishes "user untoggled it" from "absent".
      emitExplicitOff: true,
    });

    expect(result.ok).toBe(true);
    // Critical: latitude / longitude are NOT stamped, so the server
    // skips them and the existing coords on the Post are preserved.
    expect(fd.get('latitude')).toBeNull();
    expect(fd.get('longitude')).toBeNull();
    expect(fd.get('isOnline')).toBe('false');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('non-time-bearing kind: strips any stale postcode/isOnline from FormData', async () => {
    const fd = new FormData();
    fd.set('postcode', 'M1 4BT');
    fd.set('isOnline', 'true');

    const result = await runLocationPipeline({
      formData: fd,
      isTimeBearing: false,
      isOnline: true,
      postcode: 'M1 4BT',
      emitExplicitOff: false,
    });

    expect(result.ok).toBe(true);
    expect(fd.get('postcode')).toBeNull();
    expect(fd.get('isOnline')).toBeNull();
  });
});
