/**
 * @build-unit F06
 * @spec product/analytics-events.md (PII policy)
 *
 * Rule: no-pii-in-logs
 * Fires when a logging call includes an expression matching PII patterns.
 *
 * Logging calls detected:
 *   - console.{log, info, warn, error, debug}
 *   - logger.* (any property — covers Pino/Winston/etc.)
 *   - Sentry.captureMessage / Sentry.captureException
 *
 * PII patterns:
 *   - Member access ending in PII property (e.g. user.email)
 *   - Top-level identifier with PII variable name (e.g. logger.info(email))
 *   - Object spreads inside log arguments (e.g. { ...user })
 *   - Both walked through template literals so `${user.email}` fires
 */

const PII_PROPERTIES = new Set([
  'email',
  'phone',
  'phoneNumber',
  'postcode',
  'address',
  'displayName',
  'firstName',
  'lastName',
  'fullName',
]);

const SAFE_PROPERTIES = new Set(['emailHash', 'phoneHash', 'phoneNumberHash', 'displayNameHash']);

const PII_VARIABLES = new Set([
  'email',
  'phone',
  'phoneNumber',
  'postcode',
  'password',
  'apiKey',
  'secret',
  'token',
]);

const CONSOLE_METHODS = new Set(['log', 'info', 'warn', 'error', 'debug']);
const SENTRY_METHODS = new Set(['captureMessage', 'captureException']);

function isLogCall(node) {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee.type !== 'MemberExpression') return false;
  if (callee.property.type !== 'Identifier') return false;

  if (callee.object.type === 'Identifier') {
    const objName = callee.object.name;
    if (objName === 'console') return CONSOLE_METHODS.has(callee.property.name);
    if (objName === 'logger') return true;
    if (objName === 'Sentry') return SENTRY_METHODS.has(callee.property.name);
  }
  return false;
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbid logging PII (per analytics-events.md PII policy).',
    },
    messages: {
      piiProperty:
        'Logging the property "{{name}}" is forbidden (per analytics-events.md PII policy). Use a hashed value or omit the field.',
      piiVariable:
        'Logging the variable "{{name}}" is forbidden (per analytics-events.md PII policy). Use a hashed value or omit the field.',
      piiSpread:
        'Spreading objects inside log calls likely includes PII (per analytics-events.md PII policy). Pick explicit safe fields instead.',
    },
    schema: [],
  },

  create(context) {
    function reportProperty(node, name) {
      context.report({ node, messageId: 'piiProperty', data: { name } });
    }
    function reportVariable(node, name) {
      context.report({ node, messageId: 'piiVariable', data: { name } });
    }
    function reportSpread(node) {
      context.report({ node, messageId: 'piiSpread' });
    }

    function walk(node, isTopLevelArg) {
      if (!node || typeof node !== 'object') return;

      switch (node.type) {
        case 'MemberExpression': {
          if (node.property.type === 'Identifier') {
            const name = node.property.name;
            if (PII_PROPERTIES.has(name) && !SAFE_PROPERTIES.has(name)) {
              reportProperty(node, name);
              return;
            }
          }
          walk(node.object, false);
          break;
        }

        case 'Identifier': {
          if (isTopLevelArg && PII_VARIABLES.has(node.name)) {
            reportVariable(node, node.name);
          }
          break;
        }

        case 'TemplateLiteral': {
          for (const expr of node.expressions) walk(expr, false);
          break;
        }

        case 'ObjectExpression': {
          for (const prop of node.properties) {
            if (prop.type === 'SpreadElement') {
              reportSpread(prop);
              continue;
            }
            if (prop.type === 'Property') {
              if (prop.shorthand) {
                if (prop.key.type === 'Identifier' && PII_VARIABLES.has(prop.key.name)) {
                  reportVariable(prop.key, prop.key.name);
                }
              } else {
                walk(prop.value, false);
              }
            }
          }
          break;
        }

        case 'ArrayExpression': {
          for (const elem of node.elements) {
            if (elem) walk(elem, false);
          }
          break;
        }

        case 'CallExpression': {
          for (const arg of node.arguments) walk(arg, false);
          break;
        }

        case 'BinaryExpression':
        case 'LogicalExpression': {
          walk(node.left, false);
          walk(node.right, false);
          break;
        }

        case 'ConditionalExpression': {
          walk(node.test, false);
          walk(node.consequent, false);
          walk(node.alternate, false);
          break;
        }

        case 'SpreadElement': {
          reportSpread(node);
          break;
        }

        default:
          break;
      }
    }

    return {
      CallExpression(node) {
        if (!isLogCall(node)) return;
        for (const arg of node.arguments) {
          walk(arg, true);
        }
      },
    };
  },
};

export default rule;
