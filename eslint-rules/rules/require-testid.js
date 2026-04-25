/**
 * @build-unit F14
 * @spec process/testid-convention.md
 * @spec architecture/decision-log.md (D038)
 *
 * ESLint rule: enforces that interactive DOM elements carry a
 * data-testid attribute matching the canonical convention. Pairs with
 * require-build-unit-header (F06 rule 1) and require-spec-tag (F13)
 * as the third sibling in the traceability + safety ratchet.
 *
 * The convention is documented at docs/process/testid-convention.md.
 * Canonical area prefixes are listed in eslint-rules/canonical-areas.json.
 *
 * Fail-loud on missing/malformed config: silent fallback risks accepting
 * testids with unknown prefixes.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load canonical area prefixes (fail-loud at module load) ──────────────

const CANONICAL_AREAS_PATH = resolve(__dirname, '../canonical-areas.json');
let CANONICAL_AREAS;
try {
  const raw = readFileSync(CANONICAL_AREAS_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.areas) || parsed.areas.length === 0) {
    throw new Error(`canonical-areas.json must export a non-empty "areas" array.`);
  }
  CANONICAL_AREAS = new Set(parsed.areas);
} catch (err) {
  throw new Error(
    `[require-testid] failed to load ${CANONICAL_AREAS_PATH}: ${err.message}. ` +
      `This file must exist and contain a valid "areas" array. See ` +
      `docs/process/testid-convention.md.`,
  );
}

// ── Patterns ─────────────────────────────────────────────────────────────

const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea', 'form', 'label']);

const INTERACTIVE_HANDLERS = new Set([
  'onClick',
  'onChange',
  'onSubmit',
  'onKeyDown',
  'onKeyUp',
  'onKeyPress',
  'onFocus',
  'onBlur',
]);

const TESTID_FORMAT = /^[a-z]+(-[a-z0-9]+){2,}$/;

// ── Helpers ──────────────────────────────────────────────────────────────

function isCustomComponent(name) {
  return /^[A-Z]/.test(name);
}

function getAttribute(node, attrName) {
  for (const attr of node.attributes) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === attrName
    ) {
      return attr;
    }
  }
  return null;
}

function hasInteractiveHandler(node) {
  for (const attr of node.attributes) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name &&
      attr.name.type === 'JSXIdentifier' &&
      INTERACTIVE_HANDLERS.has(attr.name.name)
    ) {
      return true;
    }
  }
  return false;
}

// ── Rule ─────────────────────────────────────────────────────────────────

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require data-testid on interactive DOM elements (per docs/process/testid-convention.md).',
    },
    messages: {
      missing:
        '<{{tag}}> is interactive but missing data-testid. See docs/process/testid-convention.md.',
      notStatic:
        'data-testid must be a static string literal, not an expression. Use a fixed testid and put dynamic ids in a separate data-* attribute (e.g. data-post-id). See docs/process/testid-convention.md.',
      badFormat:
        "data-testid '{{value}}' must match <area>-<element>-<variant> (lowercase, hyphenated, 3+ segments). See docs/process/testid-convention.md.",
      unknownArea:
        "data-testid '{{value}}' uses area prefix '{{area}}' which is not in the canonical list. Add it to eslint-rules/canonical-areas.json AND update docs/process/testid-convention.md in the same PR.",
    },
    schema: [],
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        // 1. Skip namespaced names (`<svg:rect>`) — defensively treat as custom.
        if (!node.name || node.name.type !== 'JSXIdentifier') {
          return;
        }

        const tagName = node.name.name;

        // 2. Skip custom React components (uppercase first letter).
        if (isCustomComponent(tagName)) {
          return;
        }

        // 3. Determine if interactive.
        const isInteractive = INTERACTIVE_TAGS.has(tagName) || hasInteractiveHandler(node);
        if (!isInteractive) {
          return;
        }

        // 4. Look for data-testid attribute.
        const testidAttr = getAttribute(node, 'data-testid');
        if (!testidAttr) {
          context.report({
            node,
            messageId: 'missing',
            data: { tag: tagName },
          });
          return;
        }

        // 5. Check the value is a static string literal.
        // JSX attributes have value as a Literal (string) or JSXExpressionContainer.
        const value = testidAttr.value;
        if (!value || value.type !== 'Literal' || typeof value.value !== 'string') {
          context.report({
            node: testidAttr,
            messageId: 'notStatic',
          });
          return;
        }

        const testidValue = value.value;

        // 6. Check format.
        if (!TESTID_FORMAT.test(testidValue)) {
          context.report({
            node: testidAttr,
            messageId: 'badFormat',
            data: { value: testidValue },
          });
          return;
        }

        // 7. Check first segment is a canonical area prefix.
        const firstSegment = testidValue.split('-')[0];
        if (!CANONICAL_AREAS.has(firstSegment)) {
          context.report({
            node: testidAttr,
            messageId: 'unknownArea',
            data: { value: testidValue, area: firstSegment },
          });
        }
      },
    };
  },
};

export default rule;
