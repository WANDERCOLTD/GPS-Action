# Versioning

**Build Unit:** BU-versioning
**Status:** Active from v0.1.1 onwards.

GPS Action follows a **Rolling PATCH** versioning scheme during pre-launch.
Every merged PR bumps the PATCH segment by at least 1. MINOR / MAJOR
bumps are manual at milestones. The single source of truth is
`package.json`'s `version` field.

---

## The scheme

```
MAJOR.MINOR.PATCH
  0  .  1  .  N
```

| Segment | When it bumps                                                                            | Who bumps        |
| ------- | ---------------------------------------------------------------------------------------- | ---------------- |
| `PATCH` | **Every merged PR.** Author must bump in the PR before merge. CI blocks merge otherwise. | PR author        |
| `MINOR` | Demo / pilot milestones (`0.2.0` = pilot v1, etc.). Manual call.                         | Tech lead / Paul |
| `MAJOR` | Stable v1 launch and beyond. Reserved.                                                   | Tech lead / Paul |

Pre-launch we live in `0.x.y`. The `MAJOR=0` segment communicates
"unstable, breaking changes possible" to anyone reading.

---

## How to bump (every PR)

```sh
# Increment PATCH manually:
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump version to <new>"
```

Or just edit `package.json` directly — `"version": "0.1.42"` →
`"0.1.43"` — and stage as part of any commit in the PR. Either works.

The required minimum is **a different value than the base branch**.
The CI check is string-equality, not semver-comparison — but please
don't be cute. Always increase.

If your PR was rebased and the base now has a higher version than
your bump (someone merged faster), bump again to be one above the
new base. The CI check will tell you if you forgot.

---

## How CI enforces it

`.github/workflows/version-check.yml` runs on every PR targeting
`main`. It reads `package.json` from the base SHA and from the PR
head, compares the `version` strings, and fails the check if they
match. The PR cannot merge until it passes.

The check is intentionally minimal — no dependency on a `semver`
binary, no parsing-to-tuple logic. If you somehow need to bump
_backwards_ (e.g. recovering from a bad publish), you can — the
check only cares that the value changed.

---

## How the version surfaces in the running app

Three surfaces, all driven by the same single source:

| Surface                                         | Reads from                                                                           | Visible to                   | Purpose                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------- | -------------------------------- |
| `<VersionBadge />` (bottom-right of every page) | `process.env.NEXT_PUBLIC_APP_VERSION` (set in `next.config.mjs` from `package.json`) | All users — every env        | "What version am I looking at?"  |
| `/api/healthz` JSON response                    | Same env vars                                                                        | Monitoring, on-call, scripts | Programmatic version detection   |
| Build artefact metadata                         | `package.json` directly                                                              | Deploy tooling               | Tagging, rollback, release notes |

The badge also shows the deploy environment (dev / preview / prod)
and the short git SHA. Colours shift by env so you can see at a
glance which deployment you're on.

---

## Anti-patterns to avoid

- **Two version sources.** Don't add a `VERSION` file or a
  `shared/version.ts` constant. They drift. Read `package.json`.
- **Auto-bumping in a CI commit-as-bot.** Pollutes git history.
  Author bumps as part of the PR, not a follow-up commit.
- **Major bumps for cosmetic changes pre-1.0.** It doesn't matter
  yet, but the habit transfers. Reserve `MAJOR` for genuine breaking
  changes once we hit v1.
- **Skipping the bump because "it's just docs".** Every PR. The
  scheme is "what version was running when this change landed",
  not "what's worth a version bump". Predictability over precision.
- **Bumping by more than +1 PATCH without a reason.** If you jumped
  `0.1.5` → `0.1.20`, write the reason in the PR description.

---

## When this scheme changes

At **v1.0 launch** the scheme switches to **strict semver**:

- `MAJOR` for breaking API / schema / behaviour changes
- `MINOR` for backward-compatible features
- `PATCH` for bug fixes only

Until then, Rolling PATCH wins for predictability.

---

## Related

- `next.config.mjs` — exposes `NEXT_PUBLIC_APP_VERSION`,
  `NEXT_PUBLIC_APP_SHA`, `NEXT_PUBLIC_APP_ENV` to the client
- `components/VersionBadge.tsx` — the on-screen badge
- `app/api/healthz/route.ts` — health endpoint with version metadata
- `.github/workflows/version-check.yml` — CI enforcement
- `CLAUDE.md` "What NOT to do" — bump reminder
