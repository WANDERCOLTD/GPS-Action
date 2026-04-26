/**
 * Unit tests for the @mention parser.
 *
 * @build-unit BU-requests-vetting
 * @spec architecture/decision-log.md (D057)
 */

import { describe, it, expect } from 'vitest';
import { parseMentions, mentionedUserIds, type MentionCandidate } from '@/shared/lib/mentions';

const CANDIDATES: MentionCandidate[] = [
  { id: 'user-sharon', displayName: 'Sharon Whitfield' },
  { id: 'user-jeremy', displayName: 'Jeremy Kline' },
  { id: 'user-bette', displayName: 'Bette Rosenthal' },
  { id: 'user-cary', displayName: 'Cary Whitfield' },
];

describe('parseMentions', () => {
  it('matches first-name @mention case-insensitively', () => {
    const matches = parseMentions('Hey @Sharon, can you take this?', CANDIDATES);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.user.id).toBe('user-sharon');
  });

  it('matches lowercase first-name', () => {
    const matches = parseMentions('@sharon — pls', CANDIDATES);
    expect(matches[0]?.user.id).toBe('user-sharon');
  });

  it('matches hyphenated full-name token', () => {
    const matches = parseMentions('Cc @sharon-whitfield', CANDIDATES);
    expect(matches[0]?.user.id).toBe('user-sharon');
  });

  it('returns empty when no @mentions', () => {
    const matches = parseMentions('Just a plain comment.', CANDIDATES);
    expect(matches).toHaveLength(0);
  });

  it('extracts multiple mentions in order', () => {
    const matches = parseMentions('@Sharon and @Jeremy please review.', CANDIDATES);
    expect(matches.map((m) => m.user.id)).toEqual(['user-sharon', 'user-jeremy']);
  });

  it('drops unresolved tokens silently', () => {
    const matches = parseMentions('@Sharon and @nobody1234', CANDIDATES);
    expect(matches.map((m) => m.user.id)).toEqual(['user-sharon']);
  });

  it('first match wins on first-name collisions (Sharon Whitfield vs Cary Whitfield)', () => {
    // Both share "Whitfield" surname; @Whitfield is ambiguous but first-name
    // tokens disambiguate. @sharon → Sharon; @cary → Cary.
    expect(parseMentions('@cary', CANDIDATES)[0]?.user.id).toBe('user-cary');
    expect(parseMentions('@sharon', CANDIDATES)[0]?.user.id).toBe('user-sharon');
  });

  it('captures startIndex + length correctly', () => {
    const body = 'Hi @Sharon hello';
    const matches = parseMentions(body, CANDIDATES);
    expect(matches[0]?.startIndex).toBe(3);
    expect(matches[0]?.length).toBe('@Sharon'.length);
  });

  it('does not match standalone @ without a token', () => {
    expect(parseMentions('email me @ later', CANDIDATES)).toHaveLength(0);
  });

  it('mentionedUserIds dedupes repeated mentions', () => {
    const ids = mentionedUserIds('@Sharon and @sharon and @Sharon', CANDIDATES);
    expect(ids).toEqual(['user-sharon']);
  });

  it('mentionedUserIds preserves order across distinct users', () => {
    const ids = mentionedUserIds('@Jeremy then @Sharon', CANDIDATES);
    expect(ids).toEqual(['user-jeremy', 'user-sharon']);
  });
});
