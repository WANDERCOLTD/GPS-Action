/**
 * @build-unit F15
 * @spec process/design-tokens-convention.md
 * @spec process/ratchet-discipline.md
 *
 * ESLint rule: enforces design token usage. Bans hardcoded hex,
 * rgb(), rgba(), hsl(), hsla() colour values in feature code.
 * Pairs with the design token system at styles/tokens.css.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load canonical token map for closest-match suggestions ──────────────

let tokenMap = {};
try {
  const raw = readFileSync(resolve(__dirname, '../canonical-tokens.json'), 'utf8');
  tokenMap = JSON.parse(raw);
} catch {
  // If the file is missing, the rule still works — just without suggestions
}

// ── Patterns ────────────────────────────────────────────────────────────

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_PATTERN = /rgba?\([^)]+\)/g;
const HSL_PATTERN = /hsla?\([^)]+\)/g;

// ── Exempt files (checked by suffix) ────────────────────────────────────

const EXEMPT_SUFFIXES = [
  'styles/tokens.css',
  'eslint-rules/rules/require-design-tokens.js',
  'eslint-rules/tests/require-design-tokens.test.js',
];

// ── Comment stripping ───────────────────────────────────────────────────

/**
 * Replace comment content with whitespace of the same length so that
 * character indices remain stable. Handles:
 *   - JS/TS/CSS block comments:  /* ... * /
 *   - JS/TS line comments:       // ...
 *   - JSX expression comments:   {/* ... * /}
 */
function stripComments(source, filename) {
  const isCss = filename.endsWith('.css');

  // Block comments (/* ... */) — works for both JS and CSS
  let stripped = source.replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length));

  // Line comments (// ...) — JS/TS only, not CSS
  if (!isCss) {
    stripped = stripped.replace(/\/\/[^\n]*/g, (match) => ' '.repeat(match.length));
  }

  return stripped;
}

// ── Closest-match suggestion ────────────────────────────────────────────

function findClosestToken(value) {
  const normalised = value.toLowerCase();
  const match = tokenMap[normalised];
  if (match) return match;
  return null;
}

// ── Compute line/column from character index ────────────────────────────

function getLineAndColumn(source, index) {
  let line = 1;
  let column = 0;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      column = 0;
    } else {
      column++;
    }
  }
  return { line, column };
}

// ── The rule ────────────────────────────────────────────────────────────

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce design token usage; ban hardcoded colour values in feature code.',
    },
    messages: {
      hardcodedColour:
        "Hardcoded colour '{{ value }}' is not allowed. " +
        'Use a design token from styles/tokens.css instead. ' +
        '{{ suggestion }}' +
        'See docs/process/design-tokens-convention.md.',
    },
    schema: [],
  },

  create(context) {
    return {
      Program(node) {
        const filename = context.filename || context.getFilename();

        // Check exemptions
        if (EXEMPT_SUFFIXES.some((suffix) => filename.replace(/\\/g, '/').endsWith(suffix))) {
          return;
        }

        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const source = sourceCode.getText();

        if (source.trim() === '') return;

        // Strip comments so hex inside /* ... */ or // ... is ignored
        const stripped = stripComments(source, filename);

        const patterns = [HEX_PATTERN, RGB_PATTERN, HSL_PATTERN];

        for (const pattern of patterns) {
          // Reset lastIndex since we reuse the regex
          pattern.lastIndex = 0;
          let match;
          while ((match = pattern.exec(stripped)) !== null) {
            const value = match[0];
            const closest = findClosestToken(value);
            const suggestion = closest
              ? `Closest match: var(${closest}). `
              : 'No exact match — review tokens.css and choose the closest semantic role. ';

            // Find the AST node at this position for better error location
            const loc = getLineAndColumn(source, match.index);

            context.report({
              node,
              loc: { start: loc, end: { line: loc.line, column: loc.column + value.length } },
              messageId: 'hardcodedColour',
              data: { value, suggestion },
            });
          }
        }
      },
    };
  },
};

export default rule;
