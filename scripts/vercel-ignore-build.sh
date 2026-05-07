#!/usr/bin/env bash
#
# Vercel Ignored Build Step gate. Configured in:
#   Vercel project → Settings → Git → "Ignored Build Step"
#
# Exit semantics (Vercel's contract, not ours):
#   exit 0 → SKIP the build (no deploy)
#   exit 1 → PROCEED with the build
#
# Policy: only the `release` branch deploys. Everything else — main,
# dependabot/*, feat/*, fix/*, chore/* — gets a silent skip. The
# release-branch model means deploys happen only when we intentionally
# fast-forward `release` to main's HEAD; routine commits don't burn
# `api-deployments-free-per-day` (100/day on Hobby) or
# `api-upload-free` (5000 files/day) quotas.
#
# `VERCEL_GIT_COMMIT_REF` is set by Vercel to the branch being
# considered for deploy (e.g. "release", "main", "feat/foo").
#
# To deploy on demand:
#   git fetch origin
#   git push origin origin/main:release
#
# To roll back:
#   git push origin <prev-good-sha>:release --force

set -euo pipefail

if [ "${VERCEL_GIT_COMMIT_REF:-}" = "release" ]; then
  echo "Branch is 'release' — proceeding with build."
  exit 1
fi

echo "Branch '${VERCEL_GIT_COMMIT_REF:-<unset>}' is not 'release' — skipping build."
exit 0
