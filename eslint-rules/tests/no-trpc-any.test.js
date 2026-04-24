/**
 * @build-unit F06
 * @spec process/api-contract-discipline.md (rule 2)
 */

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../rules/no-trpc-any.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-trpc-any', rule, {
  valid: [
    {
      name: 'z.unknown() is the documented escape hatch',
      code: `import { z } from 'zod';
const schema = z.object({ context: z.unknown() });`,
    },
    {
      name: 'discriminated union is fine',
      code: `import { z } from 'zod';
const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('a'), value: z.string() }),
  z.object({ type: z.literal('b'), value: z.number() }),
]);`,
    },
    {
      name: 'string literal that mentions z.any() is fine',
      code: `const note = "do not use z.any() here";`,
    },
    {
      name: 'unrelated .any() chain (not on z) is fine',
      code: `const found = items.any((x) => x === 1);`,
    },
  ],

  invalid: [
    {
      name: 'bare z.any()',
      code: `import { z } from 'zod';
const schema = z.any();`,
      errors: [{ messageId: 'noAny' }],
    },
    {
      name: 'z.any() with chained describe still fires',
      code: `import { z } from 'zod';
const schema = z.any().describe('legacy payload');`,
      errors: [{ messageId: 'noAny' }],
    },
    {
      name: 'z.any() nested inside z.array fires',
      code: `import { z } from 'zod';
const schema = z.array(z.any());`,
      errors: [{ messageId: 'noAny' }],
    },
    {
      name: 'z.any() inside an object property fires',
      code: `import { z } from 'zod';
const schema = z.object({ payload: z.any() });`,
      errors: [{ messageId: 'noAny' }],
    },
  ],
});
