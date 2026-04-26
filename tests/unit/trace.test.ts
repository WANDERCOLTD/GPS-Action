/**
 * Unit tests for scripts/trace.ts.
 *
 * @build-unit BU-trace
 * @spec process/traceability.md
 * @spec architecture/decision-log.md (D053)
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import {
  parseScenarios,
  parseADRs,
  parseFileTags,
  parseImports,
  buildGraph,
  runChecks,
  renderMatrix,
  computeImpact,
  walkSource,
  loadGraphFromDisk,
} from '../../scripts/trace';

describe('parseScenarios', () => {
  it('extracts scenario IDs from headings', () => {
    const md = [
      '# Scenarios',
      '',
      '### Scenario 1 — Sharon does a thing',
      '',
      '_Sharon, member._',
      '',
      '### Scenario 20 — Eddie writes a comment',
      '',
      '_Eddie, member._',
    ].join('\n');

    const result = parseScenarios(md);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'SCN-1', num: 1, noCodeYet: false });
    expect(result[1]).toMatchObject({ id: 'SCN-20', num: 20 });
  });

  it('detects @no-code-yet marker within 3 lines after heading', () => {
    const md = [
      '### Scenario 5 — Michael loses his phone',
      '',
      '<!-- @no-code-yet -->',
      '',
      '_Michael, member._',
    ].join('\n');

    const result = parseScenarios(md);
    expect(result[0]?.noCodeYet).toBe(true);
  });

  it('does not flag @no-code-yet beyond the 3-line window', () => {
    const md = [
      '### Scenario 5 — Michael loses his phone',
      '',
      '_Michael, member._',
      '',
      'Body paragraph.',
      '',
      '<!-- @no-code-yet -->',
    ].join('\n');

    const result = parseScenarios(md);
    expect(result[0]?.noCodeYet).toBe(false);
  });
});

describe('parseADRs', () => {
  it('handles ### D0NN · style', () => {
    const md = ['### D045 · Public-by-default visibility', '', 'Body...'].join('\n');

    const result = parseADRs(md);
    expect(result).toEqual([{ id: 'D045', num: 45, title: 'Public-by-default visibility' }]);
  });

  it('handles # D0NN — style (em-dash)', () => {
    const md = '# D050 — Reaction schema\n\nBody...';
    const result = parseADRs(md);
    expect(result).toEqual([{ id: 'D050', num: 50, title: 'Reaction schema' }]);
  });

  it('dedupes when the same ID appears twice (cross-reference, citations)', () => {
    const md = [
      '### D045 · Visibility',
      'See also: ### D045 mentioned again',
      '# D050 — Reactions',
    ].join('\n');

    const result = parseADRs(md);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual(['D045', 'D050']);
  });
});

describe('parseFileTags', () => {
  it('extracts @build-unit (single)', () => {
    const code = [
      '/**',
      ' * @build-unit BU-comments',
      ' * @spec architecture/decision-log.md (D052)',
      ' */',
      'export const x = 1;',
    ].join('\n');

    const result = parseFileTags(code);
    expect(result.buildUnits).toEqual(['BU-comments']);
    expect(result.specs).toContainEqual({
      specPath: 'architecture/decision-log.md',
      ref: 'D052',
    });
  });

  it('extracts multi-BU header (BU-feed BU-comments)', () => {
    const code = [
      '/**',
      ' * @build-unit BU-feed BU-comments',
      ' * @spec product/scenarios.md (SCN-18)',
      ' */',
    ].join('\n');

    const result = parseFileTags(code);
    expect(result.buildUnits).toEqual(['BU-feed', 'BU-comments']);
  });

  it('extracts multiple @spec tags with comma-separated refs', () => {
    const code = [
      '/**',
      ' * @build-unit BU-comments',
      ' * @spec architecture/decision-log.md (D045, D052)',
      ' * @spec product/scenarios.md (SCN-20)',
      ' */',
    ].join('\n');

    const result = parseFileTags(code);
    expect(result.specs).toContainEqual({
      specPath: 'architecture/decision-log.md',
      ref: 'D045',
    });
    expect(result.specs).toContainEqual({
      specPath: 'architecture/decision-log.md',
      ref: 'D052',
    });
    expect(result.specs).toContainEqual({
      specPath: 'product/scenarios.md',
      ref: 'SCN-20',
    });
  });

  it('records legacy @scenarios SCN-N tags separately', () => {
    const code = [
      '/**',
      ' * @build-unit BU-old',
      ' * @spec product/scenarios.md',
      ' * @scenarios SCN-04, SCN-05',
      ' */',
    ].join('\n');

    const result = parseFileTags(code);
    expect(result.legacyScenarios).toEqual(['SCN-04', 'SCN-05']);
  });

  it('extracts @depends-on BU references', () => {
    const code = [
      '/**',
      ' * @build-unit BU-comments',
      ' * @spec product/scenarios.md (SCN-20)',
      ' * @depends-on BU-reactions, BU-auth',
      ' */',
    ].join('\n');

    const result = parseFileTags(code);
    expect(result.dependsOn).toEqual(['BU-reactions', 'BU-auth']);
  });

  it('returns empty dependsOn when no @depends-on tag', () => {
    const code = ['/**', ' * @build-unit BU-comments', ' */'].join('\n');
    const result = parseFileTags(code);
    expect(result.dependsOn).toEqual([]);
  });
});

describe('parseImports', () => {
  it('extracts import specifiers', () => {
    const code = [
      "import { foo } from '@/server/services/foo';",
      "import bar from './bar';",
      "import * as baz from '../baz';",
      "import 'side-effect-only';",
      'const dynamic = "not an import";',
    ].join('\n');

    const result = parseImports(code);
    expect(result).toContain('@/server/services/foo');
    expect(result).toContain('./bar');
    expect(result).toContain('../baz');
    expect(result).toContain('side-effect-only');
    expect(result).not.toContain('not an import');
  });
});

describe('buildGraph + cross-references', () => {
  const scenariosMd = [
    '### Scenario 3 — David reacts',
    '_David._',
    '### Scenario 5 — Michael recovers',
    '<!-- @no-code-yet -->',
    '_Michael._',
    '### Scenario 18 — Eddie posts',
    '_Eddie._',
  ].join('\n');

  const decisionLogMd = ['### D045 · Visibility', '# D050 — Reactions'].join('\n');

  const reactionFile = [
    '/**',
    ' * @build-unit BU-reactions',
    ' * @spec architecture/decision-log.md (D050)',
    ' * @spec product/scenarios.md (SCN-3)',
    ' */',
  ].join('\n');

  const composerFile = [
    '/**',
    ' * @build-unit BU-composer',
    ' * @spec architecture/decision-log.md (D045)',
    ' * @spec product/scenarios.md (SCN-18)',
    ' */',
  ].join('\n');

  it('cross-references files to scenarios', () => {
    const graph = buildGraph({
      scenariosMd,
      decisionLogMd,
      files: [
        { path: 'server/services/reaction.ts', content: reactionFile },
        { path: 'app/compose/page.tsx', content: composerFile },
      ],
    });

    expect(graph.filesByScenario.get('SCN-3')).toEqual(['server/services/reaction.ts']);
    expect(graph.filesByScenario.get('SCN-18')).toEqual(['app/compose/page.tsx']);
  });

  it('normalises SCN-0N to SCN-N (leading zeros stripped)', () => {
    const file = [
      '/**',
      ' * @build-unit BU-old',
      ' * @spec product/scenarios.md (SCN-03)',
      ' */',
    ].join('\n');

    const graph = buildGraph({
      scenariosMd,
      decisionLogMd,
      files: [{ path: 'a.ts', content: file }],
    });

    // SCN-03 should have been normalised to SCN-3 in the index
    expect(graph.filesByScenario.get('SCN-3')).toEqual(['a.ts']);
  });

  it('builds Build Unit aggregates from constituent files', () => {
    const graph = buildGraph({
      scenariosMd,
      decisionLogMd,
      files: [
        { path: 'server/services/reaction.ts', content: reactionFile },
        { path: 'app/compose/page.tsx', content: composerFile },
      ],
    });

    expect(graph.buildUnits.get('BU-reactions')).toMatchObject({
      id: 'BU-reactions',
      scenarios: ['SCN-3'],
      adrs: ['D050'],
    });
    expect(graph.buildUnits.get('BU-composer')?.scenarios).toEqual(['SCN-18']);
  });
});

describe('runChecks', () => {
  const decisionLogMd = '### D050 · Reactions';

  it('passes when every scenario has backing code or @no-code-yet', () => {
    const scenariosMd = [
      '### Scenario 3 — Reacts',
      '_David._',
      '### Scenario 5 — Recovers',
      '<!-- @no-code-yet -->',
      '_Michael._',
    ].join('\n');

    const file = [
      '/**',
      ' * @build-unit BU-reactions',
      ' * @spec product/scenarios.md (SCN-3)',
      ' */',
    ].join('\n');

    const graph = buildGraph({
      scenariosMd,
      decisionLogMd,
      files: [{ path: 'a.ts', content: file }],
    });
    const result = runChecks(graph);
    expect(result.errors).toEqual([]);
  });

  it('fails when a scenario has zero refs and no @no-code-yet', () => {
    const scenariosMd = '### Scenario 5 — Recovers\n\n_Michael._';
    const graph = buildGraph({ scenariosMd, decisionLogMd, files: [] });
    const result = runChecks(graph);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('SCN-5');
  });

  it('fails when a code file references an unknown scenario', () => {
    const scenariosMd = '### Scenario 3 — Reacts\n\n_David._';
    const file = [
      '/**',
      ' * @build-unit BU-x',
      ' * @spec product/scenarios.md (SCN-99)',
      ' */',
    ].join('\n');

    const graph = buildGraph({
      scenariosMd,
      decisionLogMd,
      files: [{ path: 'a.ts', content: file }],
    });
    const result = runChecks(graph);
    expect(result.errors.some((e) => e.includes('SCN-99'))).toBe(true);
  });

  it('warns (does not fail) on legacy @scenarios tags', () => {
    const scenariosMd = '### Scenario 4 — Foo\n\n_Body._';
    const file = [
      '/**',
      ' * @build-unit BU-x',
      ' * @spec product/scenarios.md',
      ' * @scenarios SCN-04',
      ' */',
    ].join('\n');

    const graph = buildGraph({
      scenariosMd,
      decisionLogMd,
      files: [{ path: 'a.ts', content: file }],
    });
    const result = runChecks(graph);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('legacy @scenarios');
    // Coverage was satisfied via the legacy tag, so no error for SCN-4
    expect(result.errors).toEqual([]);
  });
});

describe('computeImpact', () => {
  const scenariosMd = '### Scenario 3 — Reacts\n\n_David._';
  const decisionLogMd = '### D050 · Reactions';

  it('returns null for unknown file', () => {
    const graph = buildGraph({ scenariosMd, decisionLogMd, files: [] });
    expect(computeImpact(graph, 'nonexistent.ts')).toBeNull();
  });

  it('reports buildUnits, scenarios, ADRs for a file', () => {
    const file = [
      '/**',
      ' * @build-unit BU-reactions',
      ' * @spec architecture/decision-log.md (D050)',
      ' * @spec product/scenarios.md (SCN-3)',
      ' */',
    ].join('\n');

    const graph = buildGraph({
      scenariosMd,
      decisionLogMd,
      files: [{ path: 'server/services/reaction.ts', content: file }],
    });

    const impact = computeImpact(graph, 'server/services/reaction.ts');
    expect(impact).not.toBeNull();
    expect(impact?.buildUnits).toEqual(['BU-reactions']);
    expect(impact?.scenarios).toEqual(['SCN-3']);
    expect(impact?.adrs).toEqual(['D050']);
  });

  it('resolves @/ alias imports to importedBy reverse map', () => {
    const fileA = [
      '/**',
      ' * @build-unit BU-x',
      ' * @spec product/scenarios.md (SCN-3)',
      ' */',
      "import { foo } from '@/server/services/reaction';",
    ].join('\n');
    const fileB = [
      '/**',
      ' * @build-unit BU-reactions',
      ' * @spec product/scenarios.md (SCN-3)',
      ' */',
      'export const foo = 1;',
    ].join('\n');

    const graph = buildGraph({
      scenariosMd,
      decisionLogMd,
      files: [
        { path: 'server/routers/x.ts', content: fileA },
        { path: 'server/services/reaction.ts', content: fileB },
      ],
    });

    const impact = computeImpact(graph, 'server/services/reaction.ts');
    expect(impact?.importedBy).toEqual(['server/routers/x.ts']);
  });

  it('aggregates @depends-on BU declarations into BU-level dependencies', () => {
    const file = [
      '/**',
      ' * @build-unit BU-comments',
      ' * @spec product/scenarios.md (SCN-3)',
      ' * @depends-on BU-reactions',
      ' */',
    ].join('\n');

    const graph = buildGraph({
      scenariosMd,
      decisionLogMd,
      files: [{ path: 'a.ts', content: file }],
    });

    const impact = computeImpact(graph, 'a.ts');
    expect(impact?.dependencies).toEqual(['BU-reactions']);
  });

  it('reports reverse dependents — BUs that declare this BU as @depends-on', () => {
    const reactionFile = [
      '/**',
      ' * @build-unit BU-reactions',
      ' * @spec product/scenarios.md (SCN-3)',
      ' */',
    ].join('\n');
    const commentFile = [
      '/**',
      ' * @build-unit BU-comments',
      ' * @spec product/scenarios.md (SCN-3)',
      ' * @depends-on BU-reactions',
      ' */',
    ].join('\n');

    const graph = buildGraph({
      scenariosMd,
      decisionLogMd,
      files: [
        { path: 'server/services/reaction.ts', content: reactionFile },
        { path: 'server/services/comment.ts', content: commentFile },
      ],
    });

    const impact = computeImpact(graph, 'server/services/reaction.ts');
    expect(impact?.dependents).toEqual(['BU-comments']);
  });
});

describe('renderMatrix', () => {
  it('produces a deterministic markdown table', () => {
    const scenariosMd = [
      '### Scenario 1 — A',
      '<!-- @no-code-yet -->',
      '_a._',
      '### Scenario 3 — B',
      '_b._',
    ].join('\n');

    const file = [
      '/**',
      ' * @build-unit BU-x',
      ' * @spec product/scenarios.md (SCN-3)',
      ' */',
    ].join('\n');

    const graph = buildGraph({
      scenariosMd,
      decisionLogMd: '',
      files: [{ path: 'a.ts', content: file }],
    });

    const md1 = renderMatrix(graph);
    const md2 = renderMatrix(graph);
    expect(md1).toEqual(md2);
    expect(md1).toContain('SCN-1');
    expect(md1).toContain('SCN-3');
    expect(md1).toContain('parked');
    expect(md1).toContain('✓ shipped');
  });
});

describe('walkSource — exclusion is scoped to repo-relative paths', () => {
  // Regression cover for the bug where EXCLUDED_PATH_FRAGMENTS was
  // matched against absolute paths. Running the script from inside a
  // `.claude/worktrees/<name>/` worktree caused every file path to
  // contain `.claude/worktrees`, so the walker excluded the entire
  // repo and trace:matrix wiped every shipped scenario.
  //
  // The fix matches fragments against paths *relative to* repoRoot.
  // From a worktree, repoRoot IS the worktree, so the relative path
  // does NOT contain `.claude/worktrees`. From the primary repo, a
  // nested `.claude/worktrees/<sub>/...` relative path still matches.
  let tmpDirs: string[] = [];

  beforeEach(() => {
    tmpDirs = [];
  });

  afterEach(() => {
    for (const d of tmpDirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        // ignore cleanup failure
      }
    }
  });

  function makeTmp(prefix: string): string {
    const d = mkdtempSync(join(tmpdir(), prefix));
    tmpDirs.push(d);
    return d;
  }

  it('includes files when repoRoot lives under a .claude/worktrees ancestor', () => {
    // Simulate the worktree shape: <tmp>/.claude/worktrees/<name>/app/feed/page.tsx
    // The worktree IS the repo root for the script invocation, so the
    // file's repo-relative path is `app/feed/page.tsx` — no
    // `.claude/worktrees` substring — and it must be included.
    const tmp = makeTmp('trace-worktree-');
    const worktreeRoot = join(tmp, '.claude', 'worktrees', 'agent-xyz');
    const featureDir = join(worktreeRoot, 'app', 'feed');
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(join(featureDir, 'page.tsx'), 'export const x = 1;\n');

    const found = walkSource(join(worktreeRoot, 'app'), worktreeRoot);

    expect(found).toHaveLength(1);
    expect(found[0]).toBe(join(worktreeRoot, 'app', 'feed', 'page.tsx'));
  });

  it('excludes files inside .claude/worktrees/<sub>/ when scanned from the primary repo', () => {
    // Simulate the primary-repo shape: <repo>/app/feed/page.tsx is
    // included; <repo>/.claude/worktrees/sub/app/foo.tsx is NOT.
    const repoRoot = makeTmp('trace-primary-');

    const primaryDir = join(repoRoot, 'app', 'feed');
    mkdirSync(primaryDir, { recursive: true });
    writeFileSync(join(primaryDir, 'page.tsx'), 'export const x = 1;\n');

    const worktreeChild = join(repoRoot, '.claude', 'worktrees', 'sub', 'app');
    mkdirSync(worktreeChild, { recursive: true });
    writeFileSync(join(worktreeChild, 'foo.tsx'), 'export const y = 2;\n');

    const fromApp = walkSource(join(repoRoot, 'app'), repoRoot);
    expect(fromApp.map((p) => p.replace(repoRoot, ''))).toEqual(['/app/feed/page.tsx']);

    // Direct walk of the .claude/worktrees subtree from the primary
    // repo's perspective: every entry's relative path contains
    // `.claude/worktrees` and must be excluded.
    const fromClaude = walkSource(join(repoRoot, '.claude'), repoRoot);
    expect(fromClaude).toEqual([]);
  });

  it('still excludes node_modules whether scanned from worktree or primary repo', () => {
    const repoRoot = makeTmp('trace-nm-');
    const nm = join(repoRoot, 'node_modules', 'pkg');
    mkdirSync(nm, { recursive: true });
    writeFileSync(join(nm, 'index.ts'), 'export {};\n');
    const src = join(repoRoot, 'app');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'page.tsx'), 'export const x = 1;\n');

    const found = walkSource(repoRoot, repoRoot);
    expect(found.some((p) => p.includes('node_modules'))).toBe(false);
    expect(found.some((p) => p.endsWith('app/page.tsx'))).toBe(true);
  });
});

describe('loadGraphFromDisk — end-to-end pipeline from a worktree-shaped path', () => {
  // The walker fix already has unit cover above. This suite catches
  // the END-TO-END regression: the full `trace:check` pipeline
  // (load + buildGraph + runChecks) must work when REPO_ROOT lives
  // under a `.claude/worktrees/<name>/` ancestor. Earlier test cover
  // exercised `walkSource` in isolation but didn't catch a future
  // regression where another path-comparison bug crept into
  // `loadGraphFromDisk` itself.
  let tmpDirs: string[] = [];

  beforeEach(() => {
    tmpDirs = [];
  });

  afterEach(() => {
    for (const d of tmpDirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        // ignore cleanup failure
      }
    }
  });

  function makeTmp(prefix: string): string {
    const d = mkdtempSync(join(tmpdir(), prefix));
    tmpDirs.push(d);
    return d;
  }

  function seedRepo(repoRoot: string): void {
    // Minimal scenarios + decision-log + one source file that backs
    // the scenario, so runChecks should pass cleanly.
    mkdirSync(join(repoRoot, 'docs', 'product'), { recursive: true });
    mkdirSync(join(repoRoot, 'docs', 'architecture'), { recursive: true });
    mkdirSync(join(repoRoot, 'app', 'feed'), { recursive: true });

    writeFileSync(
      join(repoRoot, 'docs', 'product', 'scenarios.md'),
      '### Scenario 1 — Sharon does a thing\n\n_Sharon._\n',
    );
    writeFileSync(
      join(repoRoot, 'docs', 'architecture', 'decision-log.md'),
      '### D050 · Reactions\n\nBody.\n',
    );
    writeFileSync(
      join(repoRoot, 'app', 'feed', 'page.tsx'),
      [
        '/**',
        ' * @build-unit BU-feed',
        ' * @spec product/scenarios.md (SCN-1)',
        ' * @spec architecture/decision-log.md (D050)',
        ' */',
        'export const x = 1;',
      ].join('\n') + '\n',
    );
  }

  it('indexes files and passes runChecks when repoRoot is under .claude/worktrees', () => {
    // Reproduce the original failure mode: REPO_ROOT itself is a
    // worktree-shaped path. Pre-fix, walkSource matched
    // `.claude/worktrees` against the absolute `app/feed/page.tsx`
    // path and excluded the file, leaving SCN-1 with zero backing
    // code and runChecks reporting a bogus coverage gap.
    const tmp = makeTmp('trace-e2e-worktree-');
    const worktreeRoot = join(tmp, '.claude', 'worktrees', 'agent-e2e');
    seedRepo(worktreeRoot);

    const graph = loadGraphFromDisk(worktreeRoot);

    expect(graph.files.map((f) => f.path)).toEqual(['app/feed/page.tsx']);
    expect(graph.scenarios.has('SCN-1')).toBe(true);
    expect(graph.filesByScenario.get('SCN-1')).toEqual(['app/feed/page.tsx']);

    const result = runChecks(graph);
    expect(result.errors).toEqual([]);
  });

  it('still excludes nested .claude/worktrees subtrees when repoRoot is the primary repo', () => {
    // Belt-and-braces: from a primary-repo shape, a nested worktree
    // directory must still be excluded so in-flight agent work
    // doesn't pollute the matrix.
    const repoRoot = makeTmp('trace-e2e-primary-');
    seedRepo(repoRoot);

    // Plant a file inside .claude/worktrees/<sub>/app/ that, if
    // included, would create a duplicate-path entry in the graph.
    const nested = join(repoRoot, '.claude', 'worktrees', 'sub', 'app', 'feed');
    mkdirSync(nested, { recursive: true });
    writeFileSync(
      join(nested, 'page.tsx'),
      [
        '/**',
        ' * @build-unit BU-shadow',
        ' * @spec product/scenarios.md (SCN-1)',
        ' */',
        'export const y = 2;',
      ].join('\n') + '\n',
    );

    const graph = loadGraphFromDisk(repoRoot);

    // Only the primary-repo file is indexed. The shadow file under
    // .claude/worktrees/sub is excluded.
    expect(graph.files.map((f) => f.path)).toEqual(['app/feed/page.tsx']);
    expect(graph.buildUnits.has('BU-shadow')).toBe(false);
  });
});
