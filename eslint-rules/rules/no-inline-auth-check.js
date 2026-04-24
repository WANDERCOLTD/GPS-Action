/**
 * @build-unit F06
 * @spec process/api-contract-discipline.md (rule 7)
 *
 * Rule: no-inline-auth-check
 * Fires when a tRPC procedure body references `ctx.user.role`,
 * `ctx.user.permissions`, `ctx.session.role`, etc., AND the procedure chain
 * has no `.use(...)` middleware.
 *
 * Pragmatic — assumes any `.use()` call wires the right middleware. Catches
 * the obvious failure mode (forgetting middleware entirely) without false
 * positives on procedures that DO have middleware and additionally read role
 * for branching.
 */

const AUTH_OBJECT_NAMES = new Set(['ctx', 'context']);
const AUTH_PROPERTY_HOSTS = new Set(['user', 'session']);
const AUTH_FIELD_NAMES = new Set(['role', 'roles', 'permissions']);

const PROCEDURE_TERMINATORS = new Set(['mutation', 'query', 'subscription']);

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid inline auth checks in tRPC procedures (per api-contract-discipline.md rule 7).',
    },
    messages: {
      noInlineAuth:
        'Authorisation must be via .use(requireRole(...)) middleware, not inline (per api-contract-discipline.md rule 7).',
    },
    schema: [],
  },

  create(context) {
    function isAuthAccess(node) {
      if (node.type !== 'MemberExpression') return false;

      const middle = node.object;
      if (middle.type !== 'MemberExpression') return false;
      if (middle.object.type !== 'Identifier') return false;
      if (!AUTH_OBJECT_NAMES.has(middle.object.name)) return false;
      if (middle.property.type !== 'Identifier') return false;
      if (!AUTH_PROPERTY_HOSTS.has(middle.property.name)) return false;

      if (node.property.type !== 'Identifier') return false;
      return AUTH_FIELD_NAMES.has(node.property.name);
    }

    function findEnclosingProcedureCall(node) {
      let current = node.parent;
      while (current) {
        if (
          current.type === 'CallExpression' &&
          current.callee.type === 'MemberExpression' &&
          current.callee.property.type === 'Identifier' &&
          PROCEDURE_TERMINATORS.has(current.callee.property.name)
        ) {
          return current;
        }
        current = current.parent;
      }
      return null;
    }

    function chainHasUse(callExprNode) {
      let current = callExprNode;
      while (current && current.type === 'CallExpression') {
        const callee = current.callee;
        if (callee.type !== 'MemberExpression') break;

        if (callee.property.type === 'Identifier' && callee.property.name === 'use') {
          return true;
        }
        current = callee.object;
      }
      return false;
    }

    return {
      MemberExpression(node) {
        if (!isAuthAccess(node)) return;

        const procCall = findEnclosingProcedureCall(node);
        if (!procCall) return;

        if (chainHasUse(procCall)) return;

        context.report({ node, messageId: 'noInlineAuth' });
      },
    };
  },
};

export default rule;
