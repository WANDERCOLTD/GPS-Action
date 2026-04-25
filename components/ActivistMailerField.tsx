/**
 * @build-unit BU-composer
 * @spec product/design-philosophy.md
 *
 * URL input for Activist Mailer links with inline validation
 * feedback. Shows error state when the URL fails allowlist rules.
 */

import type { FC } from 'react';

interface ActivistMailerFieldProps {
  error?: string;
}

export const ActivistMailerField: FC<ActivistMailerFieldProps> = ({ error }) => {
  return (
    <div>
      <label
        htmlFor="activistMailerUrl"
        style={{
          display: 'block',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          marginBottom: 'var(--space-1)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        Activist Mailer URL{' '}
        <span style={{ color: 'var(--colour-text-tertiary)', fontWeight: 400 }}>(optional)</span>
      </label>
      <input
        id="activistMailerUrl"
        name="activistMailerUrl"
        type="url"
        placeholder="https://activistmailer.com/campaigns/..."
        className="gps-input"
        style={{
          width: '100%',
          borderColor: error ? 'var(--colour-danger)' : undefined,
        }}
      />
      {error && (
        <p
          style={{
            color: 'var(--colour-danger)',
            fontSize: 'var(--text-xs)',
            marginTop: 'var(--space-1)',
            fontFamily: 'var(--font-ui)',
          }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};
