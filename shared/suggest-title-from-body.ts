/**
 * @build-unit BU-one-click-polish
 * @spec build/session-briefs/bu-one-click-polish.md
 *
 * Pure helper for the composer's "suggest a title from the body's
 * first sentence" affordance. No side effects, no DOM access — safe
 * to import from both server (validation) and client (PostForm).
 *
 * Rules:
 *   1. Trim leading/trailing whitespace from the body.
 *   2. Take the prefix up to (but not including) the first `.`, `!`,
 *      `?`, or newline — whichever comes first.
 *   3. Trim that prefix.
 *   4. Cap to MAX_LEN characters; truncation breaks at the last
 *      whitespace inside the cap so a half-word doesn't survive.
 *   5. Return '' when the body is whitespace-only or the prefix is
 *      empty after trimming. Caller decides what '' means
 *      (typically: "do nothing").
 */

const MAX_LEN = 80;

export function suggestTitleFromBody(body: string): string {
  if (typeof body !== 'string') return '';
  const trimmed = body.trim();
  if (trimmed.length === 0) return '';

  // First-sentence boundary: scan for the earliest of `.`, `!`, `?`,
  // `\n`. If none is present, the whole body is the candidate.
  const stops = ['.', '!', '?', '\n'];
  let firstStop = trimmed.length;
  for (const ch of stops) {
    const idx = trimmed.indexOf(ch);
    if (idx >= 0 && idx < firstStop) firstStop = idx;
  }
  let candidate = trimmed.slice(0, firstStop).trim();
  if (candidate.length === 0) return '';

  if (candidate.length > MAX_LEN) {
    const slice = candidate.slice(0, MAX_LEN);
    // Break at the last whitespace in the cap so we don't truncate
    // mid-word. If there's no whitespace (single very long word),
    // fall through to the hard cap.
    const lastSpace = slice.lastIndexOf(' ');
    candidate = lastSpace > 0 ? slice.slice(0, lastSpace).trimEnd() : slice;
  }

  return candidate;
}
