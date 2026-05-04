/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4e)
 * @spec build/session-briefs/bu-coordination-board.md
 *
 * Shared "← All boards" link used on every per-group board page.
 * Pulled into its own component so /[groupSlug], /backlog, and /done
 * share the same testid + styling without duplicating the inline JSX.
 */

import Link from 'next/link';

export function BoardBackLink() {
  return (
    <Link
      href="/board"
      data-testid="board-view-back"
      style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--colour-text-link)',
        textDecoration: 'none',
        display: 'inline-block',
        marginBottom: 'var(--space-2)',
      }}
    >
      ← All boards
    </Link>
  );
}
