#!/usr/bin/env tsx
/* eslint-disable no-console -- CLI script: console output is the contract. */

/**
 * @build-unit BU-brief-status-mechanism
 * @spec architecture/decision-log.md (D068)
 *
 * CI gate. If the PR title or any commit message on the branch contains a
 * literal `BU-<slug>` reference matching an existing brief, verify the
 * brief's `status:` flipped to `shipped` in this PR's diff. Fails otherwise.
 * Mirrors version-check.yml's enforcement model.
 *
 * Detection scope: PR title + commit messages (`git log base..head`).
 * **Not** the PR body — descriptive prose there often mentions slugs
 * without intending to ship them (B15 follow-up surfaced this in PR #118
 * / #119). The signal we want is commit-style intent, not free-text
 * references.
 *
 * Reads env: PR_TITLE, BASE_SHA, HEAD_SHA. (PR_BODY no longer consulted.)
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';

const BRIEFS_DIR = 'docs/build/session-briefs';

function discoverSlugs(): Set<string> {
  return new Set(
    readdirSync(BRIEFS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, '')),
  );
}

function extractBuRefs(text: string, knownSlugs: Set<string>): string[] {
  // Strict: only match `BU-<kebab>` with explicit `BU-` prefix.
  // Case-insensitive on the prefix but the captured slug is lowercased.
  // Casual prose like "we should verify bu-foo's state" still matches because
  // `\bbu-foo\b` is also legal — but we only call this on PR title + commit
  // messages, where commit-style intent dominates and casual prose is rare.
  const matches = new Set<string>();
  const buRe = /\bBU-([a-z0-9][a-z0-9-]*)\b/gi;
  for (const m of text.matchAll(buRe)) {
    if (!m[1]) continue;
    const slug = `bu-${m[1].toLowerCase()}`;
    if (knownSlugs.has(slug)) matches.add(slug);
  }
  return [...matches];
}

function commitMessages(base: string, head: string): string {
  try {
    return execSync(`git log ${base}..${head} --format=%B`, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function diffContainsFlip(slug: string, base: string, head: string): boolean {
  const path = `${BRIEFS_DIR}/${slug}.md`;
  if (!existsSync(path)) return false;
  let diff: string;
  try {
    diff = execSync(`git diff ${base}..${head} -- ${path}`, { encoding: 'utf8' });
  } catch {
    return false;
  }
  // Look for added line `+status: shipped` and (separately) `-status: <not shipped>`
  const addedShipped = /\n\+status:\s*shipped\b/.test(diff);
  return addedShipped;
}

function alreadyShippedOnBase(slug: string, base: string): boolean {
  const path = `${BRIEFS_DIR}/${slug}.md`;
  try {
    const content = execSync(`git show ${base}:${path}`, { encoding: 'utf8' });
    return /^status:\s*shipped\b/m.test(content);
  } catch {
    return false;
  }
}

function main(): void {
  const title = process.env.PR_TITLE ?? '';
  const base = process.env.BASE_SHA;
  const head = process.env.HEAD_SHA;
  if (!base || !head) {
    console.error('Missing BASE_SHA / HEAD_SHA — running outside CI?');
    process.exit(1);
  }

  const knownSlugs = discoverSlugs();
  const haystack = `${title}\n${commitMessages(base, head)}`;
  const refs = extractBuRefs(haystack, knownSlugs);

  if (refs.length === 0) {
    console.log('No BU-* refs in PR title or commit messages. Skipping ship-flip check.');
    return;
  }

  console.log(`Detected BU refs: ${refs.join(', ')}`);

  const failures: string[] = [];
  for (const slug of refs) {
    if (alreadyShippedOnBase(slug, base)) {
      console.log(`  ${slug}: already shipped on base — no flip required.`);
      continue;
    }
    if (!diffContainsFlip(slug, base, head)) {
      failures.push(slug);
    }
  }

  if (failures.length > 0) {
    console.error(
      `\n::error::Ship-flip missing for: ${failures.join(', ')}\n` +
        `Each referenced brief's front-matter must add \`status: shipped\` in this PR.\n` +
        `Edit docs/build/session-briefs/<slug>.md and re-run \`npm run trackers\`.`,
    );
    process.exit(1);
  }

  console.log(`All ${refs.length} BU ref(s) flipped to shipped.`);
}

main();
