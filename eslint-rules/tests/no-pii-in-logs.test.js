/**
 * @build-unit F06
 * @spec product/analytics-events.md (PII policy)
 */

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../rules/no-pii-in-logs.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-pii-in-logs', rule, {
  valid: [
    {
      name: 'logging an id is safe',
      code: `console.log(user.id);`,
    },
    {
      name: 'logging the hashed variant is safe',
      code: `logger.info({ userId: user.emailHash });`,
    },
    {
      name: 'PII as a key, not a value, is safe',
      code: `console.log({ email: 'masked' });`,
    },
    {
      name: 'string literal that mentions PII is safe',
      code: `console.warn('field user.email is sensitive');`,
    },
    {
      name: 'unrelated function call (not a logger) is exempt',
      code: `track({ email: user.email });`,
    },
    {
      name: 'PII property access outside a log is fine',
      code: `function pickEmail(user) {
  const e = user.email;
  return e;
}`,
    },
  ],

  invalid: [
    {
      name: 'console.log with user.email member access',
      code: `console.log(user.email);`,
      errors: [{ messageId: 'piiProperty' }],
    },
    {
      name: 'logger.error with template literal interpolation of PII',
      code: 'logger.error(`Failed for ${user.email}`);',
      errors: [{ messageId: 'piiProperty' }],
    },
    {
      name: 'Sentry.captureMessage spreading a user object',
      code: `Sentry.captureMessage('boom', { ...user });`,
      errors: [{ messageId: 'piiSpread' }],
    },
    {
      name: 'console.warn with PII variable name passed directly',
      code: `console.warn(email);`,
      errors: [{ messageId: 'piiVariable' }],
    },
    {
      name: 'shorthand property logging a PII variable',
      code: `logger.info({ email });`,
      errors: [{ messageId: 'piiVariable' }],
    },
    {
      name: 'nested member access deep in object value',
      code: `logger.error({ context: { who: user.displayName } });`,
      errors: [{ messageId: 'piiProperty' }],
    },
  ],
});
