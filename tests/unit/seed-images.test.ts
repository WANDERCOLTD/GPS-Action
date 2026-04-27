/**
 * Unit tests for the demo-only hero image allow-list helpers.
 *
 * @build-unit BU-post-hero-demo
 * @spec build/session-briefs/bu-post-hero-demo.md
 * @adr D064
 *
 * The `<HeroImagePicker>` component itself is exercised by manual
 * click-through during DoD (no RTL in this project — see the
 * convention note in `bulk-selector.test.tsx`). What's testable
 * statically is the allow-list shape and the
 * `isAllowedHeroImageUrl` predicate that gates the validator.
 */

import { describe, it, expect } from 'vitest';
import {
  SEED_HERO_IMAGES,
  allowedHeroImageUrls,
  isAllowedHeroImageUrl,
} from '@/shared/seed-images';

describe('SEED_HERO_IMAGES', () => {
  it('exposes exactly 8 images for the demo set', () => {
    expect(SEED_HERO_IMAGES).toHaveLength(8);
  });

  it('every entry has a url and an alt string', () => {
    for (const img of SEED_HERO_IMAGES) {
      expect(typeof img.url).toBe('string');
      expect(img.url.length).toBeGreaterThan(0);
      expect(typeof img.alt).toBe('string');
      expect(img.alt.length).toBeGreaterThan(0);
    }
  });

  it('every URL points to /seed-images/ (demo-bucket convention)', () => {
    for (const img of SEED_HERO_IMAGES) {
      expect(img.url.startsWith('/seed-images/')).toBe(true);
    }
  });

  it('all URLs are unique (no duplicate seed entries)', () => {
    const urls = SEED_HERO_IMAGES.map((i) => i.url);
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
  });
});

describe('allowedHeroImageUrls', () => {
  it('mirrors SEED_HERO_IMAGES as a Set for O(1) lookup', () => {
    expect(allowedHeroImageUrls.size).toBe(SEED_HERO_IMAGES.length);
    for (const img of SEED_HERO_IMAGES) {
      expect(allowedHeroImageUrls.has(img.url)).toBe(true);
    }
  });
});

describe('isAllowedHeroImageUrl', () => {
  it('returns true for a seeded URL', () => {
    expect(isAllowedHeroImageUrl('/seed-images/01.svg')).toBe(true);
  });

  it('returns false for a non-seeded URL with the same prefix', () => {
    expect(isAllowedHeroImageUrl('/seed-images/99.svg')).toBe(false);
  });

  it('returns false for an external URL', () => {
    expect(isAllowedHeroImageUrl('https://example.com/photo.jpg')).toBe(false);
  });

  it('returns false for the empty string', () => {
    expect(isAllowedHeroImageUrl('')).toBe(false);
  });

  it('is case-sensitive (paths are not normalised)', () => {
    // Defence: the validator should not let `/SEED-IMAGES/01.SVG` slip
    // through just because some platforms case-fold.
    expect(isAllowedHeroImageUrl('/SEED-IMAGES/01.SVG')).toBe(false);
  });
});
