/**
 * @build-unit F06
 * @spec architecture/decision-log.md (D038)
 */

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../rules/require-build-unit-header.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('require-build-unit-header', rule, {
  valid: [
    {
      name: 'block JSDoc with @build-unit at top',
      code: `/**
 * @build-unit BU-003
 */
export const x = 1;`,
    },
    {
      name: 'header after a leading import',
      code: `import { z } from 'zod';
/**
 * @build-unit BU-005
 */
export const x = 1;`,
    },
    {
      name: "header after 'use client' directive",
      code: `'use client';
/**
 * @build-unit BU-007
 */
export const Component = () => null;`,
    },
    {
      name: 'single-line comment with the tag still passes',
      code: `// @build-unit BU-002 — exception: tooling shim
export const x = 1;`,
    },
    {
      name: 'empty file is exempt',
      code: '',
    },
  ],

  invalid: [
    {
      name: 'no header at all',
      code: `export const foo = 1;
export const bar = 2;`,
      errors: [{ messageId: 'missingHeader' }],
    },
    {
      name: 'header pushed past the 10-line scan window',
      code: `import { a } from './a';
import { b } from './b';
import { c } from './c';
import { d } from './d';
import { e } from './e';
import { f } from './f';
import { g } from './g';
import { h } from './h';
import { i } from './i';
import { j } from './j';
/**
 * @build-unit BU-099
 */
export const x = 1;`,
      errors: [{ messageId: 'missingHeader' }],
    },
    {
      name: 'JSDoc present but missing the @build-unit tag',
      code: `/**
 * Some module that explains things.
 * @author paul
 */
export const x = 1;`,
      errors: [{ messageId: 'missingHeader' }],
    },
    {
      name: 'looks-similar but wrong tag (typo)',
      code: `/**
 * @buildunit BU-001
 */
export const x = 1;`,
      errors: [{ messageId: 'missingHeader' }],
    },
  ],
});
