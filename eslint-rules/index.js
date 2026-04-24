/**
 * @build-unit F06
 * @spec process/api-contract-discipline.md
 * @spec architecture/decision-log.md
 *
 * Local ESLint plugin — entry point. Exports a plugin object that conforms
 * to the ESLint v9 plugin API. Imported from the repo's `eslint.config.js`.
 *
 * Rules:
 *   - require-build-unit-header — D038 traceability
 *   - no-trpc-any              — api-contract-discipline.md rule 2
 *   - no-pii-in-logs           — analytics-events.md PII policy
 *   - no-inline-auth-check     — api-contract-discipline.md rule 7
 *   - feature-must-have-flag   — D036 feature flag discipline
 *   - require-spec-tag         — D038 @spec traceability (F13)
 *
 * See `eslint-rules/README.md` for what each rule does and how to extend.
 */

import requireBuildUnitHeader from './rules/require-build-unit-header.js';
import noTrpcAny from './rules/no-trpc-any.js';
import noPiiInLogs from './rules/no-pii-in-logs.js';
import noInlineAuthCheck from './rules/no-inline-auth-check.js';
import featureMustHaveFlag from './rules/feature-must-have-flag.js';
import requireSpecTag from './rules/require-spec-tag.js';

const plugin = {
  meta: {
    name: 'eslint-plugin-local-rules',
    version: '0.1.0',
  },
  rules: {
    'require-build-unit-header': requireBuildUnitHeader,
    'no-trpc-any': noTrpcAny,
    'no-pii-in-logs': noPiiInLogs,
    'no-inline-auth-check': noInlineAuthCheck,
    'feature-must-have-flag': featureMustHaveFlag,
    'require-spec-tag': requireSpecTag,
  },
};

export default plugin;
