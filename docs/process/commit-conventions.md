<!-- @build-unit F03 -->

# Commit conventions

**Purpose:** Define the commit message format enforced by commitlint +
Husky hooks. Every commit in this repo follows Conventional Commits.

**Enforced by:** `.husky/commit-msg` hook running commitlint on every commit.

---

## Format

```
type(scope): subject
```

- **type** — what kind of change (see table below)
- **scope** — what area of the codebase (optional but encouraged)
- **subject** — imperative, present-tense summary (max 100 chars total header)

Optional body and footer follow a blank line after the subject.

---

## Types

| Type       | When to use                                    | Example                                                |
| ---------- | ---------------------------------------------- | ------------------------------------------------------ |
| `feat`     | New feature or capability                      | `feat(schema): ERD Slice 1.5 — Groups`                 |
| `fix`      | Bug fix                                        | `fix(queue): release expired claims on heartbeat miss` |
| `chore`    | Maintenance, cleanup, dependency updates       | `chore: post-F06 cleanup`                              |
| `docs`     | Documentation only                             | `docs(build): F03 session brief`                       |
| `style`    | Formatting (rare — usually automated by hooks) | `style: fix trailing whitespace in templates`          |
| `refactor` | Code restructure without behaviour change      | `refactor(services): extract shared validation helper` |
| `test`     | Adding or updating tests                       | `test(schema): add Slice 1.5 smoke assertions`         |
| `perf`     | Performance improvement                        | `perf(queue): add covering index for claim lookup`     |
| `ci`       | CI/CD configuration changes                    | `ci: add migration validation workflow`                |
| `build`    | Build system or external dependency changes    | `build: upgrade Prisma to 5.23`                        |
| `revert`   | Reverting a previous commit                    | `revert: feat(schema) — remove experimental field`     |

---

## Scopes we use

Scopes are freeform but should be consistent. Common scopes in this repo:

- `schema` — Prisma schema changes
- `lint` — ESLint rules and config
- `build` — build infrastructure, Phase 0 foundations
- `queue` — work item queue system
- `admin` — admin surface
- `auth` — authentication
- `ui` — user interface components

---

## Rules enforced by commitlint

| Rule                | Setting | Rationale                                         |
| ------------------- | ------- | ------------------------------------------------- |
| `type-enum`         | On      | Must be one of the types above                    |
| `type-empty`        | On      | Type is required                                  |
| `subject-empty`     | On      | Subject is required                               |
| `subject-case`      | Off     | We mix cases; both are readable                   |
| `header-max-length` | 100     | GitHub displays well at 100; our scopes need room |

Body and footer rules use the default (lenient) settings.

---

## Examples from this repo

```
feat(schema): ERD Slice 1.5 — Groups (Group, GroupMembership, WorkItem.groupTags)
feat(lint): F06 — 5 custom ESLint rules for traceability + safety enforcement
chore: post-F06 cleanup — Ping removal, scaffold headers, rule refinements
docs: fix gitignore for docs/build/ + commit session briefs
chore(build): F03 — Husky pre-commit hooks + commitlint
```

---

## Bypassing hooks

Use `--no-verify` to skip hooks in emergencies:

```bash
git commit --no-verify -m "fix: emergency hotfix"
```

Use sparingly. If you bypass, CI will still catch violations on the PR.

---

## What the pre-commit hook does

The pre-commit hook runs lint-staged, which:

1. **`*.{ts,tsx,js,jsx}`** — ESLint `--fix` then Prettier `--write`
2. **`*.{md,json,css}`** — Prettier `--write`

Only staged files are checked. The hook is fast (<5 seconds typical).

Prisma files (`*.prisma`) are excluded — use `npx prisma format` for those.

---

## Setup for new developers

After cloning the repo:

```bash
npm install    # triggers `prepare` script which sets up Husky
```

That's it. Hooks are active immediately.

---

## What this doc does NOT cover

1. **CI checks.** CI runs independently; hooks are the local safety net.
2. **Pre-push hooks.** Phase 2 — not needed MVP.
3. **Signed commits.** Developer choice; not enforced.
4. **Automated changelog.** Not needed MVP; the format enables it later.
