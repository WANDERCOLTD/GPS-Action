/**
 * @build-unit BU-whatsapp-share
 * @spec build/session-briefs/bu-whatsapp-share.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSiteOrigin } from '@/shared/site-origin';

const ORIGINAL_ORIGIN_ENV = process.env.NEXT_PUBLIC_SITE_ORIGIN;

describe('getSiteOrigin', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
  });

  afterEach(() => {
    if (ORIGINAL_ORIGIN_ENV === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
    } else {
      process.env.NEXT_PUBLIC_SITE_ORIGIN = ORIGINAL_ORIGIN_ENV;
    }
  });

  it('returns the env var when set', () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = 'https://gpsaction.org';
    expect(getSiteOrigin()).toBe('https://gpsaction.org');
  });

  it('strips a trailing slash from the env value', () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = 'https://gpsaction.org/';
    expect(getSiteOrigin()).toBe('https://gpsaction.org');
  });

  it('falls back to the dev origin when no env and no window', () => {
    expect(getSiteOrigin()).toBe('http://localhost:3001');
  });

  it('ignores an empty env string', () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = '';
    expect(getSiteOrigin()).toBe('http://localhost:3001');
  });
});
