/**
 * @build-unit F06
 * @spec process/api-contract-discipline.md (rule 7)
 */

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../rules/no-inline-auth-check.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-inline-auth-check', rule, {
  valid: [
    {
      name: 'middleware via .use(requireRole(...))',
      code: `t.procedure
  .use(requireRole('admin'))
  .mutation(({ ctx }) => {
    if (ctx.user.role === 'admin') {
      return doThing(ctx);
    }
  });`,
    },
    {
      name: 'middleware via custom name',
      code: `t.procedure
  .use(authMiddleware)
  .mutation(({ ctx }) => {
    return ctx.user.role;
  });`,
    },
    {
      name: 'middleware between input and mutation',
      code: `t.procedure
  .input(schema)
  .use(requireRole('queue_manager'))
  .mutation(({ ctx, input }) => {
    return input.id + ctx.user.role;
  });`,
    },
    {
      name: 'reading non-auth fields without middleware is fine',
      code: `t.procedure.mutation(({ ctx }) => {
  return ctx.user.id + ctx.user.displayName;
});`,
    },
    {
      name: 'no procedure context — bare ctx.user.role outside a procedure',
      code: `function helper(ctx) {
  return ctx.user.role;
}`,
    },
  ],

  invalid: [
    {
      name: 'mutation with inline ctx.user.role check, no middleware',
      code: `t.procedure.mutation(({ ctx }) => {
  if (ctx.user.role !== 'admin') throw new Error('no');
  return ok();
});`,
      errors: [{ messageId: 'noInlineAuth' }],
    },
    {
      name: 'query with ctx.session.role check, no middleware',
      code: `t.procedure.query(({ ctx }) => {
  if (ctx.session.role === 'admin') return adminView();
  return memberView();
});`,
      errors: [{ messageId: 'noInlineAuth' }],
    },
    {
      name: 'mutation with ctx.user.permissions check after .input only',
      code: `t.procedure
  .input(schema)
  .mutation(({ ctx }) => {
    if (!ctx.user.permissions.includes('manage')) throw new Error('no');
  });`,
      errors: [{ messageId: 'noInlineAuth' }],
    },
    {
      name: 'subscription with ctx.user.role read, no middleware',
      code: `t.procedure.subscription(({ ctx }) => {
  return observableFor(ctx.user.role);
});`,
      errors: [{ messageId: 'noInlineAuth' }],
    },
  ],
});
