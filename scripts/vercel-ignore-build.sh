#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" — protects the daily preview-deploy quota
# by skipping builds for changes that don't touch runtime code.
#
# Exit semantics (per Vercel):
#   exit 0 → SKIP this deploy
#   exit 1 → BUILD as normal
#
# Skipped deploys do NOT count against the daily build-rate limit.
#
# How to enable in Vercel (one-time):
#   Project Settings → Git → Ignored Build Step
#   Command: bash scripts/vercel-ignore-build.sh
#
# Without that dashboard config, this script does nothing.
#
# What this skips
# ---------------
#   0a. The `main` branch (production auto-deploys). Since the daily
#       quota is finite and most merges don't need an immediate demo
#       refresh, we deploy main manually via `vercel deploy --prebuilt
#       --prod` per docs/process/vercel-deploy.md Option 2.
#
#   0b. Dependabot branches (`dependabot/...`). Dependency-bump previews
#       consume the daily deploy quota faster than feature work and add
#       no demo-relevant signal.
#
#   1. Changes only inside non-runtime paths:
#        docs/             — design docs, briefs, ADRs, handoffs
#        tests/            — vitest suites (never deployed)
#        .github/          — GitHub Actions config
#        eslint-rules/     — local ESLint plugin (lint-time only)
#        .claude/          — agent worktrees + memory
#        CLAUDE.md         — agent working notes
#        README.md         — repo README
#
#   2. PATCH version bumps. CLAUDE.md mandates a `package.json` version
#      bump on every PR; without this rule, no docs-only PR would ever
#      be skipped. We skip when the only `package.json` /
#      `package-lock.json` change is the `"version"` field.
#
# Anything else (app, components, server, prisma, config, styles,
# public, scripts that aren't tests, etc.) triggers a build.

set -euo pipefail

# Step 0a: skip auto-deploys on `main`. Vercel's free tier caps daily
# deploys at 100, and every merge to main was triggering a build whether
# the demo URL needed a refresh or not. We've moved to manual prod
# deploys via `vercel deploy --prebuilt --prod` (per
# docs/process/vercel-deploy.md Option 2) so the daily quota covers
# genuine demo refreshes, not the steady stream of merges.
if [[ "${VERCEL_GIT_COMMIT_REF:-}" == "main" ]]; then
  echo "[vercel-ignore] main branch — auto-deploy disabled. Run 'vercel deploy --prebuilt --prod' when a demo refresh is needed."
  exit 0
fi

# Step 0b: skip Dependabot preview deploys outright. Dependency-bump PRs
# trigger a preview deploy on every push and consume the "100 deploys
# per day" quota faster than feature work does, often failing at build
# time (preview env vars differ from production), which still consumes
# quota for no signal. The merge to main is blocked by GH checks anyway,
# so a Vercel preview adds nothing here.
if [[ "${VERCEL_GIT_COMMIT_REF:-}" == dependabot/* ]]; then
  echo "[vercel-ignore] dependabot branch (${VERCEL_GIT_COMMIT_REF}) — skipping"
  exit 0
fi

PREV="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$PREV" ]; then
  if git rev-parse HEAD^ >/dev/null 2>&1; then
    PREV="HEAD^"
  else
    echo "[vercel-ignore] no parent + no previous SHA — building"
    exit 1
  fi
fi

# Step 1: are there any changes outside the excluded paths +
# package.json / package-lock.json?
if ! git diff --quiet "$PREV" HEAD -- \
    ':!docs' \
    ':!tests' \
    ':!.github' \
    ':!eslint-rules' \
    ':!.claude' \
    ':!CLAUDE.md' \
    ':!README.md' \
    ':!package.json' \
    ':!package-lock.json'; then
  echo "[vercel-ignore] runtime changes detected — building"
  exit 1
fi

# Step 2: package.json / package-lock.json may have changed. Skip only
# if every changed line is the `version` field.
for file in package.json package-lock.json; do
  if git diff --quiet "$PREV" HEAD -- "$file"; then
    continue
  fi
  # Pull added/removed lines (excluding the +++/--- file headers).
  non_version=$(git diff --no-color "$PREV" HEAD -- "$file" \
    | grep -E '^[+-][^+-]' \
    | grep -vE '^[+-][[:space:]]*"version":[[:space:]]*"[^"]+",?[[:space:]]*$' \
    || true)
  if [ -n "$non_version" ]; then
    echo "[vercel-ignore] non-version change in $file — building"
    exit 1
  fi
done

echo "[vercel-ignore] only docs/tests/CI/version-bump — skipping"
exit 0
