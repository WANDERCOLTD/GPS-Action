'use client';

/**
 * @build-unit bu-network-card-body-clamp
 * @spec build/session-briefs/bu-network-card-body-clamp.md
 *
 * Minimal admin edit field for an integer-valued SystemSetting.
 *
 * Renders: label + small description + number input + Save button.
 * On submit: calls `setSystemSettingAction` with `(key, value)`,
 * shows ok/error inline. Optimistic — flips to "Saved" briefly on
 * success.
 *
 * Q1 of the brief locked the "minimal" admin UI shape: a per-key
 * editor instance, not a generic registry-backed panel. When a
 * third admin-tunable setting lands, revisit (current threshold: 5
 * settings ⇒ scaffold).
 */

import { useState, useTransition } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { setSystemSettingAction } from '@/app/settings/actions';
import type { AdminSettableKey } from '@/shared/validation/system-setting';

interface Props {
  settingKey: AdminSettableKey;
  label: string;
  description: string;
  initialValue: number;
  min?: number;
  max?: number;
}

export function SystemSettingNumberField({
  settingKey,
  label,
  description,
  initialValue,
  min = 1,
  max = 99,
}: Props) {
  const [value, setValue] = useState<string>(String(initialValue));
  const [savedValue, setSavedValue] = useState<number>(initialValue);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const parsed = Number.parseInt(value, 10);
  const dirty = Number.isFinite(parsed) && parsed !== savedValue;
  const valid = Number.isFinite(parsed) && parsed >= min && parsed <= max;

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!valid || !dirty) return;
    setStatus('idle');
    setErrorMessage(null);
    startTransition(async () => {
      try {
        await setSystemSettingAction({ key: settingKey, value: String(parsed) });
        setSavedValue(parsed);
        setStatus('saved');
        // Clear the "Saved" indicator after a moment.
        setTimeout(() => setStatus('idle'), 2000);
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Save failed.');
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="settings-system-setting-field"
      data-setting-key={settingKey}
      style={containerStyle}
    >
      <label htmlFor={`ss-${settingKey}`} data-testid="settings-system-setting-label">
        <strong style={{ fontSize: 'var(--text-sm)' }}>{label}</strong>
        <p style={descriptionStyle}>{description}</p>
      </label>
      <div style={rowStyle}>
        <input
          id={`ss-${settingKey}`}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          data-testid="settings-system-setting-input"
          data-setting-key={settingKey}
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={!valid || !dirty}
          data-testid="settings-system-setting-save"
          data-setting-key={settingKey}
          style={buttonStyle(valid && dirty)}
        >
          Save
        </button>
        {status === 'saved' && (
          <span
            data-testid="settings-system-setting-status"
            data-setting-key={settingKey}
            data-status="saved"
            style={statusOkStyle}
          >
            Saved
          </span>
        )}
        {status === 'error' && errorMessage && (
          <span
            data-testid="settings-system-setting-status"
            data-setting-key={settingKey}
            data-status="error"
            role="alert"
            style={statusErrorStyle}
          >
            {errorMessage}
          </span>
        )}
      </div>
    </form>
  );
}

const containerStyle: CSSProperties = {
  padding: 'var(--space-4)',
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-md)',
};

const descriptionStyle: CSSProperties = {
  margin: 'var(--space-1) 0 var(--space-3) 0',
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const inputStyle: CSSProperties = {
  width: 80,
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--colour-surface-sunken)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
};

function buttonStyle(enabled: boolean): CSSProperties {
  return {
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-1) var(--space-3)',
    border: '1px solid var(--colour-border-subtle)',
    borderRadius: 'var(--radius-pill)',
    background: enabled ? 'var(--colour-primary)' : 'transparent',
    color: enabled ? 'var(--colour-primary-contrast)' : 'var(--colour-text-tertiary)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontWeight: 'var(--weight-semibold)',
  };
}

const statusOkStyle: CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-text-secondary)',
};

const statusErrorStyle: CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-urgent)',
};
