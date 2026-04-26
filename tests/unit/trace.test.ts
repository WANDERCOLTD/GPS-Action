/**
 * Unit tests for scripts/trace.ts.
 *
 * @build-unit BU-trace
 * @spec process/traceability.md
 * @spec architecture/decision-log.md (D053)
 */

import { describe, it, expect } from 'vitest';
import {
  parseScenarios,
  parseADRs,
  parseFileTags,
  buildGraph,
  runChecks,
  renderMatrix,
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
