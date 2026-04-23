import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';

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
        { type: 'app',        pattern: 'app/**' },
        { type: 'components', pattern: 'components/**' },
        { type: 'routers',    pattern: 'server/routers/**' },
        { type: 'services',   pattern: 'server/services/**' },
        { type: 'db',         pattern: 'server/db/**' },
        { type: 'lib',        pattern: 'server/lib/**' },
        { type: 'shared',     pattern: 'shared/**' },
        { type: 'styles',     pattern: 'styles/**' },
        { type: 'tests',      pattern: 'tests/**' },
        { type: 'scripts',    pattern: 'scripts/**' },
      ],
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app',        allow: ['components', 'shared', 'routers', 'styles'] },
            { from: 'components', allow: ['components', 'shared', 'styles'] },
            { from: 'routers',    allow: ['services', 'shared', 'lib'] },
            { from: 'services',   allow: ['db', 'lib', 'shared', 'services'] },
            { from: 'db',         allow: ['shared'] },
            { from: 'lib',        allow: ['shared', 'lib'] },
            { from: 'shared',     allow: ['shared'] },
            { from: 'tests',      allow: ['app', 'components', 'routers', 'services', 'db', 'lib', 'shared'] },
            { from: 'scripts',    allow: ['services', 'db', 'lib', 'shared'] },
            { from: 'styles',     allow: [] },
          ],
        },
      ],
    },
  },
  {
    ignores: ['node_modules/**', '.next/**', 'dist/**', 'build/**'],
  },
];
