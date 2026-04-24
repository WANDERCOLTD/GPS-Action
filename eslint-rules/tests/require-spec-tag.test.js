/**
 * @build-unit F13
 * @spec architecture/decision-log.md (D038)
 */

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../rules/require-spec-tag.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('require-spec-tag', rule, {
  valid: [
    {
      name: '@build-unit + @spec present',
      code: `/**
 * @build-unit BU-feed
 * @spec architecture/api-contract.md
 */
export const x = 1;`,
    },
    {
      name: '@build-unit + multiple @spec tags',
      code: `/**
 * @build-unit BU-feed
 * @spec architecture/api-contract.md
 * @spec product/scenarios.md
 */
export const x = 1;`,
    },
    {
      name: 'no @build-unit — rule skips',
      code: `/**
 * A plain utility module.
 */
export const x = 1;`,
    },
    {
      name: 'no JSDoc at all — rule skips',
      code: `export const x = 1;`,
    },
    {
      name: 'empty file is exempt',
      code: '',
    },
    {
      name: '@build-unit + @spec after use-client directive',
      code: `'use client';
/**
 * @build-unit BU-005
 * @spec product/scenarios.md
 */
export const Component = () => null;`,
    },
    {
      name: '@build-unit + @spec with ADR reference format',
      code: `/**
 * @build-unit F06
 * @spec architecture/decision-log.md (D038)
 */
export const x = 1;`,
    },
  ],

  invalid: [
    {
      name: '@build-unit present but no @spec',
      code: `/**
 * @build-unit BU-feed
 */
export const x = 1;`,
      errors: [{ messageId: 'missingSpec' }],
    },
    {
      name: '@build-unit with description but no @spec',
      code: `/**
 * @build-unit BU-003
 * @scenarios SCN-02
 */
export const x = 1;`,
      errors: [{ messageId: 'missingSpec' }],
    },
    {
      name: '@spec tag with no value does not satisfy the rule',
      code: `/**
 * @build-unit BU-feed
 * @spec
 */
export const x = 1;`,
      errors: [{ messageId: 'missingSpec' }],
    },
  ],
});
