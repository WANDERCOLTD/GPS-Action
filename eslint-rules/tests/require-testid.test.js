/**
 * @build-unit F14
 * @spec process/testid-convention.md
 */

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../rules/require-testid.js';

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

ruleTester.run('require-testid', rule, {
  valid: [
    {
      name: 'well-formed testid on <button>',
      code: `const x = <button data-testid="feed-newpost-submit">Go</button>;`,
    },
    {
      name: 'well-formed testid on <a>',
      code: `const x = <a data-testid="post-am-link" href="/x">Open</a>;`,
    },
    {
      name: 'well-formed testid on <input>',
      code: `const x = <input data-testid="compose-title-input" />;`,
    },
    {
      name: 'well-formed testid on <form>',
      code: `const x = <form data-testid="auth-devlogin-form">child</form>;`,
    },
    {
      name: 'well-formed testid on a <div> with onClick',
      code: `const x = <div data-testid="feed-row-clickable" onClick={() => {}}>row</div>;`,
    },
    {
      name: 'custom component <Button /> exempt',
      code: `const x = <Button>Save</Button>;`,
    },
    {
      name: 'custom component <PostForm /> exempt even with onSubmit',
      code: `const x = <PostForm onSubmit={() => {}} />;`,
    },
    {
      name: 'non-interactive <div> with no testid passes',
      code: `const x = <div className="wrapper">content</div>;`,
    },
    {
      name: 'non-interactive <section> passes',
      code: `const x = <section><p>text</p></section>;`,
    },
    {
      name: 'four-segment testid passes',
      code: `const x = <button data-testid="compose-newpost-submit-primary">Publish</button>;`,
    },
    {
      name: 'numeric segment passes',
      code: `const x = <button data-testid="feed-tab-2">2</button>;`,
    },
  ],

  invalid: [
    {
      name: '<button> with no testid',
      code: `const x = <button onClick={() => {}}>Go</button>;`,
      errors: [{ messageId: 'missing' }],
    },
    {
      name: '<input> with no testid',
      code: `const x = <input type="text" />;`,
      errors: [{ messageId: 'missing' }],
    },
    {
      name: '<a> with no testid',
      code: `const x = <a href="/x">Open</a>;`,
      errors: [{ messageId: 'missing' }],
    },
    {
      name: '<div onClick> with no testid',
      code: `const x = <div onClick={() => {}}>row</div>;`,
      errors: [{ messageId: 'missing' }],
    },
    {
      name: 'typo: testid instead of data-testid',
      code: `const x = <button testid="feed-foo-bar">Go</button>;`,
      errors: [{ messageId: 'missing' }],
    },
    {
      name: 'typo: data-test-id instead of data-testid',
      code: `const x = <button data-test-id="feed-foo-bar">Go</button>;`,
      errors: [{ messageId: 'missing' }],
    },
    {
      name: 'dynamic template literal (notStatic)',
      code: 'const id = "x"; const y = <button data-testid={`feed-row-${id}`}>r</button>;',
      errors: [{ messageId: 'notStatic' }],
    },
    {
      name: 'dynamic variable expression (notStatic)',
      code: `const id = "feed-foo-bar"; const y = <button data-testid={id}>r</button>;`,
      errors: [{ messageId: 'notStatic' }],
    },
    {
      name: 'camelCase (badFormat)',
      code: `const x = <button data-testid="feedNewpostSubmit">Go</button>;`,
      errors: [{ messageId: 'badFormat' }],
    },
    {
      name: 'underscores (badFormat)',
      code: `const x = <button data-testid="feed_newpost_submit">Go</button>;`,
      errors: [{ messageId: 'badFormat' }],
    },
    {
      name: 'two segments (badFormat)',
      code: `const x = <button data-testid="feed-button">Go</button>;`,
      errors: [{ messageId: 'badFormat' }],
    },
    {
      name: 'uppercase (badFormat)',
      code: `const x = <button data-testid="Feed-NewPost-Submit">Go</button>;`,
      errors: [{ messageId: 'badFormat' }],
    },
    {
      name: 'unknown area prefix (unknownArea)',
      code: `const x = <button data-testid="widgets-foo-bar">Go</button>;`,
      errors: [{ messageId: 'unknownArea' }],
    },
    {
      name: 'unknown area prefix on <input>',
      code: `const x = <input data-testid="legacy-foo-bar" />;`,
      errors: [{ messageId: 'unknownArea' }],
    },
  ],
});
