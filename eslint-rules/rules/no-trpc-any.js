/**
 * @build-unit F06
 * @spec process/api-contract-discipline.md (rule 2)
 *
 * Rule: no-trpc-any
 * Fires on `z.any()` call expressions. Path scoping (`server/routers/**`) is
 * done by ESLint's `files` option in `eslint.config.js`.
 *
 * `z.unknown()` is permitted — that's the documented escape hatch.
 */

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbid z.any() in tRPC routers (per api-contract-discipline.md rule 2).',
    },
    messages: {
      noAny:
        'z.any() is forbidden in tRPC routers (per api-contract-discipline.md rule 2). Use a discriminated union or z.unknown() if truly dynamic.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'z' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'any'
        ) {
          context.report({ node, messageId: 'noAny' });
        }
      },
    };
  },
};

export default rule;
