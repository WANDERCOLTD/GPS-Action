/**
 * @build-unit BU-whatsapp-share
 * @spec build/session-briefs/bu-whatsapp-share.md
 *
 * Vitest env is `node` — no DOM, no RTL. We invoke the component
 * function directly and walk the returned ReactElement, mirroring
 * the LinkPreviewCard test pattern.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react';
import { WhatsAppShareButton } from '@/components/WhatsAppShareButton';

type AnyElement = ReactElement<Record<string, unknown>>;

function render(props: Parameters<typeof WhatsAppShareButton>[0]): AnyElement {
  return WhatsAppShareButton(props) as AnyElement;
}

const baseProps = {
  postId: '0123456789ab',
  postTitle: 'Sky News bias post',
  postBody: 'Worth pushing back on this one.',
};

describe('WhatsAppShareButton — element shape', () => {
  it('renders an anchor tag', () => {
    const el = render(baseProps);
    expect(el.type).toBe('a');
  });

  it('points at wa.me with a text query param', () => {
    const el = render(baseProps);
    const href = el.props.href as string;
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
  });

  it('encodes the post deep link inside the text param', () => {
    const el = render(baseProps);
    const href = el.props.href as string;
    expect(href).toContain(encodeURIComponent(`/post/${baseProps.postId}`));
  });

  it('opens in a new tab with secure rel', () => {
    const el = render(baseProps);
    expect(el.props.target).toBe('_blank');
    expect(el.props.rel).toBe('noopener noreferrer');
  });

  it('carries the F14 testid and post-id data attribute', () => {
    const el = render(baseProps);
    expect(el.props['data-testid']).toBe('post-share-whatsapp');
    expect(el.props['data-post-id']).toBe(baseProps.postId);
  });

  it('exposes an accessible label', () => {
    const el = render(baseProps);
    expect(el.props['aria-label']).toBe('Forward to WhatsApp');
  });
});

describe('WhatsAppShareButton — click behaviour', () => {
  let stopPropagation: ReturnType<typeof vi.fn>;
  let beaconSpy: ReturnType<typeof vi.fn>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stopPropagation = vi.fn();
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

  function fireClick(): void {
    const el = render(baseProps);
    const onClick = el.props.onClick as (
      event: Partial<ReactMouseEvent<HTMLAnchorElement>>,
    ) => void;
    onClick({ stopPropagation });
  }

  it('stops the click bubbling so the parent PostCard does not navigate', () => {
    fireClick();
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
