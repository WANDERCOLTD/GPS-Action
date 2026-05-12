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
  // Pin Turbopack's workspace root to this checkout (or worktree). Without
  // this, `next dev` from a git worktree spins on the outer project's
  // pnpm-workspace.yaml — module resolution loops and the server pegs CPU
  // without ever serving a page. Safe in the root checkout too: `__dirname`
  // resolves to whichever copy of next.config.mjs is running.
  turbopack: { root: __dirname },
  // Hide the Next.js dev-mode indicator (the black "N" roundel in the
  // corner during `next dev`). It's noise during demo + design review.
  devIndicators: false,
  // Allow LAN-IP / .local / .lan hostnames to reach dev resources.
  // Next 15+ blocks `/_next/...` requests from any origin other than
  // the bound host as a CSRF guard. That breaks iPhone-on-Wi-Fi testing
  // against the Mac dev server: the HTML loads, but JS chunks (the
  // same-origin request from the page) get rejected and the page
  // silently fails to hydrate (no JS, so any button onClick / Dialog
  // / state update simply doesn't fire — the symptom looks like
  // "buttons flash but nothing happens").
  //
  // The previous list pinned a specific LAN IP (`192.168.4.209`), which
  // broke as soon as DHCP reassigned the Mac. Use glob ranges + both
  // mDNS suffixes (`.local` and `.lan`) so this stops being a
  // recurring trap. Dev-only — production builds are unaffected.
  allowedDevOrigins: ['*.local', '*.lan', '192.168.*.*', '10.*.*.*'],
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
  // ESLint config now lives in `eslint.config.js` (flat config). Next 16
  // ignores the `eslint:` key in next.config.mjs and warns at boot, so
  // the previous `eslint: { ignoreDuringBuilds: false }` is removed.
  // Lint runs via `pnpm lint` (and CI), not via `next build`.
};

export default nextConfig;
