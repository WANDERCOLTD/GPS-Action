---
description: Write a session handoff doc for the next CC session and push it
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

You are wrapping up the current session. Write a handoff doc that lets the next session continue cleanly without you in the room.

User-supplied context (may be empty): $ARGUMENTS

## Steps

### 1. Verify location

```bash
git branch --show-current && git rev-parse --show-toplevel
```

If the path doesn't end in `.claude/worktrees/<slug>/`, surface that and stop — handoffs from the root checkout violate the worktree rule (CLAUDE.md "Session hygiene"). The user should re-run from a worktree.

### 2. Derive handoff slug from the branch name

| Branch pattern            | Slug                                   |
| ------------------------- | -------------------------------------- |
| `feat/bu-<name>-YYYYMMDD` | `bu-<name>`                            |
| `fix/<name>`              | `<name>` (drop date suffix if present) |
| `chore/<name>-YYYYMMDD`   | `<name>`                               |
| `docs/<name>`             | `<name>`                               |
| Anything else             | Ask the user for the slug              |

### 3. Determine the target file

`docs/build/session-handoffs/<slug>-<YYYY-MM-DD>.md`

If the file already exists, you're appending a second handoff for the same day — add a `## Session N` heading and append. Otherwise, create new.

### 4. Gather context (run in parallel where possible)

| Source                                                                                                                 | Why                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `git log --oneline ^origin/main` (this branch only)                                                                    | Commits made on this branch                                                                 |
| `git status --short`                                                                                                   | Anything dirty / uncommitted                                                                |
| `git fetch origin main && git log origin/main..HEAD --oneline -1; git log HEAD..origin/main --oneline -3`              | How far ahead/behind main                                                                   |
| `gh pr list --state open --author "@me" --limit 10`                                                                    | Current PR landscape                                                                        |
| `docs/build/session-briefs/<slug>.md` (if exists)                                                                      | Brief scope, "Build in this session" list, "Risks / known gotchas", "Files this BU touches" |
| Last gate run (`npm run typecheck && npm run lint && npm test && npm run trace:check && npm run check:reference-data`) | If not run in this session, or working tree is dirty, run it                                |
| `git stash list`                                                                                                       | Any preserved state worth flagging                                                          |

### 5. Write the handoff doc

Use this skeleton. Omit sections that are N/A (don't leave empty headings).

```markdown
# Session handoff — <slug> (Phase N if applicable)

**Date:** YYYY-MM-DD (morning/afternoon/evening session)
**Branch:** `<branch-name>` (worktree at `.claude/worktrees/<wt-slug>/`)
**Last commit:** `<short-sha>` — <subject>
**Pushed to origin:** ✅ yes / ❌ no

The next session reads this handoff **and** the brief at
`docs/build/session-briefs/<slug>.md`. Both are needed for context.

---

## Current state

### What's shipped on this branch

| File | Status     |
| ---- | ---------- |
| ...  | ✅ summary |

### What's NOT yet built

(Lift directly from the brief's "Build in this session" minus what's shipped.)

- ❌ ...
- ❌ ...

---

## CRITICAL: Pre-steps for the next session

1. **Rebase if behind main.** Show the exact commands and expected conflicts.
2. **Any compat fixes** (Prisma upgrades, breaking deps, etc.) the next session should expect.
3. **Naming/numbering** changes that happened mid-session (e.g. D071 → D072 collision).

---

## Suggested next-session sequence

(From the brief's commit plan or your own sequencing if no brief.)

1. ...
2. ...

Each step a separate commit per CLAUDE.md "commit per logical chunk".

---

## Known gotchas / risks

(Lift from brief's "Risks / known gotchas" + anything you discovered this session.)

- ...

---

## Open PRs at handoff time

| PR   | Status | Notes |
| ---- | ------ | ----- |
| #NNN | ...    | ...   |

---

## What I would have done next if context allowed

(One paragraph + estimate of remaining work.)
```

### 6. Commit + push

Stage only the handoff file. Commit message:

```
docs(handoff): <slug> — <one-line summary>

<2-3 line body summarising what's done and what's pending>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Push the branch (no `--force`).

### 7. Report to the user

Brief one-screen summary:

|                       |                                                |
| --------------------- | ---------------------------------------------- |
| Handoff doc           | `docs/build/session-handoffs/<slug>-<date>.md` |
| Commit                | `<sha>` (pushed)                               |
| Branch                | `<branch>`                                     |
| % complete (rough)    | ...                                            |
| Next-session pre-step | rebase / nothing / other                       |

End with **restart needed?** (yes/no with reason) per the post-merge protocol.

## Notes

- The handoff is **not** a PR. It commits to the working branch and pushes; it does not open a PR.
- **Do not** write a handoff doc when work is fully complete — open the PR instead. Handoff is for incomplete work that needs continuation.
- **Honest copy.** Don't claim "all green" if a gate failed; surface the failure. Don't say "ready to ship" if the brief's DoD isn't met.
- If `$ARGUMENTS` is provided, integrate it into "What I would have done next" or a dedicated "User notes" subsection. The user uses this to flag specific things they want the next session to see.
