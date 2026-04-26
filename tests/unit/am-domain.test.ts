/**
 * @build-unit BU-am-link-collapse
 * @spec build/session-briefs/bu-am-link-collapse.md
 *
 * Unit tests for the Activist-Mailer domain detector. Pure
 * function, no exceptions — `false` on parse failure.
 */

import { describe, it, expect } from 'vitest';
import { isActivistMailerDomain } from '@/shared/validation/am-domain';

describe('isActivistMailerDomain', () => {
  it('returns true for a known AM domain', () => {
    expect(isActivistMailerDomain('https://activistmailer.com/c/abc123')).toBe(true);
  });

  it('returns true for an AM subdomain', () => {
    expect(isActivistMailerDomain('https://mail.activistmailer.com/c/abc123')).toBe(true);
  });

  it('returns false for an unrelated domain', () => {
    expect(isActivistMailerDomain('https://example.com/anything')).toBe(false);
  });

  it('returns false on a malformed URL (no throw)', () => {
    expect(isActivistMailerDomain('not a url')).toBe(false);
  });

  it('returns false on an empty string', () => {
    expect(isActivistMailerDomain('')).toBe(false);
  });

  it('matches case-insensitively on host', () => {
    expect(isActivistMailerDomain('https://ActivistMailer.com/x')).toBe(true);
  });
});
