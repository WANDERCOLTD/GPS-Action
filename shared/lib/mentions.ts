/**
 * @build-unit BU-requests-vetting
 * @spec architecture/decision-log.md (D057)
 *
 * @mention parser per BU-requests-vetting brief §confirmed-design-calls.
 *
 * MVP shape: fuzzy match against User.displayName. Username-style
 * strict matching (`@sharon-w`) is parked for future scale.
 *
 * The parser extracts `@<token>` patterns from comment body and
 * resolves each token to a candidate User. Tokens are matched against
 * displayName by:
 *   1. Exact case-insensitive match on first name (most common: "@Sharon")
 *   2. Exact case-insensitive match on full displayName (joined with hyphens)
 *
 * If a token matches multiple candidates, the first match wins. With
 * MVP-scale seed data (5–8 unique displayNames) collisions can't happen.
 *
 * No DB access — pure function. Caller passes the candidate list (e.g.
 * the set of users with reviewer scopes for a Request).
 */

export interface MentionCandidate {
  id: string;
  displayName: string;
}

export interface MentionMatch {
  /** The token as it appeared in the body (without the @). */
  token: string;
  /** The matched user. */
  user: MentionCandidate;
  /** Start index of the @ in the original body. */
  startIndex: number;
  /** Length including the @. */
  length: number;
}

const MENTION_PATTERN = /@([A-Za-z][A-Za-z0-9_-]*)/g;

function normaliseFirstName(displayName: string): string {
  const first = displayName.split(/\s+/)[0] ?? '';
  return first.toLowerCase();
}

function normaliseFullName(displayName: string): string {
  return displayName.replace(/\s+/g, '-').toLowerCase();
}

function tokenMatches(token: string, candidate: MentionCandidate): boolean {
  const t = token.toLowerCase();
  return (
    t === normaliseFirstName(candidate.displayName) ||
    t === normaliseFullName(candidate.displayName)
  );
}

/**
 * Parse @mentions from a comment body. Returns matches in the order
 * they appear; each unresolved token is silently dropped (MVP — no
 * "user not found" error UX).
 */
export function parseMentions(body: string, candidates: MentionCandidate[]): MentionMatch[] {
  const matches: MentionMatch[] = [];
  // Reset regex state — global regex is stateful in JS.
  MENTION_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION_PATTERN.exec(body)) !== null) {
    const token = m[1];
    if (!token) continue;
    const user = candidates.find((c) => tokenMatches(token, c));
    if (!user) continue;
    matches.push({
      token,
      user,
      startIndex: m.index,
      length: m[0].length,
    });
  }
  return matches;
}

/** Convenience: just the unique user IDs that were mentioned (preserves order). */
export function mentionedUserIds(body: string, candidates: MentionCandidate[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of parseMentions(body, candidates)) {
    if (seen.has(match.user.id)) continue;
    seen.add(match.user.id);
    result.push(match.user.id);
  }
  return result;
}
