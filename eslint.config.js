import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import localRules from './eslint-rules/index.js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'app/**' },
        { type: 'components', pattern: 'components/**' },
        { type: 'routers', pattern: 'server/routers/**' },
        { type: 'services', pattern: 'server/services/**' },
        { type: 'db', pattern: 'server/db/**' },
        { type: 'lib', pattern: 'server/lib/**' },
        { type: 'shared', pattern: 'shared/**' },
        { type: 'styles', pattern: 'styles/**' },
        { type: 'tests', pattern: 'tests/**' },
        { type: 'scripts', pattern: 'scripts/**' },
      ],
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app', allow: ['components', 'shared', 'routers', 'styles'] },
            { from: 'components', allow: ['components', 'shared', 'styles'] },
            { from: 'routers', allow: ['services', 'shared', 'lib'] },
            { from: 'services', allow: ['db', 'lib', 'shared', 'services'] },
            { from: 'db', allow: ['shared'] },
            { from: 'lib', allow: ['shared', 'lib'] },
            { from: 'shared', allow: ['shared'] },
            {
              from: 'tests',
              allow: ['app', 'components', 'routers', 'services', 'db', 'lib', 'shared'],
            },
            { from: 'scripts', allow: ['services', 'db', 'lib', 'shared'] },
            { from: 'styles', allow: [] },
          ],
        },
      ],
    },
  },
  // ───────────────────────────────────────────────────────────────────────────
  // F06 — local custom rules (per docs/build/session-briefs/f06-eslint-rules.md)
  // ───────────────────────────────────────────────────────────────────────────

  // Rule 1 (require-build-unit-header) + Rule 6 (require-spec-tag) — feature code paths only
  {
    files: [
      'app/**/*.{ts,tsx}',
      'server/routers/**/*.ts',
      'server/services/**/*.ts',
      'server/admin/**/*.ts',
      'components/**/*.{ts,tsx}',
    ],
    plugins: { 'local-rules': localRules },
    rules: {
      'local-rules/require-build-unit-header': 'error',
      'local-rules/require-spec-tag': 'error',
    },
  },

  // Rule 2 (no-trpc-any) and rule 4 (no-inline-auth-check) — tRPC routers only
  {
    files: ['server/routers/**/*.ts'],
    plugins: { 'local-rules': localRules },
    rules: {
      'local-rules/no-trpc-any': 'error',
      'local-rules/no-inline-auth-check': 'error',
    },
  },

  // Rule 3 (no-pii-in-logs) — all app + server source
  {
    files: ['app/**/*.{ts,tsx}', 'server/**/*.ts', 'components/**/*.{ts,tsx}'],
    plugins: { 'local-rules': localRules },
    rules: {
      'local-rules/no-pii-in-logs': 'error',
    },
  },

  // Rule 5 (feature-must-have-flag) — opt-in via `// @feature-gated` directive,
  // applied broadly so any file using the directive is checked
  {
    files: ['app/**/*.{ts,tsx}', 'server/**/*.ts', 'components/**/*.{ts,tsx}'],
    plugins: { 'local-rules': localRules },
    rules: {
      'local-rules/feature-must-have-flag': 'error',
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // F15 — enforce design token usage (per docs/process/design-tokens-convention.md)
  // ───────────────────────────────────────────────────────────────────────────

  // Rule 7 (require-design-tokens) — UI code paths only
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    plugins: { 'local-rules': localRules },
    rules: {
      'local-rules/require-design-tokens': 'error',
    },
  },

  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'build/**',
      'eslint-rules/**',
      'prisma/**',
      'tests/**',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
  },
];
