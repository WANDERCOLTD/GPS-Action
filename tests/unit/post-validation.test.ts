/**
 * Unit tests for post creation Zod validation schema.
 *
 * @build-unit BU-composer
 * @spec product/post-creation-flow.md
 * @spec architecture/decision-log.md (D045)
 *
 * Tests AM URL allowlist, title/body constraints, and visibility defaults.
 */

import { describe, it, expect } from 'vitest';
import { postCreateSchema } from '@/shared/validation/post';

describe('postCreateSchema', () => {
  const validInput = {
    title: 'Test post title',
    body: 'This is a valid body that is long enough',
    visibility: 'public' as const,
  };

  // ── AM URL allowlist ──────────────────────────────────────────────────

  describe('activistMailerUrl', () => {
    it('accepts https://activistmailer.com/...', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        activistMailerUrl: 'https://activistmailer.com/campaigns/123',
      });
      expect(result.success).toBe(true);
    });

    it('accepts https://subdomain.activistmailer.com/...', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        activistMailerUrl: 'https://app.activistmailer.com/campaigns/456',
      });
      expect(result.success).toBe(true);
    });

    it('rejects http (not https)', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        activistMailerUrl: 'http://activistmailer.com/campaigns/123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects malformed URLs', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        activistMailerUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('rejects disallowed domains', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        activistMailerUrl: 'https://evil.com/phishing',
      });
      expect(result.success).toBe(false);
    });

    it('accepts undefined (optional)', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        activistMailerUrl: undefined,
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty string (treated as absent)', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        activistMailerUrl: '',
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Title ──────────────────────────────────────────────────────────────

  describe('title', () => {
    it('trims whitespace', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        title: '  Trimmed title  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Trimmed title');
      }
    });

    it('rejects title shorter than 3 chars after trim', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        title: '  ab  ',
      });
      expect(result.success).toBe(false);
    });

    it('rejects title longer than 200 chars', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        title: 'a'.repeat(201),
      });
      expect(result.success).toBe(false);
    });
  });

  // ── Body ──────────────────────────────────────────────────────────────

  describe('body', () => {
    it('preserves whitespace (no trim)', () => {
      const bodyWithSpaces = '  Body with\n\nline breaks and   spaces  ';
      const result = postCreateSchema.safeParse({
        ...validInput,
        body: bodyWithSpaces,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body).toBe(bodyWithSpaces);
      }
    });

    it('rejects body shorter than 10 chars', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        body: 'Too short',
      });
      expect(result.success).toBe(false);
    });

    it('rejects body longer than 10000 chars', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        body: 'a'.repeat(10001),
      });
      expect(result.success).toBe(false);
    });
  });

  // ── Visibility ────────────────────────────────────────────────────────

  describe('visibility', () => {
    it('defaults to public when omitted', () => {
      const { visibility: _, ...noVisibility } = validInput;
      const result = postCreateSchema.safeParse(noVisibility);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.visibility).toBe('public');
      }
    });

    it('accepts authenticated_only', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        visibility: 'authenticated_only',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid visibility values', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        visibility: 'private',
      });
      expect(result.success).toBe(false);
    });
  });

  // ── Hero image URL (BU-post-hero-demo / D064) ────────────────────────

  describe('heroImageUrl', () => {
    it('accepts a URL from the seeded set', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        heroImageUrl: '/seed-images/01.svg',
      });
      expect(result.success).toBe(true);
    });

    it('accepts null to clear the hero', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        heroImageUrl: null,
      });
      expect(result.success).toBe(true);
    });

    it('accepts an empty string (treated as no hero)', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        heroImageUrl: '',
      });
      expect(result.success).toBe(true);
    });

    it('accepts the field being omitted entirely', () => {
      const result = postCreateSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('rejects a URL that is not in the seeded set', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        heroImageUrl: 'https://malicious.example.com/evil.jpg',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a path that looks similar but is not in the set', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        heroImageUrl: '/seed-images/99.svg',
      });
      expect(result.success).toBe(false);
    });
  });

  // ── Coords + isOnline (BU-post-location-input) ────────────────────────

  describe('latitude / longitude / isOnline', () => {
    it('accepts valid UK-shaped coords + isOnline=false', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        latitude: 53.4808,
        longitude: -2.2426,
        isOnline: false,
      });
      expect(result.success).toBe(true);
    });

    it('accepts isOnline=true with no coords', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        isOnline: true,
      });
      expect(result.success).toBe(true);
    });

    it('accepts both fields omitted entirely', () => {
      const result = postCreateSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('rejects latitude outside [-90, 90]', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        latitude: 91,
        longitude: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects longitude outside [-180, 180]', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        latitude: 0,
        longitude: 181,
      });
      expect(result.success).toBe(false);
    });

    it('accepts null coords (explicit clear)', () => {
      const result = postCreateSchema.safeParse({
        ...validInput,
        latitude: null,
        longitude: null,
      });
      expect(result.success).toBe(true);
    });
  });
});
