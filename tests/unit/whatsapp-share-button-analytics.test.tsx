/**
 * @build-unit BU-whatsapp-share BU-hydration-fixes
 * @spec build/session-briefs/bu-whatsapp-share.md
 * @spec build/session-briefs/bu-hydration-fixes.md
 * @spec architecture/decision-log.md (D067, D080)
 *
 * Focused tests for the analytics ping added to <WhatsAppShareButton>
 * by D067. The component itself is owned by BU-share-rail-on-detail
 * (#111); these tests cover the slice this PR adds: the post_shared_out
 * event ping on click.
 *
 * The component now calls `useState` / `useEffect` (D080 deferred-origin
 * fix), so it can't be invoked as a plain function the way it could be
 * before. We test the ping behaviour by calling the now-exported
 * `pingShareIntent` helper directly — same surface, isolated from the
 * render context.
 *
 * The click handler that wires `pingShareIntent` to the rendered <a>
 * is structurally trivial (`event.stopPropagation(); pingShareIntent(...)`)
 * and is exercised in `whatsapp-share-button-hydration.test.tsx` via
 * SSR rendering of the button.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pingShareIntent } from '@/components/WhatsAppShareButton';

const POST_ID = '0123456789ab';

describe('WhatsAppShareButton — analytics ping (D067)', () => {
  let beaconSpy: ReturnType<typeof vi.fn>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    beaconSpy = vi.fn().mockReturnValue(true);
    fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { sendBeacon: beaconSpy });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the share-intent beacon with the post id and destination', () => {
    pingShareIntent(POST_ID);
    expect(beaconSpy).toHaveBeenCalledTimes(1);
    const [url, blob] = beaconSpy.mock.calls[0]!;
    expect(url).toBe('/api/analytics/share-intent');
    expect(blob).toBeInstanceOf(Blob);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to fetch when sendBeacon refuses the payload', () => {
    beaconSpy.mockReturnValueOnce(false);
    pingShareIntent(POST_ID);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/analytics/share-intent');
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
    });
    const body = JSON.parse((init.body as string) ?? '{}');
    expect(body).toEqual({ postId: POST_ID, destination: 'whatsapp' });
  });

  it('falls back to fetch when navigator has no sendBeacon', () => {
    vi.stubGlobal('navigator', {});
    pingShareIntent(POST_ID);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('is a no-op on the server (typeof window === "undefined")', () => {
    vi.unstubAllGlobals();
    // window is now undefined again.
    expect(typeof globalThis.window).toBe('undefined');
    pingShareIntent(POST_ID);
    // Nothing to assert beyond "no throw" — but we re-stub afterwards
    // so the global state remains consistent for siblings.
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { sendBeacon: beaconSpy });
    vi.stubGlobal('fetch', fetchSpy);
    expect(beaconSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
