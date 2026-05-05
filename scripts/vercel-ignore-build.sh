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
