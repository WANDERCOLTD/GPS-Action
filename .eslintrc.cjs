/**
 * ESLint configuration for GPS Action.
 *
 * The boundaries plugin enforces the MVC separation:
 *   /app (View)       → can import from /components, /shared, /server/routers (types only)
 *   /server/routers   → can import from /server/services, /shared
 *   /server/services  → can import from /server/db, /server/lib, /shared
 *   /server/db        → can import from /shared/types only
 *
 * Violations are ERRORS, not warnings.
 */

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'boundaries'],
  extends: [
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  settings: {
    'boundaries/elements': [
      { type: 'app',         pattern: 'app/**' },
      { type: 'components',  pattern: 'components/**' },
      { type: 'routers',     pattern: 'server/routers/**' },
      { type: 'services',    pattern: 'server/services/**' },
      { type: 'db',          pattern: 'server/db/**' },
      { type: 'lib',         pattern: 'server/lib/**' },
      { type: 'shared',      pattern: 'shared/**' },
      { type: 'styles',      pattern: 'styles/**' },
      { type: 'tests',       pattern: 'tests/**' },
      { type: 'scripts',     pattern: 'scripts/**' },
    ],
  },
  rules: {
    // TypeScript strictness
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // No console in production code (use logger)
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Layer boundaries
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
  ignorePatterns: [
    'node_modules',
    '.next',
    'dist',
    'build',
    '*.config.js',
    '*.config.mjs',
    '*.config.cjs',
  ],
};
