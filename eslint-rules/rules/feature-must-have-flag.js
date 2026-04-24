/**
 * @build-unit F06
 * @spec architecture/decision-log.md (D036)
 *
 * Rule: feature-must-have-flag
 * Opt-in. Fires when a file declares `// @feature-gated` (line or block
 * comment) but does not import AND call `isFeatureEnabled` at least once.
 *
 * Recognises both bare calls (`isFeatureEnabled(...)`) and namespaced calls
 * (`flags.isFeatureEnabled(...)`). The intent is to catch files that claim
 * to be gated but forget the actual check.
 */

const DIRECTIVE = /@feature-gated\b/;
const FUNCTION_NAME = 'isFeatureEnabled';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Files marked @feature-gated must import and call isFeatureEnabled (per D036 feature flag discipline).',
    },
    messages: {
      missingFlag:
        'File marked @feature-gated must import and call isFeatureEnabled (per D036 feature flag discipline).',
    },
    schema: [],
  },

  create(context) {
    let hasDirective = false;
    let hasNamedImport = false;
    let hasNamespaceImport = false;
    let hasBareCall = false;
    let hasMemberCall = false;

    return {
      Program() {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const comments = sourceCode.getAllComments();
        for (const comment of comments) {
          if (DIRECTIVE.test(comment.value)) {
            hasDirective = true;
            break;
          }
        }
      },

      ImportDeclaration(node) {
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            const importedName = spec.imported.type === 'Identifier' ? spec.imported.name : null;
            if (importedName === FUNCTION_NAME) {
              hasNamedImport = true;
            }
          } else if (
            spec.type === 'ImportDefaultSpecifier' ||
            spec.type === 'ImportNamespaceSpecifier'
          ) {
            // Default or `import * as foo` — we can't tell from the import alone
            // whether isFeatureEnabled is reachable. The presence of a matching
            // member call below confirms it.
            hasNamespaceImport = true;
          }
        }
      },

      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === FUNCTION_NAME) {
          hasBareCall = true;
          return;
        }
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === FUNCTION_NAME
        ) {
          hasMemberCall = true;
        }
      },

      'Program:exit'(node) {
        if (!hasDirective) return;

        const namedSatisfied = hasNamedImport && hasBareCall;
        const namespaceSatisfied = hasNamespaceImport && hasMemberCall;

        if (!namedSatisfied && !namespaceSatisfied) {
          context.report({ node, messageId: 'missingFlag' });
        }
      },
    };
  },
};

export default rule;
