#!/usr/bin/env tsx
/* eslint-disable no-console -- CLI script: console output is the contract. */

/**
 * @build-unit BU-trace
 * @spec process/traceability.md
 * @spec architecture/decision-log.md (D038, D053)
 *
 * Materialised traceability matrix per D038 §6. Three modes:
 *   - npm run trace <id>      single-ID lookup (forward + reverse)
 *   - npm run trace:check     CI guard — broken refs / missing scenario coverage
 *   - npm run trace:matrix    regenerate docs/architecture/traceability-matrix.md
 *
 * Reads (read-only):
 *   - docs/product/scenarios.md      (SCN-N IDs + @no-code-yet markers)
 *   - docs/architecture/decision-log.md  (D-numbers, both heading styles)
 *   - app/, components/, server/, shared/, prisma/  (@build-unit / @spec / @scenarios tags)
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Types ────────────────────────────────────────────────────────────────

interface Scenario {
  id: string; // "SCN-1", "SCN-20"
  num: number;
  title: string;
  noCodeYet: boolean;
}

interface ADR {
  id: string; // "D050"
  num: number;
  title: string;
}

interface SpecRef {
  /** "product/scenarios.md" or "architecture/decision-log.md" or other */
  specPath: string;
  /** "SCN-3", "D050", or undefined when ref-less */
  ref?: string;
}

interface CodeFile {
  /** Repo-relative path */
  path: string;
  buildUnits: string[];
  specs: SpecRef[];
  /** Legacy @scenarios SCN-N tags (deprecated, warn-only) */
  legacyScenarios: string[];
}

interface BuildUnit {
  id: string; // "BU-comments", "BU-001-lite"
  files: string[]; // repo-relative paths
  scenarios: string[]; // SCN-Ns from referenced files
  adrs: string[]; // D-Ns from referenced files
}

interface TraceGraph {
  scenarios: Map<string, Scenario>; // SCN-N → Scenario
  adrs: Map<string, ADR>; // D-N → ADR
  files: CodeFile[];
  buildUnits: Map<string, BuildUnit>;
  /** Reverse: SCN-N → list of file paths that @spec it */
  filesByScenario: Map<string, string[]>;
  /** Reverse: D-N → list of file paths that @spec it */
  filesByADR: Map<string, string[]>;
  /** Reverse: BU name → list of file paths with that @build-unit */
  filesByBU: Map<string, string[]>;
}

// ── Constants ────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, '..');
const SCENARIOS_PATH = 'docs/product/scenarios.md';
const DECISION_LOG_PATH = 'docs/architecture/decision-log.md';
const MATRIX_PATH = 'docs/architecture/traceability-matrix.md';
const SOURCE_DIRS = ['app', 'components', 'server', 'shared', 'prisma'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js']);
const EXCLUDED_PATH_FRAGMENTS = ['node_modules', '.next', 'dist', 'build', '.claude/worktrees'];

// ── Parsers ──────────────────────────────────────────────────────────────

const SCENARIO_HEADING_RE = /^### Scenario (\d+)\b\s*(.*?)$/;
const NO_CODE_YET_RE = /<!--\s*@no-code-yet\s*-->/;

export function parseScenarios(markdown: string): Scenario[] {
  const lines = markdown.split('\n');
  const out: Scenario[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const match = SCENARIO_HEADING_RE.exec(line);
    if (!match) continue;

    const num = Number(match[1]);
    let title = (match[2] ?? '').trim();
    // Title often starts with "— " — strip
    if (title.startsWith('—')) title = title.slice(1).trim();

    // Look at the next ~3 lines for the @no-code-yet marker
    let noCodeYet = false;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j += 1) {
      if (NO_CODE_YET_RE.test(lines[j] ?? '')) {
        noCodeYet = true;
        break;
      }
    }

    out.push({ id: `SCN-${num}`, num, title, noCodeYet });
  }

  return out;
}

const ADR_HEADING_RES = [
  /^### D(\d{2,3})\s*·\s*(.*?)$/, // ### D050 · Title
  /^# D(\d{2,3})\s*[—-]\s*(.*?)$/, // # D050 — Title  OR  # D050 - Title
];

export function parseADRs(markdown: string): ADR[] {
  const lines = markdown.split('\n');
  const out: ADR[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    for (const re of ADR_HEADING_RES) {
      const match = re.exec(line);
      if (!match) continue;

      const num = Number(match[1]);
      const id = `D${String(num).padStart(3, '0')}`;
      if (seen.has(id)) continue;
      seen.add(id);

      out.push({ id, num, title: (match[2] ?? '').trim() });
      break;
    }
  }

  return out;
}

const BUILD_UNIT_RE = /@build-unit\s+([A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+)*)/;
const SPEC_RE = /@spec\s+(\S+?)(?:\s+\(([^)]+)\))?(?:\s|$)/g;
const LEGACY_SCENARIOS_RE = /@scenarios\s+(SCN-\d+(?:\s*,\s*SCN-\d+)*)/g;

export function parseFileTags(content: string): {
  buildUnits: string[];
  specs: SpecRef[];
  legacyScenarios: string[];
} {
  // Only look at the first 30 non-blank lines (header zone)
  const lines = content.split('\n');
  let scanned = '';
  let nonBlankCount = 0;
  for (const line of lines) {
    if (line.trim() === '') {
      scanned += '\n';
      continue;
    }
    scanned += line + '\n';
    nonBlankCount += 1;
    if (nonBlankCount >= 30) break;
  }

  // @build-unit can list multiple BUs space-separated: "BU-feed BU-comments"
  const buildUnits: string[] = [];
  const buMatch = BUILD_UNIT_RE.exec(scanned);
  if (buMatch) {
    const value = buMatch[1] ?? '';
    for (const tok of value.split(/\s+/)) {
      if (tok.length > 0) buildUnits.push(tok);
    }
  }

  const specs: SpecRef[] = [];
  let m: RegExpExecArray | null;
  // Reset lastIndex (regex with /g)
  SPEC_RE.lastIndex = 0;
  while ((m = SPEC_RE.exec(scanned)) !== null) {
    const specPath = (m[1] ?? '').replace(/^['"]|['"]$/g, '');
    if (specPath === '') continue;
    const refRaw = m[2];
    if (refRaw && refRaw.trim() !== '') {
      // Could be "SCN-3", "D050", "D045, D048", etc.
      for (const tok of refRaw.split(/\s*,\s*/)) {
        const ref = tok.trim();
        if (ref) specs.push({ specPath, ref });
      }
    } else {
      specs.push({ specPath });
    }
  }

  const legacyScenarios: string[] = [];
  LEGACY_SCENARIOS_RE.lastIndex = 0;
  while ((m = LEGACY_SCENARIOS_RE.exec(scanned)) !== null) {
    const value = m[1] ?? '';
    for (const tok of value.split(/\s*,\s*/)) {
      const id = tok.trim();
      if (id) legacyScenarios.push(id);
    }
  }

  return { buildUnits, specs, legacyScenarios };
}

// ── File walking ─────────────────────────────────────────────────────────

function walkSource(rootDir: string): string[] {
  const out: string[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (EXCLUDED_PATH_FRAGMENTS.some((frag) => entry === frag || dir.includes(frag))) continue;
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile()) {
        const dot = entry.lastIndexOf('.');
        if (dot < 0) continue;
        const ext = entry.slice(dot);
        if (SOURCE_EXTENSIONS.has(ext)) out.push(full);
      }
    }
  }

  walk(rootDir);
  return out.sort();
}

// ── Graph builder ────────────────────────────────────────────────────────

export function buildGraph(input: {
  scenariosMd: string;
  decisionLogMd: string;
  files: { path: string; content: string }[];
}): TraceGraph {
  const scenarios = new Map<string, Scenario>();
  for (const s of parseScenarios(input.scenariosMd)) scenarios.set(s.id, s);

  const adrs = new Map<string, ADR>();
  for (const a of parseADRs(input.decisionLogMd)) adrs.set(a.id, a);

  const files: CodeFile[] = [];
  const filesByScenario = new Map<string, string[]>();
  const filesByADR = new Map<string, string[]>();
  const filesByBU = new Map<string, string[]>();

  for (const file of input.files) {
    const tags = parseFileTags(file.content);
    if (
      tags.buildUnits.length === 0 &&
      tags.specs.length === 0 &&
      tags.legacyScenarios.length === 0
    ) {
      continue;
    }

    files.push({
      path: file.path,
      buildUnits: tags.buildUnits,
      specs: tags.specs,
      legacyScenarios: tags.legacyScenarios,
    });

    for (const bu of tags.buildUnits) {
      const arr = filesByBU.get(bu) ?? [];
      arr.push(file.path);
      filesByBU.set(bu, arr);
    }

    for (const spec of tags.specs) {
      if (!spec.ref) continue;
      if (spec.specPath.includes('scenarios.md') && /^SCN-\d+$/.test(spec.ref)) {
        // Normalise leading zeros: SCN-01 → SCN-1
        const id = `SCN-${Number(spec.ref.slice(4))}`;
        const arr = filesByScenario.get(id) ?? [];
        arr.push(file.path);
        filesByScenario.set(id, arr);
      } else if (spec.specPath.includes('decision-log.md') && /^D\d{2,3}$/.test(spec.ref)) {
        const id = `D${String(Number(spec.ref.slice(1))).padStart(3, '0')}`;
        const arr = filesByADR.get(id) ?? [];
        arr.push(file.path);
        filesByADR.set(id, arr);
      }
    }

    for (const scn of tags.legacyScenarios) {
      const id = `SCN-${Number(scn.replace(/^SCN-/, ''))}`;
      const arr = filesByScenario.get(id) ?? [];
      arr.push(file.path);
      filesByScenario.set(id, arr);
    }
  }

  const buildUnits = new Map<string, BuildUnit>();
  for (const [bu, paths] of filesByBU) {
    const scenarioSet = new Set<string>();
    const adrSet = new Set<string>();
    for (const p of paths) {
      const file = files.find((f) => f.path === p);
      if (!file) continue;
      for (const spec of file.specs) {
        if (!spec.ref) continue;
        if (spec.specPath.includes('scenarios.md') && /^SCN-\d+$/.test(spec.ref)) {
          scenarioSet.add(`SCN-${Number(spec.ref.slice(4))}`);
        } else if (spec.specPath.includes('decision-log.md')) {
          adrSet.add(`D${String(Number(spec.ref.slice(1))).padStart(3, '0')}`);
        }
      }
      for (const scn of file.legacyScenarios) {
        scenarioSet.add(`SCN-${Number(scn.replace(/^SCN-/, ''))}`);
      }
    }
    buildUnits.set(bu, {
      id: bu,
      files: [...paths].sort(),
      scenarios: [...scenarioSet].sort((a, b) => Number(a.slice(4)) - Number(b.slice(4))),
      adrs: [...adrSet].sort(),
    });
  }

  return { scenarios, adrs, files, buildUnits, filesByScenario, filesByADR, filesByBU };
}

// ── Modes: lookup, check, matrix ─────────────────────────────────────────

function printLookup(graph: TraceGraph, id: string): void {
  // SCN-N
  if (/^SCN-\d+$/.test(id)) {
    const scenario = graph.scenarios.get(id);
    if (!scenario) {
      console.error(`Scenario ${id} not found.`);
      process.exit(2);
    }
    const files = graph.filesByScenario.get(id) ?? [];
    const buSet = new Set<string>();
    const adrSet = new Set<string>();
    for (const p of files) {
      const f = graph.files.find((x) => x.path === p);
      if (!f) continue;
      for (const bu of f.buildUnits) buSet.add(bu);
      for (const s of f.specs) {
        if (s.ref && s.specPath.includes('decision-log.md')) {
          adrSet.add(`D${String(Number(s.ref.slice(1))).padStart(3, '0')}`);
        }
      }
    }
    console.log(`${id} — ${scenario.title}`);
    if (scenario.noCodeYet) console.log(`  (parked: @no-code-yet)`);
    console.log('');
    console.log(`  Build Units (${buSet.size}):`);
    [...buSet].sort().forEach((b) => console.log(`    ${b}`));
    console.log('');
    console.log(`  ADRs (${adrSet.size}):`);
    [...adrSet].sort().forEach((a) => console.log(`    ${a}`));
    console.log('');
    console.log(`  Code files (${files.length}):`);
    [...files].sort().forEach((f) => console.log(`    ${f}`));
    console.log('');
    if (files.length === 0 && !scenario.noCodeYet) {
      console.log(`  ⚠ Coverage gap: 0 backing code files and no @no-code-yet marker.`);
    } else if (files.length === 0) {
      console.log(`  Coverage: parked (no code expected yet).`);
    } else {
      console.log(`  Coverage: ✓ ${files.length} backing code file(s).`);
    }
    return;
  }

  // D-NNN
  if (/^D\d{2,3}$/.test(id)) {
    const norm = `D${String(Number(id.slice(1))).padStart(3, '0')}`;
    const adr = graph.adrs.get(norm);
    if (!adr) {
      console.error(`ADR ${id} not found.`);
      process.exit(2);
    }
    const files = graph.filesByADR.get(norm) ?? [];
    console.log(`${norm} — ${adr.title}`);
    console.log('');
    console.log(`  Code files (${files.length}):`);
    [...files].sort().forEach((f) => console.log(`    ${f}`));
    return;
  }

  // BU-name
  if (/^BU-/.test(id)) {
    const bu = graph.buildUnits.get(id);
    if (!bu) {
      console.error(`Build Unit ${id} not found.`);
      process.exit(2);
    }
    console.log(`${id}`);
    console.log('');
    console.log(`  Scenarios (${bu.scenarios.length}):`);
    bu.scenarios.forEach((s) => console.log(`    ${s} — ${graph.scenarios.get(s)?.title ?? '?'}`));
    console.log('');
    console.log(`  ADRs (${bu.adrs.length}):`);
    bu.adrs.forEach((a) => console.log(`    ${a} — ${graph.adrs.get(a)?.title ?? '?'}`));
    console.log('');
    console.log(`  Code files (${bu.files.length}):`);
    bu.files.forEach((f) => console.log(`    ${f}`));
    return;
  }

  // File path
  const file = graph.files.find((f) => f.path === id || f.path.endsWith('/' + id));
  if (file) {
    console.log(`${file.path}`);
    console.log('');
    console.log(`  Build Units (${file.buildUnits.length}):`);
    file.buildUnits.forEach((b) => console.log(`    ${b}`));
    console.log('');
    const scns = new Set<string>();
    const adrs = new Set<string>();
    for (const s of file.specs) {
      if (!s.ref) continue;
      if (s.specPath.includes('scenarios.md')) scns.add(s.ref);
      else if (s.specPath.includes('decision-log.md')) {
        adrs.add(`D${String(Number(s.ref.slice(1))).padStart(3, '0')}`);
      }
    }
    for (const l of file.legacyScenarios) scns.add(`SCN-${Number(l.replace(/^SCN-/, ''))}`);
    console.log(`  Scenarios (${scns.size}):`);
    [...scns].sort().forEach((s) => console.log(`    ${s}`));
    console.log('');
    console.log(`  ADRs (${adrs.size}):`);
    [...adrs].sort().forEach((a) => console.log(`    ${a}`));
    return;
  }

  console.error(`Could not resolve "${id}". Use SCN-N, D0NN, BU-name, or a file path.`);
  process.exit(2);
}

interface CheckResult {
  errors: string[];
  warnings: string[];
}

export function runChecks(graph: TraceGraph): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Scenarios with zero backing code AND no @no-code-yet marker
  for (const [id, scenario] of graph.scenarios) {
    const files = graph.filesByScenario.get(id) ?? [];
    if (files.length === 0 && !scenario.noCodeYet) {
      errors.push(
        `${id} (${scenario.title}): no backing code files and no <!-- @no-code-yet --> marker.`,
      );
    }
  }

  // Code files referencing non-existent SCNs / ADRs
  for (const file of graph.files) {
    for (const spec of file.specs) {
      if (!spec.ref) continue;
      if (spec.specPath.includes('scenarios.md') && /^SCN-\d+$/.test(spec.ref)) {
        if (!graph.scenarios.has(spec.ref)) {
          errors.push(`${file.path}: @spec references unknown scenario ${spec.ref}.`);
        }
      } else if (spec.specPath.includes('decision-log.md') && /^D\d{2,3}$/.test(spec.ref)) {
        const norm = `D${String(Number(spec.ref.slice(1))).padStart(3, '0')}`;
        if (!graph.adrs.has(norm)) {
          errors.push(`${file.path}: @spec references unknown ADR ${spec.ref}.`);
        }
      }
    }
    if (file.legacyScenarios.length > 0) {
      warnings.push(
        `${file.path}: legacy @scenarios tag — migrate to @spec product/scenarios.md (SCN-N).`,
      );
    }
  }

  return { errors, warnings };
}

export function renderMatrix(graph: TraceGraph): string {
  const scenarios = [...graph.scenarios.values()].sort((a, b) => a.num - b.num);
  const buNames = [...graph.buildUnits.keys()].sort();

  const lines: string[] = [];
  lines.push('# Traceability matrix');
  lines.push('');
  lines.push(
    '_Generated by `scripts/trace.ts`. Do not edit by hand — run `npm run trace:matrix` to refresh._',
  );
  lines.push('_Source: D038 §6 (the discipline) + D053 (this script)._');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Scenarios');
  lines.push('');
  lines.push('| SCN | Title | Files | BUs | ADRs | Status |');
  lines.push('| --- | ----- | -----:| --- | ---- | ------ |');
  for (const s of scenarios) {
    const files = graph.filesByScenario.get(s.id) ?? [];
    const buSet = new Set<string>();
    const adrSet = new Set<string>();
    for (const p of files) {
      const f = graph.files.find((x) => x.path === p);
      if (!f) continue;
      for (const bu of f.buildUnits) buSet.add(bu);
      for (const sp of f.specs) {
        if (sp.ref && sp.specPath.includes('decision-log.md')) {
          adrSet.add(`D${String(Number(sp.ref.slice(1))).padStart(3, '0')}`);
        }
      }
    }
    const status = files.length > 0 ? '✓ shipped' : s.noCodeYet ? 'parked' : '⚠ gap';
    const titleEsc = s.title.replace(/\|/g, '\\|');
    lines.push(
      `| ${s.id} | ${titleEsc} | ${files.length} | ${[...buSet].sort().join(', ') || '—'} | ${[...adrSet].sort().join(', ') || '—'} | ${status} |`,
    );
  }
  lines.push('');

  const gaps = scenarios.filter((s) => {
    const files = graph.filesByScenario.get(s.id) ?? [];
    return files.length === 0 && !s.noCodeYet;
  });
  if (gaps.length > 0) {
    lines.push('## Coverage gaps');
    lines.push('');
    lines.push('Scenarios with zero backing code and no `<!-- @no-code-yet -->` marker:');
    lines.push('');
    for (const s of gaps) {
      lines.push(`- ${s.id} — ${s.title}`);
    }
    lines.push('');
  }

  lines.push('## Build Units');
  lines.push('');
  lines.push('| BU | Files | Scenarios | ADRs |');
  lines.push('| -- | -----:| --------- | ---- |');
  for (const bu of buNames) {
    const u = graph.buildUnits.get(bu);
    if (!u) continue;
    lines.push(
      `| ${u.id} | ${u.files.length} | ${u.scenarios.join(', ') || '—'} | ${u.adrs.join(', ') || '—'} |`,
    );
  }
  lines.push('');

  lines.push('## ADRs (referenced by code)');
  lines.push('');
  lines.push('| ADR | Title | Referencing files |');
  lines.push('| --- | ----- | -----------------:|');
  const adrsSorted = [...graph.adrs.values()].sort((a, b) => a.num - b.num);
  for (const a of adrsSorted) {
    const refs = graph.filesByADR.get(a.id) ?? [];
    if (refs.length === 0) continue;
    const titleEsc = a.title.replace(/\|/g, '\\|');
    lines.push(`| ${a.id} | ${titleEsc} | ${refs.length} |`);
  }
  lines.push('');

  return lines.join('\n');
}

// ── CLI entry point ──────────────────────────────────────────────────────

function loadGraphFromDisk(): TraceGraph {
  const scenariosMd = readFileSync(join(REPO_ROOT, SCENARIOS_PATH), 'utf-8');
  const decisionLogMd = readFileSync(join(REPO_ROOT, DECISION_LOG_PATH), 'utf-8');

  const allFiles: { path: string; content: string }[] = [];
  for (const dir of SOURCE_DIRS) {
    const fullDir = join(REPO_ROOT, dir);
    let absPaths: string[];
    try {
      absPaths = walkSource(fullDir);
    } catch {
      continue;
    }
    for (const p of absPaths) {
      const rel = relative(REPO_ROOT, p);
      const content = readFileSync(p, 'utf-8');
      allFiles.push({ path: rel, content });
    }
  }

  return buildGraph({ scenariosMd, decisionLogMd, files: allFiles });
}

function main(): void {
  const args = process.argv.slice(2);
  const graph = loadGraphFromDisk();

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage:');
    console.log('  npm run trace <SCN-N | D0NN | BU-name | path>   single-ID lookup');
    console.log('  npm run trace:check                              CI guard (exit 1 on issues)');
    console.log('  npm run trace:matrix                             regenerate the matrix file');
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (args[0] === '--check') {
    const result = runChecks(graph);
    for (const w of result.warnings) console.warn(`[warn] ${w}`);

    // Drift check on the matrix
    let driftError: string | null = null;
    try {
      const committed = readFileSync(join(REPO_ROOT, MATRIX_PATH), 'utf-8');
      const fresh = renderMatrix(graph) + '\n';
      if (committed.trim() !== fresh.trim()) {
        driftError = `${MATRIX_PATH} is drifted. Run \`npm run trace:matrix\` and commit.`;
      }
    } catch {
      driftError = `${MATRIX_PATH} is missing. Run \`npm run trace:matrix\` and commit.`;
    }

    if (driftError) result.errors.push(driftError);

    if (result.errors.length > 0) {
      console.error('');
      console.error('Traceability check failed:');
      for (const e of result.errors) console.error(`  - ${e}`);
      console.error('');
      console.error(`${result.errors.length} error(s), ${result.warnings.length} warning(s).`);
      process.exit(1);
    }
    console.log(
      `Traceability check passed. ${graph.files.length} files, ${graph.scenarios.size} scenarios, ${graph.adrs.size} ADRs.`,
    );
    if (result.warnings.length > 0) {
      console.log(`${result.warnings.length} warning(s) above.`);
    }
    process.exit(0);
  }

  if (args[0] === '--matrix') {
    const md = renderMatrix(graph) + '\n';
    writeFileSync(join(REPO_ROOT, MATRIX_PATH), md);
    console.log(`Wrote ${MATRIX_PATH} (${md.split('\n').length} lines).`);
    process.exit(0);
  }

  // Default: lookup mode
  printLookup(graph, args[0] ?? '');
}

// Run only when invoked directly (not when imported by tests)
const invoked = process.argv[1] ?? '';
if (invoked.endsWith('trace.ts') || invoked.endsWith('trace.js')) {
  main();
}
