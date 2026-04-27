/**
 * @build-unit BU-tick-or-cross
 * @spec build/session-briefs/bu-tick-or-cross.md
 * @spec architecture/decision-log.md (D069)
 *
 * Unit tests for the WHATSAPP_NETWORK_CHANNEL_URL env validator. The
 * module reads + validates at load, so each test isolates a fresh
 * import via `vi.resetModules()` after rewriting the env.
 *
 * The test runs under `NODE_ENV=test`, so a missing/invalid value
 * resolves to null instead of throwing — that's the documented
 * escape hatch for unit coverage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

async function loadModule() {
  return import('@/shared/env/whatsapp-network-channel');
}

describe('whatsappNetworkChannelUrl', () => {
  it('returns the URL when set to a valid https whatsapp.com URL', async () => {
    process.env.WHATSAPP_NETWORK_CHANNEL_URL = 'https://whatsapp.com/channel/test-id';
    const mod = await loadModule();
    expect(mod.whatsappNetworkChannelUrl()).toBe('https://whatsapp.com/channel/test-id');
    expect(mod.whatsappNetworkChannelUrlOrNull()).toBe('https://whatsapp.com/channel/test-id');
  });

  it('accepts subdomains of whatsapp.com', async () => {
    process.env.WHATSAPP_NETWORK_CHANNEL_URL = 'https://chat.whatsapp.com/some-invite';
    const mod = await loadModule();
    expect(mod.whatsappNetworkChannelUrl()).toBe('https://chat.whatsapp.com/some-invite');
  });

  it('returns null in test env when the var is unset', async () => {
    delete process.env.WHATSAPP_NETWORK_CHANNEL_URL;
    const mod = await loadModule();
    expect(mod.whatsappNetworkChannelUrlOrNull()).toBe(null);
  });

  it('throws when whatsappNetworkChannelUrl() is called with no value', async () => {
    delete process.env.WHATSAPP_NETWORK_CHANNEL_URL;
    const mod = await loadModule();
    expect(() => mod.whatsappNetworkChannelUrl()).toThrow();
  });

  it('returns null in test env when the URL is not https', async () => {
    process.env.WHATSAPP_NETWORK_CHANNEL_URL = 'http://whatsapp.com/channel/test';
    const mod = await loadModule();
    expect(mod.whatsappNetworkChannelUrlOrNull()).toBe(null);
  });

  it('returns null in test env when the host is not whatsapp.com', async () => {
    process.env.WHATSAPP_NETWORK_CHANNEL_URL = 'https://example.com/something';
    const mod = await loadModule();
    expect(mod.whatsappNetworkChannelUrlOrNull()).toBe(null);
  });

  it('returns null in test env when the value is not a parseable URL', async () => {
    process.env.WHATSAPP_NETWORK_CHANNEL_URL = 'not a url';
    const mod = await loadModule();
    expect(mod.whatsappNetworkChannelUrlOrNull()).toBe(null);
  });
});
