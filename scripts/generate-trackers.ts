#!/usr/bin/env tsx
/* eslint-disable no-console -- CLI script: console output is the contract. */

/**
 * @build-unit BU-brief-status-mechanism
 * @spec process/working-rhythm.md
 * @spec architecture/decision-log.md (D068)
 *
 * Reads YAML front-matter from every `docs/build/session-briefs/*.md`
 * and emits the "shipped" + "next BU candidates" AUTOGEN regions in
 * `docs/build/bu-sequence.md`. Single source of truth for brief
 * lifecycle status; eliminates the drift class hit on 2026-04-27
 * (PRs #105, #108, #110).
 *
 * Modes:
 *   npm run trackers        — regenerate AUTOGEN regions in bu-sequence.md
 *   npm run trackers:check  — exit non-zero if regions would change (CI gate)
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const BRIEFS_DIR = join(REPO_ROOT, 'docs/build/session-briefs');
const SEQUENCE_FILE = join(REPO_ROOT, 'docs/build/bu-sequence.md');

interface Brief {
  slug: string;
  status: 'planned' | 'in_progress' | 'shipped' | 'abandoned';
  shipped_in?: string;
  shipped_on?: string;
  priority?: 'high' | 'medium' | 'low';
  phase?: number;
  superseded_by?: string;
  title?: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseFrontMatter(content: string): Record<string, string> | null {
  const match = FRONTMATTER_RE.exec(content);
  if (!match || !match[1]) return null;
  const result: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (m && m[1] && m[2] !== undefined) {
      result[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return result;
}

function readBriefs(): Brief[] {
  const briefs: Brief[] = [];
  for (const file of readdirSync(BRIEFS_DIR).sort()) {
    if (!file.endsWith('.md')) continue;
    const slug = file.replace(/\.md$/, '');
    const content = readFileSync(join(BRIEFS_DIR, file), 'utf8');
    const fm = parseFrontMatter(content);
    if (!fm || !fm.status) {
      console.warn(`[skip] ${slug}: no front-matter`);
      continue;
    }
    const titleMatch = /^# (?:SESSION BRIEF · )?(.+?)(?: —|$)/m.exec(content);
    briefs.push({
      slug,
      status: fm.status as Brief['status'],
      shipped_in: fm.shipped_in,
      shipped_on: fm.shipped_on,
      priority: fm.priority as Brief['priority'],
      phase: fm.phase ? Number(fm.phase) : undefined,
      superseded_by: fm.superseded_by,
      title: titleMatch?.[1]?.trim(),
    });
  }
  return briefs;
}

function shippedTable(briefs: Brief[]): string {
  const shipped = briefs
    .filter((b) => b.status === 'shipped')
    .sort((a, b) => {
      const aPr = Number(a.shipped_in?.replace(/[^0-9]/g, '') ?? 0);
      const bPr = Number(b.shipped_in?.replace(/[^0-9]/g, '') ?? 0);
      return aPr - bPr;
    });
  const rows = shipped.map(
    (b) =>
      `| **${b.slug}** ${b.title ? `— ${b.title}` : ''} | ✅ Merged | ${b.shipped_in ?? '—'} |`,
  );
  return ['| Brief | Status | PR |', '|---|---|---|', ...rows].join('\n');
}

function plannedList(briefs: Brief[]): string {
  const planned = briefs
    .filter((b) => b.status === 'planned' || b.status === 'in_progress')
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 } as const;
      const aP = order[a.priority ?? 'medium'];
      const bP = order[b.priority ?? 'medium'];
      if (aP !== bP) return aP - bP;
      return a.slug.localeCompare(b.slug);
    });
  if (planned.length === 0) return '_No briefs in `planned` or `in_progress` status._';
  return planned
    .map((b) => {
      const tag = b.status === 'in_progress' ? ' (in flight)' : '';
      const prio = b.priority ? ` _[${b.priority}]_` : '';
      return `- **${b.slug}**${tag}${prio}${b.title ? ` — ${b.title}` : ''}`;
    })
    .join('\n');
}

function replaceRegion(source: string, marker: string, body: string): string {
  const re = new RegExp(
    `(<!-- AUTOGEN:${marker}:start -->)[\\s\\S]*?(<!-- AUTOGEN:${marker}:end -->)`,
  );
  if (!re.test(source)) {
    throw new Error(`AUTOGEN markers for "${marker}" not found in bu-sequence.md`);
  }
  return source.replace(re, `$1\n${body}\n$2`);
}

function main(): void {
  const checkMode = process.argv.includes('--check');
  const briefs = readBriefs();
  const original = readFileSync(SEQUENCE_FILE, 'utf8');
  let next = original;
  next = replaceRegion(next, 'shipped', shippedTable(briefs));
  next = replaceRegion(next, 'planned', plannedList(briefs));

  if (checkMode) {
    if (next !== original) {
      console.error('bu-sequence.md AUTOGEN regions are stale. Run `npm run trackers`.');
      process.exit(1);
    }
    console.log('trackers: ok');
    return;
  }

  if (next === original) {
    console.log('trackers: no changes');
    return;
  }
  writeFileSync(SEQUENCE_FILE, next);
  console.log('trackers: regenerated bu-sequence.md');
}

main();
