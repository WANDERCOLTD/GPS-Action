/**
 * @build-unit F13
 * @spec architecture/decision-log.md (D038)
 *
 * Rule: require-spec-tag
 * Fires on files that have a `@build-unit` tag but no `@spec` tag in the
 * first 10 non-blank lines. Pairs with require-build-unit-header (F06 rule 1)
 * to maintain full traceability per D038.
 */

const BUILD_UNIT_TAG = /@build-unit\b/;
const SPEC_TAG = /@spec[ \t]+\S+/;
const MAX_LINES_TO_SCAN = 10;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require @spec traceability tag on files with @build-unit (per D038 traceability).',
    },
    messages: {
      missingSpec:
        'File has @build-unit but no @spec tag. Add at least one ' +
        '@spec annotation (e.g., "@spec architecture/admin-surface.md") ' +
        'to maintain traceability per D038.',
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

        if (!BUILD_UNIT_TAG.test(scanned)) {
          return; // no @build-unit — rule doesn't apply
        }

        if (!SPEC_TAG.test(scanned)) {
          context.report({ node, messageId: 'missingSpec' });
        }
      },
    };
  },
};

export default rule;
