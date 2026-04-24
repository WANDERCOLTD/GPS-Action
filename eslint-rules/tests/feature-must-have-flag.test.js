/**
 * @build-unit F06
 * @spec architecture/decision-log.md (D036)
 */

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../rules/feature-must-have-flag.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('feature-must-have-flag', rule, {
  valid: [
    {
      name: 'no directive — rule does not fire',
      code: `import { something } from './lib';
export const x = something();`,
    },
    {
      name: 'directive present, isFeatureEnabled imported and called',
      code: `// @feature-gated
import { isFeatureEnabled } from './flags';

export function go(ctx) {
  if (!isFeatureEnabled('ff_x', ctx)) return null;
  return run();
}`,
    },
    {
      name: 'directive in block comment, namespaced call',
      code: `/* @feature-gated */
import * as flags from './flags';

export function go(ctx) {
  return flags.isFeatureEnabled('ff_x', ctx) ? run() : null;
}`,
    },
    {
      name: 'directive plus aliased import — local name is isFeatureEnabled',
      code: `// @feature-gated
import { isFeatureEnabled as isFeatureEnabled } from './flags';

if (isFeatureEnabled('ff_y', {})) {
  // ...
}`,
    },
  ],

  invalid: [
    {
      name: 'directive but no import and no call',
      code: `// @feature-gated
export const x = 1;`,
      errors: [{ messageId: 'missingFlag' }],
    },
    {
      name: 'directive plus import but no call',
      code: `// @feature-gated
import { isFeatureEnabled } from './flags';
export const x = 1;`,
      errors: [{ messageId: 'missingFlag' }],
    },
    {
      name: 'directive plus call but no import (likely typo or wrong scope)',
      code: `// @feature-gated
export function go() {
  return isFeatureEnabled('ff_x');
}`,
      errors: [{ messageId: 'missingFlag' }],
    },
    {
      name: 'directive in block comment, neither import nor call',
      code: `/**
 * @feature-gated
 */
export const x = 1;`,
      errors: [{ messageId: 'missingFlag' }],
    },
  ],
});
