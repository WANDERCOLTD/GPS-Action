/**
 * @build-unit F15
 * @spec process/design-tokens-convention.md
 */

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../rules/require-design-tokens.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run('require-design-tokens', rule, {
  valid: [
    // ── Passing cases ─────────────────────────────────────────────────

    {
      name: 'var(--colour-primary) in inline style is allowed',
      code: `const x = <div style={{ color: 'var(--colour-primary)' }} />;`,
    },
    {
      name: 'file with no colours at all',
      code: `export const add = (a, b) => a + b;`,
    },
    {
      name: 'hex inside a block comment is exempt',
      code: `/* This colour is #1851cc for reference */\nexport const x = 1;`,
    },
    {
      name: 'hex inside a line comment is exempt',
      code: `// fallback was #1851cc\nexport const x = 1;`,
    },
    {
      name: 'tokens.css with hex is exempt (by filename)',
      filename: '/project/styles/tokens.css',
      code: `const primary = '#1851cc';`,
    },
    {
      name: "rule's own test file with hex is exempt (by filename)",
      filename: '/project/eslint-rules/tests/require-design-tokens.test.js',
      code: `const bad = '#ff0000';`,
    },
    {
      name: 'multiple var() token references in JSX',
      code: `export const C = () => (
        <div style={{
          background: 'var(--colour-surface-canvas)',
          color: 'var(--colour-text-primary)',
          border: '1px solid var(--colour-border-subtle)',
        }} />
      );`,
    },
    {
      name: 'hex in line comment is not flagged',
      code: `// The brand colour is #1851cc\nexport const x = 1;`,
    },
  ],

  invalid: [
    // ── Failing cases ─────────────────────────────────────────────────

    {
      name: 'hex in JSX inline style',
      code: `export const C = () => <div style={{ color: '#1851cc' }} />;`,
      errors: [{ messageId: 'hardcodedColour' }],
    },
    {
      name: 'hex in a constant array',
      code: `const COLOURS = ['#4577e8', '#0f6e56'];`,
      errors: [{ messageId: 'hardcodedColour' }, { messageId: 'hardcodedColour' }],
    },
    {
      name: 'hex in template literal',
      code: 'const css = `color: #ff0000`;',
      errors: [{ messageId: 'hardcodedColour' }],
    },
    {
      name: 'rgb() in inline style',
      code: `export const C = () => <div style={{ background: 'rgb(24, 81, 204)' }} />;`,
      errors: [{ messageId: 'hardcodedColour' }],
    },
    {
      name: 'rgba() in CSS-in-JS',
      code: `const overlay = 'rgba(0, 0, 0, 0.5)';`,
      errors: [{ messageId: 'hardcodedColour' }],
    },
    {
      name: 'hsl() in inline style',
      code: `export const C = () => <div style={{ color: 'hsl(220, 70%, 45%)' }} />;`,
      errors: [{ messageId: 'hardcodedColour' }],
    },
    {
      name: 'hsla() value',
      code: `const c = 'hsla(220, 70%, 45%, 0.8)';`,
      errors: [{ messageId: 'hardcodedColour' }],
    },
    {
      name: '3-digit hex (#fff) fails',
      code: `const white = '#fff';`,
      errors: [{ messageId: 'hardcodedColour' }],
    },
    {
      name: '8-digit hex (#11223344 alpha) fails',
      code: `const semi = '#11223344';`,
      errors: [{ messageId: 'hardcodedColour' }],
    },
    {
      name: 'hex inside JSX text content fails',
      code: `export const C = () => <p>colour #ffffff</p>;`,
      errors: [{ messageId: 'hardcodedColour' }],
    },
    {
      name: 'multiple violations in one file',
      code: `const a = '#1851cc';\nconst b = 'rgb(15, 110, 86)';\nconst c = 'hsl(0, 50%, 50%)';`,
      errors: [
        { messageId: 'hardcodedColour' },
        { messageId: 'hardcodedColour' },
        { messageId: 'hardcodedColour' },
      ],
    },
    {
      name: 'hex outside comment but comment also present',
      code: `// This is fine: #aaa\nconst bad = '#bbb';`,
      errors: [{ messageId: 'hardcodedColour' }],
    },
  ],
});
