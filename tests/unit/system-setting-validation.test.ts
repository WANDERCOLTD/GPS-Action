/**
 * @build-unit bu-network-card-body-clamp
 *
 * Validation for the admin-edit SystemSetting surface. The key
 * enum is a whitelist; the value field is a trimmed non-empty
 * string. Per-key value-shape enforcement lives at the read site
 * (e.g. `getSystemSettingInt` parses integers and falls back on
 * any non-numeric).
 */

import { describe, expect, it } from 'vitest';
import { ADMIN_SETTABLE_KEYS, systemSettingUpdateInput } from '@/shared/validation/system-setting';

describe('ADMIN_SETTABLE_KEYS', () => {
  it('exposes the two v1 keys', () => {
    expect(ADMIN_SETTABLE_KEYS).toContain('urgent_ttl_hours');
    expect(ADMIN_SETTABLE_KEYS).toContain('network_card_body_clamp_threshold_lines');
  });
});

describe('systemSettingUpdateInput', () => {
  it('accepts a whitelisted key + a non-empty trimmed value', () => {
    expect(() =>
      systemSettingUpdateInput.parse({
        key: 'network_card_body_clamp_threshold_lines',
        value: '6',
      }),
    ).not.toThrow();
  });

  it('rejects a key not on the whitelist', () => {
    expect(() =>
      systemSettingUpdateInput.parse({
        key: 'arbitrary_key' as unknown as 'urgent_ttl_hours',
        value: '5',
      }),
    ).toThrow();
  });

  it('rejects an empty value', () => {
    expect(() => systemSettingUpdateInput.parse({ key: 'urgent_ttl_hours', value: '' })).toThrow();
  });

  it('rejects a whitespace-only value', () => {
    expect(() =>
      systemSettingUpdateInput.parse({ key: 'urgent_ttl_hours', value: '   ' }),
    ).toThrow();
  });

  it('trims the value before storing', () => {
    const parsed = systemSettingUpdateInput.parse({
      key: 'urgent_ttl_hours',
      value: '  4 ',
    });
    expect(parsed.value).toBe('4');
  });

  it('rejects a value over 64 chars', () => {
    expect(() =>
      systemSettingUpdateInput.parse({
        key: 'urgent_ttl_hours',
        value: 'x'.repeat(65),
      }),
    ).toThrow();
  });
});
