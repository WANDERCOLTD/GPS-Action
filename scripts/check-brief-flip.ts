#!/usr/bin/env tsx
/* eslint-disable no-console -- CLI script: console output is the contract. */

/**
 * @build-unit BU-brief-status-mechanism
 * @spec architecture/decision-log.md (D068)
 *
 * CI gate. If the PR title or body references `BU-<slug>` matching an
 * existing brief, verify the brief's `status:` flipped to `shipped` in
 * this PR's diff. Fails otherwise. Mirrors version-check.yml's
 * enforcement model.
 *
 * Reads env: PR_TITLE, PR_BODY, BASE_SHA, HEAD_SHA.
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
  const matches = new Set<string>();
  // Match BU-<slug>, F<NN>, or erd-slice-<n>(-<n>)? — anything that maps to a brief slug.
  const re = /\b(?:BU-|F)?[a-z0-9-]+(?:-[a-z0-9-]+)*\b/gi;
  for (const raw of text.match(re) ?? []) {
    const lower = raw.toLowerCase();
    // Try as-is, with bu- prefix, and as f-rule prefix
    const candidates = [lower, `bu-${lower}`, `bu-${lower.replace(/^bu-/, '')}`];
    for (const c of candidates) {
      if (knownSlugs.has(c)) {
        matches.add(c);
        break;
      }
    }
  }
  return [...matches];
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

function main(): void {
  const title = process.env.PR_TITLE ?? '';
  const body = process.env.PR_BODY ?? '';
  const base = process.env.BASE_SHA;
  const head = process.env.HEAD_SHA;
  if (!base || !head) {
    console.error('Missing BASE_SHA / HEAD_SHA — running outside CI?');
    process.exit(1);
  }

  const knownSlugs = discoverSlugs();
  const refs = extractBuRefs(`${title}\n${body}`, knownSlugs);

  if (refs.length === 0) {
    console.log('No BU-* refs in PR title/body. Skipping ship-flip check.');
    return;
  }

  console.log(`Detected BU refs: ${refs.join(', ')}`);

  const failures: string[] = [];
  for (const slug of refs) {
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
