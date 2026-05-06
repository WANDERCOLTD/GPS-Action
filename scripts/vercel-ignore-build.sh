#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" — disables ALL git-triggered Vercel
# deploys. Vercel's free tier caps daily deploys at 100 and we were
# burning through the quota on every preview-per-PR + every merge to
# main, none of which represented a "real" demo refresh request.
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
# Manual deploys still work
# -------------------------
# This script ONLY runs for git-triggered builds (push to a branch
# Vercel watches). The Vercel CLI bypasses it entirely:
#
#   git checkout main && git pull --ff-only
#   pnpm install --frozen-lockfile
#   pnpm exec next build      # produces .next/ locally
#   vercel deploy --prebuilt --prod
#
# That's the canonical path for a real demo refresh. See
# docs/process/vercel-deploy.md Option 2.

set -euo pipefail

echo "[vercel-ignore] git-triggered build (${VERCEL_GIT_COMMIT_REF:-unknown}) — auto-deploy disabled. Run 'vercel deploy --prebuilt --prod' for manual deploys."
exit 0
