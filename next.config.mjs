/* eslint-disable no-undef -- Node-only build config; `process` is the Node global. */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// BU-versioning — read package.json version + best-effort git SHA at build
// time, expose to the client as NEXT_PUBLIC_* env vars. The badge component
// reads from process.env.* so it stays a pure read of static build metadata.
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

let gitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
if (!gitSha) {
  try {
    gitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // Not in a git checkout (e.g. isolated build) — leave blank
  }
}
const shortSha = gitSha ? gitSha.slice(0, 7) : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Hide the Next.js dev-mode indicator (the black "N" roundel in the
  // corner during `next dev`). It's noise during demo + design review.
  devIndicators: false,
  // BU-versioning — surfaced via NEXT_PUBLIC_ so the client bundle can render
  // the version badge. The CI version-bump check (.github/workflows/
  // version-check.yml) enforces that package.json `version` advances on
  // every PR.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_SHA: shortSha,
    NEXT_PUBLIC_APP_ENV: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  },
  typescript: {
    // Fail build on type errors — no escape hatch
    ignoreBuildErrors: false,
  },
  eslint: {
    // Fail build on lint errors
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
