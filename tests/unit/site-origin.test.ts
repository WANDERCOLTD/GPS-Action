import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSiteOrigin } from '@/shared/site-origin';

describe('getSiteOrigin', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_ORIGIN;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
  });

  afterEach(() => {
    if (originalEnv !== undefined) process.env.NEXT_PUBLIC_SITE_ORIGIN = originalEnv;
    else delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
    vi.unstubAllGlobals();
  });

  it('returns NEXT_PUBLIC_SITE_ORIGIN when set', () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = 'https://gpsaction.org.uk';
    expect(getSiteOrigin()).toBe('https://gpsaction.org.uk');
  });

  it('strips a trailing slash from the env value', () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = 'https://gpsaction.org.uk/';
    expect(getSiteOrigin()).toBe('https://gpsaction.org.uk');
  });

  it('falls back to window.location.origin when env is unset', () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:9999' } });
    expect(getSiteOrigin()).toBe('http://localhost:9999');
  });

  it('falls back to localhost:3001 when neither env nor window is available', () => {
    expect(getSiteOrigin()).toBe('http://localhost:3001');
  });

  it('treats an empty env string as unset', () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = '';
    expect(getSiteOrigin()).toBe('http://localhost:3001');
  });
});
