/**
 * @build-unit BU-whatsapp-share
 * @spec build/session-briefs/bu-whatsapp-share.md
 * @spec architecture/decision-log.md (D067)
 *
 * Focused tests for the analytics ping added to <WhatsAppShareButton>
 * by D067. The component itself is owned by BU-share-rail-on-detail
 * (#111); these tests cover the slice this PR adds: the post_shared_out
 * event ping on click.
 *
 * Vitest env is `node` — no DOM, no RTL. We invoke the component
 * function directly and walk the returned ReactElement, mirroring the
 * established LinkPreviewCard test pattern.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react';
import { WhatsAppShareButton } from '@/components/WhatsAppShareButton';

type AnyElement = ReactElement<Record<string, unknown>>;

const baseProps = {
  postId: '0123456789ab',
  postTitle: 'Sky News bias post',
  postBody: 'Worth pushing back on this one.',
};

function fireClick(): { stopPropagation: ReturnType<typeof vi.fn> } {
  const el = WhatsAppShareButton(baseProps) as AnyElement;
  const onClick = el.props.onClick as (event: Partial<ReactMouseEvent<HTMLAnchorElement>>) => void;
  const stopPropagation = vi.fn();
  onClick({ stopPropagation });
  return { stopPropagation };
}

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

  it('still stops the click bubbling so the parent PostCard does not navigate', () => {
    const { stopPropagation } = fireClick();
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('sends the share-intent beacon with the post id and destination', () => {
    fireClick();
    expect(beaconSpy).toHaveBeenCalledTimes(1);
    const [url, blob] = beaconSpy.mock.calls[0]!;
    expect(url).toBe('/api/analytics/share-intent');
    expect(blob).toBeInstanceOf(Blob);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to fetch when sendBeacon refuses the payload', () => {
    beaconSpy.mockReturnValueOnce(false);
    fireClick();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/analytics/share-intent');
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
    });
    const body = JSON.parse((init.body as string) ?? '{}');
    expect(body).toEqual({ postId: baseProps.postId, destination: 'whatsapp' });
  });

  it('falls back to fetch when navigator has no sendBeacon', () => {
    vi.stubGlobal('navigator', {});
    fireClick();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
