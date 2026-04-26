/**
 * @build-unit BU-admin-audit-integration
 * @spec architecture/admin-surface.md
 * @spec build/session-briefs/bu-admin-audit-integration.md
 *
 * Unit tests for the diff helper that powers the admin audit
 * pipeline. Confirms the equality, PII strip, and changed-field
 * collection behaviours.
 */

import { describe, it, expect } from 'vitest';
import { computeDiff, stripPii, PII_FIELDS } from '@/server/services/admin/diff';

describe('computeDiff', () => {
  it('returns {} for identical primitive snapshots', () => {
    const before = { id: 'p-1', title: 'Hi', visibility: 'public' };
    expect(computeDiff(before, { ...before })).toEqual({});
  });

  it('returns only the changed fields', () => {
    const before = { id: 'p-1', title: 'Hi', visibility: 'public', body: 'unchanged' };
    const after = {
      id: 'p-1',
      title: 'Hi there',
      visibility: 'authenticated_only',
      body: 'unchanged',
    };
    expect(computeDiff(before, after)).toEqual({
      title: { from: 'Hi', to: 'Hi there' },
      visibility: { from: 'public', to: 'authenticated_only' },
    });
  });

  it('strips PII fields from both sides', () => {
    const before = {
      id: 'u-1',
      displayName: 'Eddie',
      email: 'old@test.com',
      phoneNumber: '+44...',
    };
    const after = {
      id: 'u-1',
      displayName: 'Eddie M',
      email: 'new@test.com',
      phoneNumber: '+44...',
    };
    const diff = computeDiff(before, after);
    expect(diff).toEqual({ displayName: { from: 'Eddie', to: 'Eddie M' } });
    expect(diff).not.toHaveProperty('email');
    expect(diff).not.toHaveProperty('phoneNumber');
  });

  it('treats Dates with the same getTime() as equal', () => {
    const t = new Date('2026-04-26T12:00:00Z');
    const before = { id: 'p-1', createdAt: t };
    const after = { id: 'p-1', createdAt: new Date(t.getTime()) };
    expect(computeDiff(before, after)).toEqual({});
  });

  it('detects array changes via JSON equality', () => {
    const before = { id: 'p-1', groupTags: ['a', 'b'] };
    const after = { id: 'p-1', groupTags: ['a', 'b', 'c'] };
    const diff = computeDiff(before, after);
    expect(diff).toHaveProperty('groupTags');
    expect(diff.groupTags?.from).toEqual(['a', 'b']);
    expect(diff.groupTags?.to).toEqual(['a', 'b', 'c']);
  });

  it('detects nested-object changes via JSON equality', () => {
    const before = { id: 'r-1', context: { type: 'flag', summary: 'X' } };
    const after = { id: 'r-1', context: { type: 'flag', summary: 'Y' } };
    expect(Object.keys(computeDiff(before, after))).toContain('context');
  });

  it('returns {} when only PII fields changed (no-op for forensic purposes)', () => {
    const before = { id: 'u-1', displayName: 'Eddie', email: 'old@test.com' };
    const after = { id: 'u-1', displayName: 'Eddie', email: 'new@test.com' };
    expect(computeDiff(before, after)).toEqual({});
  });

  it('handles a key being added or removed (null fallback)', () => {
    const before = { id: 'p-1', title: 'Hi' };
    const after = { id: 'p-1', title: 'Hi', body: 'New body' };
    const diff = computeDiff(before, after);
    expect(diff.body).toEqual({ from: null, to: 'New body' });
  });
});

describe('stripPii', () => {
  it('removes PII keys from a row snapshot', () => {
    const row = {
      id: 'u-1',
      displayName: 'Eddie',
      email: 'eddie@test.com',
      phoneNumber: '+44',
      ipAddress: '1.2.3.4',
      userAgent: 'Mozilla',
      createdAt: new Date(),
    };
    const stripped = stripPii(row);
    expect(stripped).toHaveProperty('id');
    expect(stripped).toHaveProperty('displayName');
    expect(stripped).toHaveProperty('createdAt');
    expect(stripped).not.toHaveProperty('email');
    expect(stripped).not.toHaveProperty('phoneNumber');
    expect(stripped).not.toHaveProperty('ipAddress');
    expect(stripped).not.toHaveProperty('userAgent');
  });

  it('preserves displayName (not PII)', () => {
    expect(stripPii({ displayName: 'Eddie' })).toEqual({ displayName: 'Eddie' });
  });
});

describe('PII_FIELDS — locked list (Q1)', () => {
  it('contains exactly the four locked fields', () => {
    expect([...PII_FIELDS].sort()).toEqual(['email', 'ipAddress', 'phoneNumber', 'userAgent']);
  });
});
