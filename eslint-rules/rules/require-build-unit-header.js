/**
 * @build-unit F06
 * @spec architecture/decision-log.md (D038)
 *
 * Rule: require-build-unit-header
 * Fires on files missing a `@build-unit` JSDoc tag in the first 10 non-blank
 * lines. Empty files are exempt. Path scoping is done by ESLint's `files`
 * option in `eslint.config.js` — this rule always runs when invoked.
 */

const HEADER_TAG = /@build-unit\b/;
const MAX_LINES_TO_SCAN = 10;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require @build-unit JSDoc tag in the first 10 non-blank lines (per D038 traceability).',
    },
    messages: {
      missingHeader:
        'File must include @build-unit JSDoc tag in first 10 lines (per D038 traceability).',
    },
    schema: [],
  },

  create(context) {
    return {
      Program(node) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const text = sourceCode.getText();

        if (text.trim() === '') {
          return;
        }

        const lines = text.split('\n');
        let scanned = '';
        let nonBlankCount = 0;

        for (const line of lines) {
          if (line.trim() === '') continue;
          scanned += line + '\n';
          nonBlankCount += 1;
          if (nonBlankCount >= MAX_LINES_TO_SCAN) break;
        }

        if (!HEADER_TAG.test(scanned)) {
          context.report({ node, messageId: 'missingHeader' });
        }
      },
    };
  },
};

export default rule;
